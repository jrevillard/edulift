#!/usr/bin/env node

/**
 * Optimized Zod-Centric OpenAPI Generation Script
 *
 * Replaces manual schema imports with automatic discovery and registration
 * Features:
 * - Automatic schema discovery from filesystem
 * - Dependency tracking and verification
 * - Usage analytics and orphan detection
 * - Maintainable and error-resistant
 */

import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { config } from '../src/config/openapi.js';
import { registry } from '../src/config/registry.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Schema discovery configuration
const SCHEMA_DIR = path.join(__dirname, '../src/schemas');
const EXCLUDED_FILES = ['backup_20251211_130851', 'responses.ts.backup'];
const COMMON_SCHEMA = '_common';

// Statistics tracking
interface SchemaStats {
  totalFiles: number;
  loadedFiles: number;
  failedFiles: string[];
  registeredSchemas: number;
  registeredPaths: number;
  dependencies: Map<string, string[]>;
}

const stats: SchemaStats = {
  totalFiles: 0,
  loadedFiles: 0,
  failedFiles: [],
  registeredSchemas: 0,
  registeredPaths: 0,
  dependencies: new Map(),
};

// Ensure docs/openapi directory exists
const docsDir = path.join(__dirname, '../docs/openapi');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

/**
 * Discover schema files automatically
 */
function discoverSchemaFiles(): string[] {
  console.log('🔍 Discovering schema files...');

  if (!fs.existsSync(SCHEMA_DIR)) {
    throw new Error(`Schema directory not found: ${SCHEMA_DIR}`);
  }

  const files = fs.readdirSync(SCHEMA_DIR, { withFileTypes: true })
    .filter(dirent => {
      if (dirent.isDirectory()) return false;
      if (EXCLUDED_FILES.includes(dirent.name)) return false;
      return dirent.name.endsWith('.ts');
    })
    .map(dirent => dirent.name)
    .sort();

  stats.totalFiles = files.length;
  console.log(`📁 Found ${files.length} schema files: ${files.join(', ')}`);

  return files;
}

/**
 * Load schema module with proper error handling
 */
