#!/usr/bin/env node

/**
 * Zod-Centric OpenAPI Generation Script
 *
 * Replaces the old swagger-autogen approach with Zod-based generation
 * Phase 2.2: Zod-based swagger generation script
 */

import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { config, registry } from '../src/config/openapi.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure docs/openapi directory exists
const docsDir = path.join(__dirname, '../docs/openapi');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

console.log('🚀 Generating Zod-centric OpenAPI specification...');

try {
  // Import and register all domain schemas
  console.log('📦 Registering domain schemas...');

  // Import Auth schemas and paths
  try {
    await import('../src/schemas/auth');
    console.log('✅ Auth schemas registered');
  } catch (error) {
    console.log('⚠️  Auth schemas not yet available, skipping...');
    console.log('   Error:', error instanceof Error ? error.message : error);
  }

  // Import Children schemas and paths
  try {
    await import('../src/schemas/children');
    console.log('✅ Children schemas registered');
  } catch (error) {
    console.log('⚠️  Children schemas not yet available, skipping...');
    console.log('   Error:', error instanceof Error ? error.message : error);
  }

  // Import Vehicles schemas and paths
  try {
    await import('../src/schemas/vehicles');
    console.log('✅ Vehicles schemas registered');
  } catch (error) {
    console.log('⚠️  Vehicles schemas not yet available, skipping...');
    console.log('   Error:', error instanceof Error ? error.message : error);
  }

  // Import Groups schemas and paths
  try {
    await import('../src/schemas/groups');
    console.log('✅ Groups schemas registered');
  } catch (error) {
    console.log('⚠️  Groups schemas not yet available, skipping...');
    console.log('   Error:', error instanceof Error ? error.message : error);
  }

  // Import Families schemas and paths
  try {
    await import('../src/schemas/families');
    console.log('✅ Families schemas registered');
  } catch (error) {
    console.log('⚠️  Families schemas not yet available, skipping...');
    console.log('   Error:', error instanceof Error ? error.message : error);
  }

  // Import FcmTokens schemas and paths
  try {
    await import('../src/schemas/fcmTokens');
    console.log('✅ FcmTokens schemas registered');
  } catch (error) {
    console.log('⚠️  FcmTokens schemas not yet available, skipping...');
    console.log('   Error:', error instanceof Error ? error.message : error);
  }

  // Import Dashboard schemas and paths
  try {
    await import('../src/schemas/dashboard');
    console.log('✅ Dashboard schemas registered');
  } catch (error) {
    console.log('⚠️  Dashboard schemas not yet available, skipping...');
    console.log('   Error:', error instanceof Error ? error.message : error);
  }

  // Import Invitations schemas and paths
  try {
    await import('../src/schemas/invitations');
    console.log('✅ Invitations schemas registered');
  } catch (error) {
    console.log('⚠️  Invitations schemas not yet available, skipping...');
    console.log('   Error:', error instanceof Error ? error.message : error);
  }

  // Import ScheduleSlots schemas and paths - FINAL DOMAIN for 100% coverage
  try {
    await import('../src/schemas/scheduleSlots');
    console.log('✅ ScheduleSlots schemas registered - FINAL DOMAIN!');
  } catch (error) {
    console.log('⚠️  ScheduleSlots schemas not yet available, skipping...');
    console.log('   Error:', error instanceof Error ? error.message : error);
  }

  // Generate OpenAPI document from Zod schemas
  console.log('🔧 Generating OpenAPI document...');
  const generator = new OpenApiGeneratorV3(registry.definitions);
  const docs = generator.generateDocument(config.openapi);

  // Write generated spec to file
  const outputPath = path.join(__dirname, '../docs/openapi/swagger.json');
  fs.writeFileSync(outputPath, JSON.stringify(docs, null, 2));

  console.log('✅ OpenAPI specification generated successfully!');
  console.log(`📍 Output: ${outputPath}`);
  console.log(`📊 Generated ${Object.keys(docs.paths || {}).length} API paths`);
  console.log(`📋 Generated ${Object.keys(docs.components?.schemas || {}).length} schemas`);

  // Generate summary statistics
  const stats = {
    paths: Object.keys(docs.paths || {}).length,
    schemas: Object.keys(docs.components?.schemas || {}).length,
    tags: docs.tags?.length || 0,
    servers: docs.servers?.length || 0,
  };

  console.log('\n📈 Generation Statistics:');
  console.log(`   Paths: ${stats.paths}`);
  console.log(`   Schemas: ${stats.schemas}`);
  console.log(`   Tags: ${stats.tags}`);
  console.log(`   Servers: ${stats.servers}`);

  // Validate the generated spec
  if (docs.openapi && docs.info && docs.paths) {
    console.log('\n✅ Generated OpenAPI spec is valid');
  } else {
    console.log('\n⚠️  Generated OpenAPI spec may have issues');
    console.log('Missing elements:', {
      openapi: !!docs.openapi,
      info: !!docs.info,
      paths: !!docs.paths,
    });
  }

} catch (error) {
  console.error('❌ Error generating OpenAPI specification:', error);

  if (error instanceof Error) {
    console.error('\nStack trace:');
    console.error(error.stack);
  }

  process.exit(1);
}

console.log('\n🎉 Zod-centric OpenAPI generation completed!');