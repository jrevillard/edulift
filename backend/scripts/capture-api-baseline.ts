/**
 * API Baseline Capture Script
 *
 * This script captures the current state of all API endpoints to create a snapshot
 * for non-regression testing during the OpenAPI migration.
 *
 * Phase 1.3 of the OpenAPI Migration Plan
 */

import app from '../src/app';
import { Express } from 'express';

interface RouteInfo {
  method: string;
  path: string;
  fullPath: string;
  requiresAuth: boolean;
  middlewares: string[];
}

interface BaselineSnapshot {
  capturedAt: string;
  nodeVersion: string;
  routes: RouteInfo[];
  summary: {
    totalRoutes: number;
    methodBreakdown: Record<string, number>;
    authProtectedRoutes: number;
    publicRoutes: number;
  };
}

/**
 * Extract route information from Express application
 */
function extractRoutes(baseApp: Express): RouteInfo[] {
  const routes: RouteInfo[] = [];

  function processStack(stack: Express.RequestHandler[], basePath = '') {
    stack.forEach((middleware) => {
      if (middleware.route) {
        // Regular route
        const route = middleware.route;
        const path = basePath + route.path;

        Object.keys(route.methods).forEach((method) => {
          if (route.methods[method]) {
            const middlewareNames = route.stack.map((layer: Express.RequestHandler) => {
              const layerHandler = layer as unknown as { name?: string };
              return layerHandler.name || 'anonymous';
            });

            const requiresAuth = middlewareNames.some((name: string) =>
              name.includes('authenticateToken') ||
              name.includes('auth')
            );

            routes.push({
              method: method.toUpperCase(),
              path: route.path,
              fullPath: path,
              requiresAuth,
              middlewares: middlewareNames,
            });
          }
        });
      } else if (middleware.name === 'router' && middleware.handle?.stack) {
        // Nested router
        const routerPath = middleware.regexp
          .toString()
          .replace('/^', '')
          .replace('\\/?(?=\\/|$)/i', '')
          .replace(/\\\//g, '/')
          .replace(/\?\(\?=.*$/, '')
          .replace(/\^/, '')
          .replace(/\/i$/, '')
          .split('?')[0];

        processStack(middleware.handle.stack, basePath + routerPath);
      }
    });
  }

  processStack(baseApp._router.stack);
  return routes;
}

/**
 * Generate summary statistics
 */
function generateSummary(routes: RouteInfo[]): BaselineSnapshot['summary'] {
  const methodBreakdown: Record<string, number> = {};
  let authProtectedRoutes = 0;
  let publicRoutes = 0;

  routes.forEach((route) => {
    // Count methods
    methodBreakdown[route.method] = (methodBreakdown[route.method] || 0) + 1;

    // Count auth vs public
    if (route.requiresAuth) {
      authProtectedRoutes++;
    } else {
      publicRoutes++;
    }
  });

  return {
    totalRoutes: routes.length,
    methodBreakdown,
    authProtectedRoutes,
    publicRoutes,
  };
}

/**
 * Main function to capture API baseline
 */
async function captureBaseline() {
  console.log('🔍 Capturing API Baseline...\n');

  try {
    // Extract routes from the Express app
    const routes = extractRoutes(app);

    // Filter out non-API routes (health checks, swagger, etc.)
    const apiRoutes = routes.filter((route) => {
      return (
        route.fullPath.startsWith('/api/') ||
        route.fullPath === '/health' ||
        route.fullPath === '/api/health/database'
      );
    });

    // Sort routes for consistent output
    apiRoutes.sort((a, b) => {
      if (a.fullPath !== b.fullPath) {
        return a.fullPath.localeCompare(b.fullPath);
      }
      return a.method.localeCompare(b.method);
    });

    // Generate summary
    const summary = generateSummary(apiRoutes);

    // Create baseline snapshot
    const baseline: BaselineSnapshot = {
      capturedAt: new Date().toISOString(),
      nodeVersion: process.version,
      routes: apiRoutes,
      summary,
    };

    // Output to console
    console.log('📊 API Baseline Summary:');
    console.log(`  Total Routes: ${summary.totalRoutes}`);
    console.log(`  Auth Protected: ${summary.authProtectedRoutes}`);
    console.log(`  Public: ${summary.publicRoutes}`);
    console.log('\n📈 Method Breakdown:');
    Object.entries(summary.methodBreakdown)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([method, count]) => {
        console.log(`  ${method}: ${count}`);
      });

    console.log('\n📋 Routes by Path:');
    const routesByPath: Record<string, string[]> = {};
    apiRoutes.forEach((route) => {
      const basePath = route.fullPath.split('/').slice(0, 4).join('/') || '/';
      if (!routesByPath[basePath]) {
        routesByPath[basePath] = [];
      }
      routesByPath[basePath].push(`${route.method} ${route.fullPath}`);
    });

    Object.entries(routesByPath)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([basePath, routes]) => {
        console.log(`\n  ${basePath}:`);
        routes.forEach((route) => {
          console.log(`    ${route}`);
        });
      });

    // Write to file
    const fs = await import('fs');
    const path = await import('path');

    const outputPath = path.join(process.cwd(), 'tests/snapshots/api-baseline.json');
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(baseline, null, 2));

    console.log(`\n✅ Baseline captured successfully!`);
    console.log(`📄 Saved to: ${outputPath}\n`);

    return baseline;
  } catch (error) {
    console.error('❌ Error capturing baseline:', error);
    throw error;
  }
}

// Run the script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  captureBaseline()
    .then(() => {
      console.log('✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { captureBaseline, extractRoutes };
