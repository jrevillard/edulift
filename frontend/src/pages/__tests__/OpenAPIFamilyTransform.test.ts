/**
 * Unit test for OpenAPI group family transformation function
 * This verifies that the transformation from OpenAPI response to GroupFamily interface works correctly
 */

import { describe, it, expect } from 'vitest';
import { transformGroupFamily, type GetGroupFamiliesResponse } from '../OpenAPIFamilyTransform';

describe('OpenAPI Group Family Transformation', () => {
  const mockOpenApiFamily: GetGroupFamiliesResponse = {
    id: 'member-123',
    familyId: 'family-123',
    role: 'ADMIN',
    joinedAt: '2023-01-01T00:00:00.000Z',
    family: {
      id: 'family-123',
      name: 'Test Family'
    }
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
      id: 'family-123', // Uses familyId as primary ID
      name: 'Test Family',
      role: 'ADMIN',
      familyId: 'family-123',
      joinedAt: '2023-01-01T00:00:00.000Z',
      family: {
        id: 'family-123',
        name: 'Test Family'
      },
      isMyFamily: false, // family-123 !== family-789
      canManage: true,   // Admin can manage non-own families
      admins: [],        // Placeholder
      status: 'ACCEPTED' // Active families are accepted
    });
  });

  it('should identify owner family correctly', () => {
    const ownerGroup = {
      userRole: 'OWNER',
      ownerFamily: {
        id: 'family-123' // Same as the mock family
      }
    };

    const result = transformGroupFamily(mockOpenApiFamily, 'family-789', ownerGroup);

    expect(result.role).toBe('OWNER');
    expect(result.isMyFamily).toBe(false);
  });

  it('should identify user\'s own family correctly', () => {
    const result = transformGroupFamily(mockOpenApiFamily, 'family-123', mockCurrentGroup);

    expect(result.isMyFamily).toBe(true);
    expect(result.canManage).toBe(false); // Cannot manage own family
  });

  it('should handle member role correctly', () => {
    const memberFamily: GetGroupFamiliesResponse = {
      ...mockOpenApiFamily,
      role: 'MEMBER'
    };

    const result = transformGroupFamily(memberFamily, 'family-789', mockCurrentGroup);

    expect(result.role).toBe('MEMBER');
  });

  it('should handle missing family object', () => {
    const familyWithoutName: GetGroupFamiliesResponse = {
      ...mockOpenApiFamily,
      family: undefined
    };

    const result = transformGroupFamily(familyWithoutName, 'family-789', mockCurrentGroup);

    expect(result.name).toBe('Unknown Family');
    expect(result.family).toBeUndefined();
  });
});