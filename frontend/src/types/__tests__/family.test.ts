import { describe, it, expect } from 'vitest';
import {
  FamilyRole,
  validateFamilyName,
  validateInviteCode,
  validateEmail,
  getRoleDisplayName,
  getRoleDescription,
  getRoleIcon,
  isFamilyAdmin,
  canManageMembers,
  canModifyChildren,
  canModifyVehicles
} from '../family';
import type { FamilyMember, FamilyPermissions } from '../family';

describe('Family Types and Utilities', () => {
  describe('FamilyRole enum', () => {
    it('should have correct role values', () => {
      expect(FamilyRole.ADMIN).toBe('ADMIN');
      expect(FamilyRole.MEMBER).toBe('MEMBER');
    });
  });

  describe('Validation functions', () => {
    describe('validateFamilyName', () => {
      it('should return null for valid names', () => {
        expect(validateFamilyName('Smith Family')).toBeNull();
        expect(validateFamilyName('The Johnsons')).toBeNull();
        expect(validateFamilyName('AB')).toBeNull(); // minimum length
      });

      it('should return error for invalid names', () => {
        expect(validateFamilyName('')).toBe('Family name is required');
        expect(validateFamilyName('   ')).toBe('Family name is required');
        expect(validateFamilyName('A')).toBe('Family name must be at least 2 characters');
        expect(validateFamilyName('A'.repeat(51))).toBe('Family name must be less than 50 characters');
      });
    });

    describe('validateInviteCode', () => {
      it('should return null for valid codes', () => {
        expect(validateInviteCode('1234567')).toBeNull();
        expect(validateInviteCode('ABC123DEF')).toBeNull();
      });

      it('should return error for invalid codes', () => {
        expect(validateInviteCode('')).toBe('Invite code is required');
        expect(validateInviteCode('   ')).toBe('Invite code is required');
        expect(validateInviteCode('123456')).toBe('Invite code appears to be invalid');
      });
    });

    describe('validateEmail', () => {
      it('should return null for valid emails', () => {
        expect(validateEmail('test@example.com')).toBeNull();
        expect(validateEmail('user.name+tag@example.co.uk')).toBeNull();
      });

      it('should return error for invalid emails', () => {
        expect(validateEmail('')).toBe('Email is required');
        expect(validateEmail('   ')).toBe('Email is required');
        expect(validateEmail('invalid-email')).toBe('Please enter a valid email address');
        expect(validateEmail('@example.com')).toBe('Please enter a valid email address');
        expect(validateEmail('test@')).toBe('Please enter a valid email address');
      });
    });
  });

  describe('Role helper functions', () => {
    describe('getRoleDisplayName', () => {
      it('should return correct display names', () => {
        expect(getRoleDisplayName(FamilyRole.ADMIN)).toBe('Administrator');
        expect(getRoleDisplayName(FamilyRole.MEMBER)).toBe('Member');
      });
    });

    describe('getRoleDescription', () => {
      it('should return appropriate descriptions', () => {
        expect(getRoleDescription(FamilyRole.ADMIN)).toContain('manage all family members');
        expect(getRoleDescription(FamilyRole.MEMBER)).toContain('view family information');
      });
    });

    describe('getRoleIcon', () => {
      it('should return appropriate icons', () => {
        expect(getRoleIcon(FamilyRole.ADMIN)).toBe('👑');
        expect(getRoleIcon(FamilyRole.MEMBER)).toBe('👤');
      });
    });
  });

  describe('Permission helper functions', () => {
    const mockAdminMember: FamilyMember = {
      id: '1',
      familyId: 'family-1',
      userId: 'user-1',
      role: FamilyRole.ADMIN,
      joinedAt: '2024-01-01T00:00:00Z',
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    };


    const mockMember: FamilyMember = {
      ...mockAdminMember,
      role: FamilyRole.MEMBER
    };

    describe('isFamilyAdmin', () => {
      it('should correctly identify admin members', () => {
        expect(isFamilyAdmin(mockAdminMember)).toBe(true);
        expect(isFamilyAdmin(mockMember)).toBe(false);
      });
    });

    describe('Permission checks', () => {
      const adminPermissions: FamilyPermissions = {
        canManageMembers: true,
        canModifyChildren: true,
        canModifyVehicles: true,
        canViewFamily: true
      };


      const memberPermissions: FamilyPermissions = {
        canManageMembers: false,
        canModifyChildren: false,
        canModifyVehicles: false,
        canViewFamily: true
      };

      it('should correctly check admin permissions', () => {
        expect(canManageMembers(adminPermissions)).toBe(true);
        expect(canModifyChildren(adminPermissions)).toBe(true);
        expect(canModifyVehicles(adminPermissions)).toBe(true);
      });


      it('should correctly check member permissions', () => {
        expect(canManageMembers(memberPermissions)).toBe(false);
        expect(canModifyChildren(memberPermissions)).toBe(false);
        expect(canModifyVehicles(memberPermissions)).toBe(false);
      });
    });
  });
});