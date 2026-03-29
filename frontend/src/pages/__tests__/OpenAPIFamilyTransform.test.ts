/**
 * Unit test for OpenAPI group family transformation function
 * This verifies that the transformation from OpenAPI response to GroupFamily interface works correctly
 */

import { describe, it, expect } from 'vitest';
import { transformGroupFamily, type GroupFamily } from '../OpenAPIFamilyTransform';

describe('OpenAPI Group Family Transformation', () => {
  const mockOpenApiFamily: GroupFamily = {
    id: 'family-123',
    name: 'Test Family',
    role: 'ADMIN',
    isMyFamily: false,
    canManage: true,
    admins: [
      {
        name: 'Test Admin',
        email: 'admin@example.com',
      },
    ],
  };

  it('should transform OpenAPI family to GroupFamily interface correctly', () => {
    const result = transformGroupFamily(mockOpenApiFamily);

    expect(result).toMatchObject({
      id: 'family-123',
      name: 'Test Family',
      role: 'ADMIN',
      isMyFamily: false,
      canManage: true,
      admins: [
        {
          name: 'Test Admin',
          email: 'admin@example.com',
        },
      ],
    });
  });

  it('should identify owner family correctly', () => {
    const ownerFamily: GroupFamily = {
      ...mockOpenApiFamily,
      role: 'OWNER',
      isMyFamily: true,
      canManage: false, // Owners cannot manage their own family in the group context
    };

    const result = transformGroupFamily(ownerFamily);

    expect(result.role).toBe('OWNER');
    expect(result.isMyFamily).toBe(true);
    expect(result.canManage).toBe(false);
  });

  it('should identify user\'s own family correctly', () => {
    const myFamily: GroupFamily = {
      ...mockOpenApiFamily,
      isMyFamily: true,
      canManage: false, // Cannot manage own family
    };

    const result = transformGroupFamily(myFamily);

    expect(result.isMyFamily).toBe(true);
    expect(result.canManage).toBe(false);
  });

  it('should handle member role correctly', () => {
    const memberFamily: GroupFamily = {
      ...mockOpenApiFamily,
      role: 'MEMBER',
      isMyFamily: false,
      canManage: false,
    };

    const result = transformGroupFamily(memberFamily);

    expect(result.role).toBe('MEMBER');
  });

  it('should handle missing family name', () => {
    const familyWithoutName: GroupFamily = {
      id: 'family-no-name',
      name: '', // OpenAPI returns empty string, no fallback provided
      role: 'MEMBER',
      isMyFamily: false,
      canManage: false,
      admins: [],
    };

    const result = transformGroupFamily(familyWithoutName);

    expect(result.name).toBe(''); // OpenAPI response is passed through without transformation
  });

  it('should handle undefined admins array', () => {
    const familyWithoutAdmins: GroupFamily = {
      id: 'family-no-admins',
      name: 'No Admins Family',
      role: 'MEMBER',
      isMyFamily: false,
      canManage: false,
      admins: undefined,
    };

    const result = transformGroupFamily(familyWithoutAdmins);

    expect(result.admins).toEqual([]); // Should default to empty array
  });
});