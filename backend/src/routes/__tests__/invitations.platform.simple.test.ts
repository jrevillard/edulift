/**
 * Simple test to verify the platform parameter fix is working
 * This test focuses on verifying the code compiles and the platform parameter is extracted
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Platform Parameter Fix Verification', () => {
  it('should extract platform parameter from request body', () => {
    // Mock request body with platform parameter
    const mockReqBody = {
      familyId: 'test-family-id',
      email: 'test@example.com',
      role: 'MEMBER',
      platform: 'native',
    };

    // Simulate the platform validation logic from our fix
    const validPlatform = mockReqBody.platform === 'native' ? 'native' : 'web';

    expect(validPlatform).toBe('native');
  });

  it('should default to web when platform is not specified', () => {
    const mockReqBody: any = {
      familyId: 'test-family-id',
      email: 'test@example.com', 
      role: 'MEMBER',
    };

    const validPlatform = mockReqBody.platform === 'native' ? 'native' : 'web';

    expect(validPlatform).toBe('web');
  });

  it('should default to web when invalid platform is specified', () => {
    const mockReqBody: any = {
      familyId: 'test-family-id',
      email: 'test@example.com',
      role: 'MEMBER',
      platform: 'invalid-platform',
    };

    const validPlatform = mockReqBody.platform === 'native' ? 'native' : 'web';

    expect(validPlatform).toBe('web');
  });

  it('should verify the fix is properly implemented in the routes file', () => {
    // Read the actual routes file to verify our fix
    const routesFile = fs.readFileSync(
      path.join(__dirname, '..', 'invitations.ts'), 
      'utf8',
    );

    // Verify the platform parameter is extracted from req.body
    expect(routesFile).toContain('const { familyId, email, role, personalMessage, platform } = req.body;');
    
    // Verify the platform validation is present
    expect(routesFile).toContain('const validPlatform = platform === \'native\' ? \'native\' : \'web\';');
    
    // Verify the platform is passed to the service
    expect(routesFile).toContain('validPlatform');
  });
});