async function loadSchemaModule(fileName: string): Promise<any> {
  const moduleName = path.parse(fileName).name;
  const modulePath = `../src/schemas/${moduleName}`;

  try {
    const module = await import(modulePath);
    stats.loadedFiles++;
    console.log(`✅ Loaded schema: ${moduleName}`);
    return module;
  } catch (error) {
    stats.failedFiles.push(moduleName);
    console.error(`❌ Failed to load schema: ${moduleName}`);
    console.error(`   Error: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

/**
 * Track schema dependencies by analyzing imports
 */
function trackDependencies(fileName: string): void {
  const filePath = path.join(SCHEMA_DIR, fileName);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const imports = content.match(/from ['"]\.\.\/schemas\/([^'"]+)['"]/g) || [];
    const dependencies = imports
      .map(imp => imp.match(/from ['"]\.\.\/schemas\/([^'"]+)['"]/)?.[1])
      .filter(Boolean)
      .map(dep => dep.endsWith('.ts') ? path.parse(dep).name : dep);

    if (dependencies.length > 0) {
      stats.dependencies.set(path.parse(fileName).name, dependencies);
      console.log(`🔗 ${path.parse(fileName).name} depends on: ${dependencies.join(', ')}`);
    }
  } catch (error) {
    console.warn(`⚠️  Could not analyze dependencies for ${fileName}`);
  }
}

/**
 * Load schemas in dependency order (common first, then by dependencies)
 */
async function loadSchemasInDependencyOrder(files: string[]): Promise<void> {
  console.log('\n📦 Loading schemas with dependency resolution...');

  // Load _common first
  const commonFile = files.find(f => f.includes(COMMON_SCHEMA));
  if (commonFile) {
    console.log('🔧 Loading common schemas first...');
    await loadSchemaModule(commonFile);
  }

  // Track all dependencies
  files.forEach(file => trackDependencies(file));

  // Load other files, handling dependencies
  const otherFiles = files.filter(f => !f.includes(COMMON_SCHEMA));
  const loaded = new Set<string>();
  let attempts = 0;
  const maxAttempts = otherFiles.length * 2;

  while (loaded.size < otherFiles.length && attempts < maxAttempts) {
    attempts++;

    for (const file of otherFiles) {
      const moduleName = path.parse(file).name;
      if (loaded.has(moduleName)) continue;

      const deps = stats.dependencies.get(moduleName) || [];
      const depsLoaded = deps.every(dep => dep === COMMON_SCHEMA || loaded.has(dep));

      if (depsLoaded) {
        await loadSchemaModule(file);
        loaded.add(moduleName);
      }
    }
  }

  // Load any remaining files (circular dependencies or missing deps)
  for (const file of otherFiles) {
    const moduleName = path.parse(file).name;
    if (!loaded.has(moduleName)) {
      console.warn(`⚠️  Loading ${moduleName} (may have unresolved dependencies)`);
      await loadSchemaModule(file);
    }
  }
}

/**
 * Analyze registry usage and statistics
 */
function analyzeRegistry(): void {
  console.log('\n📊 Analyzing registry contents...');

  // Count registered schemas and paths
  const definitions = registry.definitions;

  stats.registeredPaths = definitions.filter(d => d.type === 'path').length;
  stats.registeredSchemas = definitions.filter(d => d.type === 'schema').length;

  // Group by tags for analysis
  const pathTags = new Map<string, number>();
  definitions
    .filter(d => d.type === 'path')
    .forEach(d => {
      const tags = d.document?.tags || [];
      tags.forEach(tag => {
        pathTags.set(tag, (pathTags.get(tag) || 0) + 1);
      });
    });

  console.log(`📋 Registered ${stats.registeredSchemas} schemas`);
  console.log(`🛣️  Registered ${stats.registeredPaths} paths`);

  if (pathTags.size > 0) {
    console.log('🏷️  Paths by tag:');
    pathTags.forEach((count, tag) => {
      console.log(`   ${tag}: ${count} paths`);
    });
  }
}

/**
 * Validate generated OpenAPI specification
 */
function validateGeneratedSpec(docs: any): void {
  console.log('\n🔍 Validating generated specification...');

  const validation = {
    hasOpenApi: !!docs.openapi,
    hasInfo: !!docs.info,
    hasPaths: !!docs.paths,
    hasComponents: !!docs.components,
    pathCount: Object.keys(docs.paths || {}).length,
    schemaCount: Object.keys(docs.components?.schemas || {}).length,
  };

  if (validation.hasOpenApi && validation.hasInfo && validation.hasPaths) {
    console.log('✅ Generated OpenAPI spec is valid');
  } else {
    console.warn('⚠️  Generated OpenAPI spec has issues');
    console.log('Missing elements:', {
      openapi: validation.hasOpenApi,
      info: validation.hasInfo,
      paths: validation.hasPaths,
    });
  }

  // Check for orphan schemas (defined but not referenced)
  const referencedSchemas = new Set<string>();
  const allSchemas = Object.keys(docs.components?.schemas || {});

  // Extract schema references from paths
  Object.values(docs.paths || {}).forEach((pathItem: any) => {
    Object.values(pathItem).forEach((operation: any) => {
      if (operation?.request?.body?.content) {
        Object.values(operation.request.body.content).forEach((content: any) => {
          extractSchemaRefs(content.schema, referencedSchemas);
        });
      }
      if (operation?.responses) {
        Object.values(operation.responses).forEach((response: any) => {
          if (response?.content) {
            Object.values(response.content).forEach((content: any) => {
              extractSchemaRefs(content.schema, referencedSchemas);
            });
          }
        });
      }
    });
  });

  const orphanSchemas = allSchemas.filter(schema => !referencedSchemas.has(schema));
  if (orphanSchemas.length > 0) {
    console.warn(`⚠️  Found ${orphanSchemas.length} potentially orphaned schemas:`);
    orphanSchemas.forEach(schema => console.log(`   - ${schema}`));
  }

  return validation;
}

/**
 * Extract schema references recursively
 */
function extractSchemaRefs(obj: any, refs: Set<string>): void {
  if (!obj || typeof obj !== 'object') return;

  if (obj.$ref && typeof obj.$ref === 'string') {
    const match = obj.$ref.match(/#\/components\/schemas\/(.+)$/);
    if (match) refs.add(match[1]);
  }

  Object.values(obj).forEach(value => extractSchemaRefs(value, refs));
}

/**
 * Main generation function
 */
async function generateOpenAPISpec(): Promise<void> {
  console.log('🚀 Optimized Zod-centric OpenAPI specification generation...\n');

  try {
    // Discover and load schemas automatically
    const schemaFiles = discoverSchemaFiles();
    await loadSchemasInDependencyOrder(schemaFiles);

    // Analyze what was registered
    analyzeRegistry();

    // Generate OpenAPI document
    console.log('\n🔧 Generating OpenAPI document...');
    const generator = new OpenApiGeneratorV3(registry.definitions);
    const docs = generator.generateDocument(config.openapi);

    // Fix known library limitation: nullable without type in additionalProperties
    const fixNullableWithoutType = (obj: Record<string, unknown>): void => {
      if (obj && typeof obj === 'object') {
        if (obj.nullable === true && !obj.type && obj !== null) {
          delete obj.nullable;
        }
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            fixNullableWithoutType(obj[key] as Record<string, unknown>);
          }
        }
      }
    };

    fixNullableWithoutType(docs);

    // Convert OpenAPI 3.0 nullable syntax to OpenAPI 3.1 syntax
    // The library @asteasolutions/zod-to-openapi still generates "nullable": true
    // even with OpenAPI 3.1.0, so we convert it to type array syntax.
    let convertedCount = 0;
    const convertNullableToOpenAPI31 = (obj: Record<string, unknown>): void => {
      if (obj && typeof obj === 'object') {
        if (Array.isArray(obj)) {
          obj.forEach(convertNullableToOpenAPI31);
        } else {
          // Convert { type: "string", nullable: true } to { type: ["string", "null"] }
          if (obj.nullable === true && obj.type && !Array.isArray(obj.type)) {
            const originalType = obj.type as string | string[];
            if (typeof originalType === 'string') {
              obj.type = [originalType, 'null'];
              delete obj.nullable;
              convertedCount++;
            }
          }
          for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              convertNullableToOpenAPI31(obj[key] as Record<string, unknown>);
            }
          }
        }
      }
    };

    convertNullableToOpenAPI31(docs);
    console.log(`🔄 Converted ${convertedCount} nullable fields to OpenAPI 3.1 syntax`);

    // Write generated spec to file
    const outputPath = path.join(__dirname, '../docs/openapi/swagger.json');
    fs.writeFileSync(outputPath, JSON.stringify(docs, null, 2));

    // Validate and report
    const validation = validateGeneratedSpec(docs);

    console.log('\n✅ OpenAPI specification generated successfully!');
    console.log(`📍 Output: ${outputPath}`);
    console.log(`🛣️  Generated ${validation.pathCount} API paths`);
    console.log(`📋 Generated ${validation.schemaCount} schemas`);

    // Report statistics
    console.log('\n📈 Generation Statistics:');
    console.log(`   Schema files found: ${stats.totalFiles}`);
    console.log(`   Schema files loaded: ${stats.loadedFiles}`);
    console.log(`   Failed loads: ${stats.failedFiles.length}`);
    if (stats.failedFiles.length > 0) {
      console.log(`   Failed files: ${stats.failedFiles.join(', ')}`);
    }
    console.log(`   Registered schemas: ${stats.registeredSchemas}`);
    console.log(`   Registered paths: ${stats.registeredPaths}`);

    // Dependency analysis
    if (stats.dependencies.size > 0) {
      console.log('\n🔗 Dependencies found:');
      stats.dependencies.forEach((deps, schema) => {
        console.log(`   ${schema} → [${deps.join(', ')}]`);
      });
    }

  } catch (error) {
    console.error('\n❌ Error generating OpenAPI specification:', error);

    if (error instanceof Error) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run the generator
generateOpenAPISpec().then(() => {
  console.log('\n🎉 Optimized Zod-centric OpenAPI generation completed!');
}).catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});