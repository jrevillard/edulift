import { Request, Response } from 'express';
import { FamilyService } from '../services/FamilyService';
import { FamilyAuthService } from '../services/FamilyAuthService';
import { FamilyRole } from '../types/family';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export class FamilyController {
  constructor(
    private familyService: FamilyService,
    private familyAuthService: FamilyAuthService
  ) {}

  async createFamily(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name } = req.body;

      if (!name || name.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Family name is required'
        });
        return;
      }

      const family = await this.familyService.createFamily(req.user.id, name);

      res.status(201).json({
        success: true,
        data: family
      });
    } catch (error) {
      console.error('Family creation error:', error);
      res.status(400).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  async joinFamily(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { inviteCode } = req.body;

      if (!inviteCode) {
        res.status(400).json({
          success: false,
          error: 'Invite code is required'
        });
        return;
      }

      const family = await this.familyService.joinFamily(inviteCode, req.user.id);

      res.status(200).json({
        success: true,
        data: family
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  async getCurrentFamily(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const family = await this.familyService.getUserFamily(req.user.id);

      if (!family) {
        res.status(404).json({
          success: false,
          error: 'User is not part of any family'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: family
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  async getUserPermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { familyId } = req.params;
      
      // Verify user belongs to this family
      const userFamily = await this.familyService.getUserFamily(req.user.id);
      
      if (!userFamily || userFamily.id !== familyId) {
        res.status(403).json({
          success: false,
          error: 'Access denied: not a member of this family'
        });
        return;
      }

      const permissions = await this.familyAuthService.getUserPermissions(req.user.id);

      res.status(200).json({
        success: true,
        data: permissions
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  async updateMemberRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { memberId } = req.params;
      const { role } = req.body;

      // Validate role
      if (!Object.values(FamilyRole).includes(role)) {
        res.status(400).json({
          success: false,
          error: 'Invalid role'
        });
        return;
      }

      // Check permissions (only admins can change roles)
      await this.familyAuthService.requireFamilyRole(req.user.id, FamilyRole.ADMIN);

      await this.familyService.updateMemberRole(req.user.id, memberId, role);

      res.status(200).json({
        success: true,
        message: 'Member role updated successfully'
      });
    } catch (error) {
      const statusCode = (error as Error).message.includes('INSUFFICIENT_PERMISSIONS') ? 403 : 400;
      res.status(statusCode).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  async generateInviteCode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check permissions (only admins can generate invite codes)
      await this.familyAuthService.requireFamilyRole(req.user.id, FamilyRole.ADMIN);

      // NOTE: Permanent invite codes are deprecated as per unified invitation system
      throw new Error('Permanent invite codes are no longer supported. Use invitation system instead.');
    } catch (error) {
      const statusCode = (error as Error).message.includes('INSUFFICIENT_PERMISSIONS') ? 403 : 400;
      res.status(statusCode).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  async inviteMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { familyId } = req.params;
      const { email, role, personalMessage, platform } = req.body;

      // Validate input
      if (!email) {
        res.status(400).json({
          success: false,
          error: 'Email is required'
        });
        return;
      }

      // Validate role if provided
      if (role && !Object.values(FamilyRole).includes(role)) {
        res.status(400).json({
          success: false,
          error: 'Invalid role'
        });
        return;
      }

      // Verify user belongs to this family and has admin permissions
      const userFamily = await this.familyService.getUserFamily(req.user.id);
      
      if (!userFamily || userFamily.id !== familyId) {
        res.status(403).json({
          success: false,
          error: 'Access denied: not a member of this family'
        });
        return;
      }

      // Check permissions (only admins can invite members)
      await this.familyAuthService.requireFamilyRole(req.user.id, FamilyRole.ADMIN);

      const invitation = await this.familyService.inviteMember(familyId, {
        email,
        role: role || FamilyRole.MEMBER,
        personalMessage
      }, req.user.id, platform || 'web');

      res.status(201).json({
        success: true,
        data: invitation,
        message: 'Invitation sent successfully'
      });
    } catch (error) {
      console.error('Family invitation error:', error);
      const statusCode = (error as Error).message.includes('INSUFFICIENT_PERMISSIONS') ? 403 : 400;
      res.status(statusCode).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  async getPendingInvitations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { familyId } = req.params;

      // Verify user belongs to this family
      const userFamily = await this.familyService.getUserFamily(req.user.id);
      
      if (!userFamily || userFamily.id !== familyId) {
        res.status(403).json({
          success: false,
          error: 'Access denied: not a member of this family'
        });
        return;
      }

      const invitations = await this.familyService.getPendingInvitations(familyId);

      res.status(200).json({
        success: true,
        data: invitations
      });
    } catch (error) {
      console.error('Get pending invitations error:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  async cancelInvitation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { familyId, invitationId } = req.params;

      // Verify user belongs to this family
      const userFamily = await this.familyService.getUserFamily(req.user.id);
      
      if (!userFamily || userFamily.id !== familyId) {
        res.status(403).json({
          success: false,
          error: 'Access denied: not a member of this family'
        });
        return;
      }

      // Check permissions (only admins can cancel invitations)
      await this.familyAuthService.requireFamilyRole(req.user.id, FamilyRole.ADMIN);

      await this.familyService.cancelInvitation(familyId, invitationId, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Invitation cancelled successfully'
      });
    } catch (error) {
      console.error('Cancel invitation error:', error);
      const statusCode = (error as Error).message.includes('INSUFFICIENT_PERMISSIONS') ? 403 : 400;
      res.status(statusCode).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  async updateFamilyName(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name } = req.body;
      console.log(`FamilyController.updateFamilyName called with name: "${name}" by user: ${req.user.id}`);

      if (!name || name.trim().length === 0) {
        console.log('Validation failed: Family name is required');
        res.status(400).json({
          success: false,
          error: 'Family name is required'
        });
        return;
      }

      if (name.trim().length > 100) {
        console.log(`Validation failed: Family name too long (${name.trim().length} characters)`);
        res.status(400).json({
          success: false,
          error: 'Family name must be 100 characters or less'
        });
        return;
      }

      console.log('Controller validation passed, checking permissions...');
      // Check permissions (only admins can update family name)
      await this.familyAuthService.requireFamilyRole(req.user.id, FamilyRole.ADMIN);
      console.log('Permissions check passed, calling service...');

      const updatedFamily = await this.familyService.updateFamilyName(req.user.id, name.trim());
      console.log('Service call successful, sending response');

      res.status(200).json({
        success: true,
        data: updatedFamily,
        message: 'Family name updated successfully'
      });
    } catch (error) {
      console.error('FamilyController.updateFamilyName error:', error);
      const statusCode = (error as Error).message.includes('INSUFFICIENT_PERMISSIONS') ? 403 : 400;
      res.status(statusCode).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  async removeMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { familyId, memberId } = req.params;

      // Verify user belongs to this family
      const userFamily = await this.familyService.getUserFamily(req.user.id);
      
      if (!userFamily || userFamily.id !== familyId) {
        res.status(403).json({
          success: false,
          error: 'Access denied: not a member of this family'
        });
        return;
      }

      // Check permissions (only admins can remove members)
      await this.familyAuthService.requireFamilyRole(req.user.id, FamilyRole.ADMIN);

      await this.familyService.removeMember(req.user.id, memberId);

      res.status(200).json({
        success: true,
        message: 'Member removed successfully'
      });
    } catch (error) {
      console.error('Remove member error:', error);
      const statusCode = (error as Error).message.includes('INSUFFICIENT_PERMISSIONS') ? 403 : 400;
      res.status(statusCode).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  async validateInviteCode(req: Request, res: Response): Promise<void> {
    try {
      const { inviteCode } = req.body;

      if (!inviteCode || typeof inviteCode !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Invite code is required'
        });
        return;
      }

      // Try to find the family with this invite code
      const family = await this.familyService.validateInviteCode(inviteCode.trim().toUpperCase());

      if (family) {
        res.status(200).json({
          success: true,
          data: {
            valid: true,
            family: {
              id: family.id,
              name: family.name
            }
          }
        });
      } else {
        res.status(400).json({
          success: false,
          data: {
            valid: false
          },
          error: 'Invalid or expired invite code'
        });
      }
    } catch (error) {
      console.error('Validate invite code error:', error);
      res.status(400).json({
        success: false,
        data: {
          valid: false
        },
        error: (error as Error).message
      });
    }
  }

  async leaveFamily(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await this.familyService.leaveFamily(req.user.id);

      res.status(200).json({
        success: true,
        data: {
          message: 'Successfully left the family'
        }
      });
    } catch (error) {
      console.error('Leave family error:', error);
      
      // Handle specific business rule errors
      if (error instanceof Error && error.message.includes('LAST_ADMIN')) {
        res.status(400).json({
          success: false,
          error: 'Cannot leave family as you are the last administrator. Please appoint another admin first.'
        });
        return;
      }

      if (error instanceof Error && error.message.includes('NOT_FAMILY_MEMBER')) {
        res.status(400).json({
          success: false,
          error: 'You are not a member of any family'
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to leave family'
      });
    }
  }

}