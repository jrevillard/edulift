/**
 * Regression test for the no-api-routes-in-navigate ESLint rule
 *
 * This test ensures that navigate() calls to API routes are caught at lint time,
 * preventing the bug where API routes were used instead of frontend routes.
 */

import { noApiRoutesInNavigate } from './no-api-routes-in-navigate.js';

describe('no-api-routes-in-navigate ESLint rule', () => {
  const mockContext = {
    report: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createCallExpression = (calleeName, args) => ({
    type: 'CallExpression',
    callee: {
      type: 'Identifier',
      name: calleeName,
    },
    arguments: args,
  });

  it('should report error when navigate() is called with API route', () => {
    const rule = noApiRoutesInNavigate.create(mockContext);
    const node = createCallExpression('navigate', [
      { type: 'Literal', value: '/api/v1/children' },
    ]);

    rule.CallExpression(node);

    expect(mockContext.report).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('/api/v1/children'),
        fix: expect.any(Function),
      })
    );
  });

  it('should NOT report error for valid frontend routes', () => {
    const rule = noApiRoutesInNavigate.create(mockContext);
    const node = createCallExpression('navigate', [
      { type: 'Literal', value: '/children' },
    ]);

    rule.CallExpression(node);

    expect(mockContext.report).not.toHaveBeenCalled();
  });

  it('should NOT report error for other function calls', () => {
    const rule = noApiRoutesInNavigate.create(mockContext);
    const node = createCallExpression('apiCall', [
      { type: 'Literal', value: '/api/v1/children' },
    ]);

    rule.CallExpression(node);

    expect(mockContext.report).not.toHaveBeenCalled();
  });

  it('should fix the route by removing /api/v1/ prefix', () => {
    const fixer = {
      replaceText: vi.fn().mockReturnValue({}),
    };

    const rule = noApiRoutesInNavigate.create(mockContext);
    const node = createCallExpression('navigate', [
      { type: 'Literal', value: '/api/v1/children' },
    ]);

    rule.CallExpression(node);

    // The first call to report receives an object with fix property
    const reportCallArg = mockContext.report.mock.calls[0][0];
    expect(reportCallArg.fix).toBeDefined();

    // Call the fix function
    reportCallArg.fix(fixer);

    expect(fixer.replaceText).toHaveBeenCalledWith(
      { type: 'Literal', value: '/api/v1/children' },
      "'/children'"
    );
  });

  it('should catch various API route patterns', () => {
    const apiRoutes = [
      '/api/v1/children',
      '/api/v1/vehicles',
      '/api/v1/groups',
      '/api/v1/users',
      '/api/v2/test',
      '/api/anything',
    ];

    const rule = noApiRoutesInNavigate.create(mockContext);

    apiRoutes.forEach((route) => {
      mockContext.report.mockClear();
      const node = createCallExpression('navigate', [
        { type: 'Literal', value: route },
      ]);
      rule.CallExpression(node);
      expect(mockContext.report).toHaveBeenCalled();
    });
  });
});
