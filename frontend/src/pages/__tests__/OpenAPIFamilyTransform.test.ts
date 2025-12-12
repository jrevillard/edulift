/**
 * Unit test for OpenAPI group family transformation function
 * This verifies that the transformation from OpenAPI response to GroupFamily interface works correctly
 */

import { describe, it, expect } from 'vitest';
import { transformGroupFamily, type GetGroupFamiliesResponse } from '../OpenAPIFamilyTransform';

describe('OpenAPI Group Family Transformation', () => {
  const mockOpenApiFamily: GetGroupFamiliesResponse = {
    id: 'family-123',
    name: 'Test Family',
    role: 'ADMIN',
    isMyFamily: false,
    canManage: true,
    admins: [
      {
        name: 'Test Admin',
        email: 'admin@example.com'
      }
    ]
  };

  const mockCurrentGroup = {
    userRole: 'ADMIN',
    ownerFamily: {
      id: 'family-456' // Different from the mock family
    }
  };

  it('should transform OpenAPI family to GroupFamily interface correctly', () => {
    const result = transformGroupFamily(mockOpenApiFamily, 'family-789', mockCurrentGroup);

    expect(result).toMatchObject({
      id: 'family-123', // Uses family ID from API
      name: 'Test Family',
      role: 'ADMIN',
      isMyFamily: false, // From API response
      canManage: true,   // From API response
      admins: [
        {
          name: 'Test Admin',
          email: 'admin@example.com'
        }
      ]
      // Note: familyId, family, and status are not included as they're not in the OpenAPI response
    });
  });

  it('should identify owner family correctly', () => {
    const ownerFamily: GetGroupFamiliesResponse = {
      ...mockOpenApiFamily,
      role: 'OWNER',
      isMyFamily: true,
      canManage: false // Owners cannot manage their own family in the group context
    };

    const result = transformGroupFamily(ownerFamily, 'family-123', mockCurrentGroup);

    expect(result.role).toBe('OWNER');
    expect(result.isMyFamily).toBe(true);
    expect(result.canManage).toBe(false);
  });

  it('should identify user\'s own family correctly', () => {
    const myFamily: GetGroupFamiliesResponse = {
      ...mockOpenApiFamily,
      isMyFamily: true,
      canManage: false // Cannot manage own family
    };

    const result = transformGroupFamily(myFamily, 'family-123', mockCurrentGroup);

    expect(result.isMyFamily).toBe(true);
    expect(result.canManage).toBe(false);
  });

  it('should handle member role correctly', () => {
    const memberFamily: GetGroupFamiliesResponse = {
      ...mockOpenApiFamily,
      role: 'MEMBER',
      isMyFamily: false,
      canManage: false
    };

    const result = transformGroupFamily(memberFamily, 'family-789', mockCurrentGroup);

    expect(result.role).toBe('MEMBER');
  });

  it('should handle missing family name', () => {
    const familyWithoutName: GetGroupFamiliesResponse = {
      id: 'family-no-name',
      name: '', // OpenAPI returns empty string, no fallback provided
      role: 'MEMBER',
      isMyFamily: false,
      canManage: false,
      admins: []
    };

    const result = transformGroupFamily(familyWithoutName, 'family-789', mockCurrentGroup);

    expect(result.name).toBe(''); // OpenAPI response is passed through without transformation
  });
});