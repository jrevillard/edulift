/**
 * ESLint rule to prevent navigate() calls to API routes
 *
 * @example Bad - navigate() to API route
 * navigate('/api/v1/children')
 *
 * @example Good - navigate() to frontend route
 * navigate('/children')
 */
export const noApiRoutesInNavigate = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prevent navigate() calls to API routes (/api/...)',
      category: 'Best Practices',
      recommended: 'error',
    },
    fixable: 'code',
    schema: [], // no options
  },
  create: (context) => ({
    CallExpression(node) {
      // Check if it's a navigate() call
      if (
        node.callee.type === 'Identifier' &&
        node.callee.name === 'navigate'
      ) {
        // Check first argument
        const firstArg = node.arguments[0];
        if (
          firstArg &&
          firstArg.type === 'Literal' &&
          typeof firstArg.value === 'string' &&
          firstArg.value.startsWith('/api/')
        ) {
          context.report({
            node,
            message: `Do not use navigate() with API routes. Found: "${firstArg.value}". Use frontend routes instead.`,
            fix(fixer) {
              // Try to suggest the correct route by removing /api/v1/ prefix
              const correctedRoute = firstArg.value.replace(/^\/api\/v1\//, '/');
              return fixer.replaceText(firstArg, `'${correctedRoute}'`);
            },
          });
        }
      }
    },
  }),
};
