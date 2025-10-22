/**
 * Custom ESLint rules for testing standards (Unit, Integration, E2E)
 * Prevents dangerous silent failure patterns in all test frameworks
 * Supports: Jest, Vitest, Playwright, and other testing frameworks
 */

export default {
  rules: {
    // Rule to detect dangerous conditional returns in all test types
    'no-silent-returns': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Disallow silent returns in test functions that could hide failures',
        category: 'Possible Errors',
        recommended: true
      },
      schema: []
    },
    create(context) {
      return {
        ReturnStatement(node) {
          // Check if we're in a test function (supports multiple test frameworks)
          let ancestor = node.parent;
          let inTestFunction = false;
          
          while (ancestor) {
            if (ancestor.type === 'CallExpression' && ancestor.callee) {
              const functionName = ancestor.callee.name || 
                                 (ancestor.callee.property && ancestor.callee.property.name);
              
              // Support multiple test frameworks
              const testFunctions = [
                'test', 'it', 'describe', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll',
                'step' // Playwright specific
              ];
              
              if (testFunctions.includes(functionName)) {
                inTestFunction = true;
                break;
              }
            }
            ancestor = ancestor.parent;
          }
          
          if (inTestFunction && !node.argument) {
            // Check if this return is inside an if statement
            let parent = node.parent;
            while (parent && parent.type !== 'IfStatement' && parent.type !== 'ConditionalExpression') {
              parent = parent.parent;
            }
            
            if (parent && parent.type === 'IfStatement') {
              context.report({
                node,
                message: 'Avoid silent returns in tests. Use explicit error throwing instead of allowing tests to pass when conditions are not met.'
              });
            }
          }
        }
      };
    }
  },

  // Rule to detect conditional testing patterns across all test types
  'require-explicit-assertions': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Require explicit assertions instead of conditional testing',
        category: 'Best Practices',
        recommended: true
      },
      schema: []
    },
    create(context) {
      return {
        IfStatement(node) {
          // Detect various conditional testing patterns
          const dangerousPatterns = [
            // E2E patterns
            { method: 'isVisible', suggestion: 'Use explicit await expect(element).toBeVisible()' },
            { method: 'isEnabled', suggestion: 'Use explicit await expect(element).toBeEnabled()' },
            { method: 'isChecked', suggestion: 'Use explicit await expect(element).toBeChecked()' },
            
            // Unit test patterns
            { method: 'toBeDefined', suggestion: 'Use explicit expect(value).toBeDefined()' },
            { method: 'toExist', suggestion: 'Use explicit expect(value).toExist()' },
            
            // Integration patterns
            { method: 'ok', suggestion: 'Use explicit expect(response.ok).toBe(true)' },
            { method: 'status', suggestion: 'Use explicit expect(response.status).toBe(expectedStatus)' }
          ];
          
          if (node.test && 
              node.test.type === 'AwaitExpression' &&
              node.test.argument &&
              node.test.argument.type === 'CallExpression' &&
              node.test.argument.callee &&
              node.test.argument.callee.property) {
            
            const methodName = node.test.argument.callee.property.name;
            const pattern = dangerousPatterns.find(p => p.method === methodName);
            
            if (pattern && (!node.alternate || node.alternate.type === 'IfStatement')) {
              context.report({
                node,
                message: `${pattern.suggestion} instead of conditional checks. Conditional testing can hide broken functionality.`
              });
            }
          }
          
          // Also check for non-async conditional patterns
          if (node.test && 
              node.test.type === 'CallExpression' &&
              node.test.callee &&
              node.test.callee.property) {
            
            const methodName = node.test.callee.property.name;
            if (['toBeDefined', 'toExist'].includes(methodName) && 
                (!node.alternate || node.alternate.type === 'IfStatement')) {
              context.report({
                node,
                message: 'Use explicit assertions instead of conditional existence checks. This can hide missing functionality.'
              });
            }
          }
        }
      };
    }
  },

  // Rule to detect use of brittle selectors (applies mainly to E2E tests)
  'prefer-reliable-selectors': {
    meta: {
      type: 'suggestion',
      docs: {
        description: 'Prefer reliable selectors (data-testid, explicit mocks) over brittle ones',
        category: 'Best Practices',
        recommended: true
      },
      schema: []
    },
    create(context) {
      return {
        CallExpression(node) {
          // Check for page.locator() calls
          if (node.callee &&
              node.callee.property &&
              node.callee.property.name === 'locator' &&
              node.arguments.length > 0 &&
              node.arguments[0].type === 'Literal') {
            
            const selector = node.arguments[0].value;
            
            // Flag text selectors (E2E)
            if (typeof selector === 'string' && selector.startsWith('text=')) {
              context.report({
                node,
                message: `Avoid text selectors "${selector}". Use data-testid attributes instead for more reliable element selection.`
              });
            }
            
            // Flag CSS class selectors (E2E)
            if (typeof selector === 'string' && 
                selector.startsWith('.') && 
                !selector.includes('[data-testid')) {
              context.report({
                node,
                message: `Consider using data-testid instead of CSS selector "${selector}" for more reliable element selection.`
              });
            }
          }
          
          // Check for brittle test patterns in unit tests
          if (node.callee &&
              node.callee.property &&
              node.callee.property.name === 'mockImplementation' &&
              node.arguments.length > 0 &&
              node.arguments[0].type === 'ArrowFunctionExpression' &&
              !node.arguments[0].body) {
            context.report({
              node,
              message: 'Provide explicit mock implementations instead of empty functions to avoid silent test failures.'
            });
          }
        }
      };
    }
  },

  // Rule to detect missing error messages in test failures (all test types)
  'require-descriptive-errors': {
    meta: {
      type: 'suggestion',
      docs: {
        description: 'Require descriptive error messages in test failures and assertions',
        category: 'Best Practices',
        recommended: true
      },
      schema: []
    },
    create(context) {
      return {
        ThrowStatement(node) {
          if (node.argument &&
              node.argument.type === 'NewExpression' &&
              node.argument.callee &&
              node.argument.callee.name === 'Error' &&
              node.argument.arguments.length > 0 &&
              node.argument.arguments[0].type === 'Literal') {
            
            const errorMessage = node.argument.arguments[0].value;
            
            // Check if error message is too generic
            if (typeof errorMessage === 'string' && errorMessage.length < 20) {
              context.report({
                node,
                message: 'Test error messages should be descriptive and include context about what failed and why.'
              });
            }
          }
        }
      };
    }
  }
  }
};