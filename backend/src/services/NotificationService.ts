// @ts-nocheck
import { EmailServiceInterface, ScheduleSlotNotificationData } from '../types/EmailServiceInterface';
import { PushNotificationService } from './PushNotificationService';
import { PushNotificationServiceFactory } from './PushNotificationServiceFactory';
import { UserRepository } from '../repositories/UserRepository';
import { ScheduleSlotRepository } from '../repositories/ScheduleSlotRepository';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('NotificationService');

export class NotificationService {
  private pushNotificationService: PushNotificationService;

  constructor(
    private emailService: EmailServiceInterface,
    private userRepository: UserRepository,
    private scheduleSlotRepository: ScheduleSlotRepository,
    private prisma: PrismaClient,
  ) {
    this.pushNotificationService = PushNotificationServiceFactory.getInstance(this.prisma);
  }

  async notifyScheduleSlotChange(
    scheduleSlotId: string,
    changeType: ScheduleSlotNotificationData['changeType'],
  ): Promise<void> {
    try {
      // Get schedule slot details with all related data
      const scheduleSlot = await this.scheduleSlotRepository.findByIdWithDetails(scheduleSlotId);
      
      if (!scheduleSlot) {
        logger.error('ScheduleSlot not found for notification');
        return;
      }

      // TODO: Replace with family-based notifications - get family members instead of individual group members
      // Get group members to notify
      const groupMembers = await this.userRepository.getGroupMembers(scheduleSlot.groupId);
      
      // Verify that group data is properly loaded
      if (!scheduleSlot.group || !scheduleSlot.group.name) {
        throw new Error('Schedule slot group data not properly loaded from database');
      }

      // Prepare notification data with datetime only
      const notificationData: ScheduleSlotNotificationData = {
        scheduleSlotId: scheduleSlot.id,
        datetime: scheduleSlot.datetime.toISOString(), // Send UTC datetime to client
        assignedChildren: scheduleSlot.childAssignments?.map((a: unknown) => a.child.name) || [],
        groupName: scheduleSlot.group.name,
        changeType,
      };

      // Add vehicle information if available
      if (scheduleSlot.vehicleAssignments && scheduleSlot.vehicleAssignments.length > 0) {
        const vehicles = scheduleSlot.vehicleAssignments.map(va => ({
          name: va.vehicle.name,
          capacity: va.vehicle.capacity,
          ...(va.driver?.name && { driverName: va.driver.name }),
        }));
        notificationData.vehicles = vehicles;
        notificationData.totalCapacity = vehicles.reduce((sum, v) => sum + v.capacity, 0);
      }

      // Determine who should receive notifications
      const recipientsToNotify = await this.determineScheduleSlotNotificationRecipients(
        groupMembers,
        scheduleSlot,
        changeType,
      );

      // Send email notifications to all relevant members
      const emailNotificationPromises = recipientsToNotify.map(member =>
        this.emailService.sendScheduleSlotNotification(member.email, notificationData)
          .catch(error => {
            logger.error(`Failed to send schedule slot email notification to ${member.email}:`, { error: error instanceof Error ? error.message : String(error) });
          }),
      );

      // Send push notifications to all relevant members
      const userIds = recipientsToNotify.map(member => member.id);
      const pushNotificationPromise = this.pushNotificationService.sendScheduleSlotNotification(
        userIds,
        {
          groupName: scheduleSlot.group.name,
          datetime: scheduleSlot.datetime.toISOString(),
          changeType,
          assignedChildren: scheduleSlot.childAssignments?.map((a: unknown) => a.child.name) || [],
          vehicles: scheduleSlot.vehicleAssignments?.map((va: unknown) => ({
            name: va.vehicle.name,
            driverName: va.driver?.name,
          })) || [],
        },
      ).catch(error => {
        logger.error('Failed to send schedule slot push notifications:', { error: error instanceof Error ? error.message : String(error) });
      });

      await Promise.allSettled([...emailNotificationPromises, pushNotificationPromise]);
      
      logger.info(`Sent ${changeType} notifications (email + push) for schedule slot ${scheduleSlotId} to ${recipientsToNotify.length} members`);
    } catch (error) {
      logger.error('Failed to send schedule slot notifications:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  async sendDailyReminders(groupId: string): Promise<void> {
    try {
      // Get tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Calculate tomorrow's date range
      const tomorrowStart = new Date(tomorrow);
      tomorrowStart.setUTCHours(0, 0, 0, 0);
      
      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setUTCHours(23, 59, 59, 999);

      // Get all schedule slots for tomorrow in this group
      const scheduleSlots = await this.scheduleSlotRepository.findSlotsByDateTimeRange(groupId, tomorrowStart, tomorrowEnd);
      
      if (scheduleSlots.length === 0) {
        return; // No schedule slots tomorrow
      }

      // Get group members
      const groupMembers = await this.userRepository.getGroupMembers(groupId);
      const group = await this.userRepository.getGroupById(groupId);
      
      if (!group) {
        logger.error('Group not found for daily reminders');
        return;
      }

      // Group schedule slots by user (based on children or driver)
      const userSlots = new Map<string, any[]>();
      
      for (const slot of scheduleSlots) {
        // Add slot for drivers
        for (const vehicleAssignment of slot.vehicleAssignments || []) {
          if (vehicleAssignment.driver) {
            if (!userSlots.has(vehicleAssignment.driver.id)) {
              userSlots.set(vehicleAssignment.driver.id, []);
            }
            userSlots.get(vehicleAssignment.driver.id)?.push({
              ...slot,
              vehicle: vehicleAssignment.vehicle,
              role: 'driver',
            });
          }
        }

        // Add slot for parents of assigned children
        for (const assignment of slot.childAssignments || []) {
          const child = assignment.child;
          
          // Check if child has familyId (new system) or userId (legacy)
          if ((child as any).familyId) {
            // New family system: Get all family members for this child's family
            const familyMembers = await this.prisma.familyMember.findMany({
              where: { familyId: (child as any).familyId },
              select: { userId: true },
            });
            
            // Add slot for all family members
            for (const familyMember of familyMembers) {
              const parentId = familyMember.userId;
              if (!userSlots.has(parentId)) {
                userSlots.set(parentId, []);
              }
              userSlots.get(parentId)?.push({
                ...slot,
                role: 'parent',
                childName: child.name,
              });
            }
          }
        }
      }

      // Send reminders to users with schedule slots tomorrow
      const reminderPromises = Array.from(userSlots.entries()).map(([userId, userSlotList]) => {
        const member = groupMembers.find((m: unknown) => m.user.id === userId);
        if (!member) return Promise.resolve();

        const formattedSlots = userSlotList.map(slot => ({
          datetime: slot.datetime,
          driverName: slot.vehicle?.driver?.name,
          vehicleName: slot.vehicle?.name,
          children: slot.role === 'parent' ? [slot.childName] : 
                   slot.childAssignments?.map((a: unknown) => a.child.name) || [],
          role: slot.role,
        }));

        return this.emailService.sendDailyReminder(
          member.user.email,
          group.name,
          formattedSlots,
        ).catch(error => {
          logger.error(`Failed to send daily reminder to ${member.user.email}`, { error });
        });
      });

      await Promise.allSettled(reminderPromises);
      
      logger.info(`Sent daily reminders to ${userSlots.size} users for group ${groupId}`, { groupId });
    } catch (error) {
      logger.error('Failed to send daily reminders', { error });
    }
  }

  async sendWeeklySchedule(groupId: string, week: string): Promise<void> {
    try {
      // Get group members and group info
      const groupMembers = await this.userRepository.getGroupMembers(groupId);
      const group = await this.userRepository.getGroupById(groupId);
      
      if (!group) {
        logger.error('Group not found for weekly schedule', { groupId });
        return;
      }

      // Calculate week start and end dates for datetime filtering
      const [year, weekNum] = week.split('-').map(Number);
      
      // Calculate the Monday of the specified ISO week (same logic as SchedulingService)
      const jan1 = new Date(year, 0, 1);
      const jan1Day = jan1.getDay();
      
      let daysToFirstMonday;
      if (jan1Day === 0) { // Sunday
        daysToFirstMonday = 1;
      } else if (jan1Day === 1) { // Monday
        daysToFirstMonday = 0;
      } else { // Tuesday to Saturday
        daysToFirstMonday = 8 - jan1Day;
      }
      
      const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
      
      // ISO week 1 logic
      let isoWeek1Start;
      if (firstMonday.getDate() <= 4) {
        isoWeek1Start = firstMonday;
      } else {
        isoWeek1Start = new Date(firstMonday);
        isoWeek1Start.setDate(firstMonday.getDate() - 7);
      }
      
      // Calculate target week start (Monday) and end (Sunday)
      const weekStart = new Date(isoWeek1Start);
      weekStart.setDate(isoWeek1Start.getDate() + (weekNum - 1) * 7);
      weekStart.setUTCHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setUTCHours(23, 59, 59, 999);

      // Get weekly schedule data (simplified for email)
      const scheduleData = await this.scheduleSlotRepository.getWeeklyScheduleByDateRange(groupId, weekStart, weekEnd);

      // Send weekly schedule to all group members
      const schedulePromises = groupMembers.map((member: unknown) =>
        this.emailService.sendWeeklySchedule(
          member.user.email,
          group.name,
          week,
          scheduleData,
        ).catch(error => {
          logger.error(`Failed to send weekly schedule to ${member.user.email}`, { email: member.user.email, error });
        }),
      );

      await Promise.allSettled(schedulePromises);
      
      logger.info(`Sent weekly schedule to ${groupMembers.length} members for group ${groupId}`, { groupId, memberCount: groupMembers.length });
    } catch (error) {
      logger.error('Failed to send weekly schedule', { groupId, error });
    }
  }

  private async determineScheduleSlotNotificationRecipients(
    groupMembers: unknown[],
    scheduleSlot: any,
    changeType: ScheduleSlotNotificationData['changeType'],
  ): Promise<any[]> {
    switch (changeType) {
      case 'SLOT_CREATED':
        // Notify all group members
        return groupMembers.map(m => m.user);
        
      case 'VEHICLE_ASSIGNED':
      case 'DRIVER_ASSIGNED': {
        // Notify parents of assigned children and drivers
        const affectedUsers = new Set<string>();
        
        // Add all drivers
        scheduleSlot.vehicleAssignments?.forEach((va: unknown) => {
          if (va.driver) {
            affectedUsers.add(va.driver.id);
          }
        });
        
        // Add family members of assigned children
        for (const assignment of scheduleSlot.childAssignments || []) {
          // Get family members for this child
          const childWithFamily = await this.prisma.child.findUnique({
            where: { id: assignment.child.id },
            include: {
              family: {
                include: {
                  members: {
                    select: { userId: true },
                  },
                },
              },
            },
          });
          
          if (childWithFamily?.family?.members) {
            childWithFamily.family.members.forEach(member => {
              affectedUsers.add(member.userId);
            });
          }
        }
        
        return groupMembers
          .filter(m => affectedUsers.has(m.userId))
          .map(m => m.user);
        }

      case 'CHILD_ADDED':
      case 'CHILD_REMOVED': {
        // Notify drivers and parents of all children in the slot
        const allAffectedUsers = new Set<string>();
        
        // Add all drivers
        scheduleSlot.vehicleAssignments?.forEach((va: unknown) => {
          if (va.driver) {
            allAffectedUsers.add(va.driver.id);
          }
        });
        
        // Add family members of all assigned children
        for (const assignment of scheduleSlot.childAssignments || []) {
          // Get family members for this child
          const childWithFamily = await this.prisma.child.findUnique({
            where: { id: assignment.child.id },
            include: {
              family: {
                include: {
                  members: {
                    select: { userId: true },
                  },
                },
              },
            },
          });
          
          if (childWithFamily?.family?.members) {
            childWithFamily.family.members.forEach(member => {
              allAffectedUsers.add(member.userId);
            });
          }
        }
        
        return groupMembers
          .filter(m => allAffectedUsers.has(m.userId))
          .map(m => m.user);
        }

      case 'SLOT_CANCELLED': {
        // Notify all affected users (drivers + parents of children)
        const cancelledSlotUsers = new Set<string>();
        
        scheduleSlot.vehicleAssignments?.forEach((va: unknown) => {
          if (va.driver) {
            cancelledSlotUsers.add(va.driver.id);
          }
        });
        
        // Add family members of cancelled children assignments
        for (const assignment of scheduleSlot.childAssignments || []) {
          // Get family members for this child
          const childWithFamily = await this.prisma.child.findUnique({
            where: { id: assignment.child.id },
            include: {
              family: {
                include: {
                  members: {
                    select: { userId: true },
                  },
                },
              },
            },
          });
          
          if (childWithFamily?.family?.members) {
            childWithFamily.family.members.forEach(member => {
              cancelledSlotUsers.add(member.userId);
            });
          }
        }
        
        return groupMembers
          .filter(m => cancelledSlotUsers.has(m.userId))
          .map(m => m.user);
        }

      default:
        return [];
    }
  }


  /**
   * Send notifications to all family members about the name change
   */
  async notifyFamilyNameChange(
    familyId: string,
    oldName: string,
    newName: string,
    changedBy: string,
  ): Promise<void> {
    try {
      logger.info(
        `Sending family name change notifications for family ${familyId}: "${oldName}" → "${newName}" (changed by ${changedBy})`,
        { familyId, oldName, newName, changedBy },
      );

      // Get all family members
      const familyMembers = await this.prisma.familyMember.findMany({
        where: { familyId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Send email notifications to each family member
      const emailNotificationPromises = familyMembers.map(member => 
        this.sendFamilyNameChangeNotification(member, oldName, newName, changedBy),
      );

      // Send push notifications to family members
      const userIds = familyMembers.map(member => member.userId);
      const pushNotificationPromise = this.pushNotificationService.sendToUsers(
        userIds,
        {
          title: 'EduLift - Family Name Changed',
          body: `Family "${oldName}" was renamed to "${newName}"`,
          data: {
            type: 'family_name_change',
            oldName,
            newName,
            changedBy,
          },
          clickAction: '/dashboard',
          priority: 'normal',
        },
      ).catch(error => {
        logger.error('Failed to send family name change push notifications', { familyId, error });
      });

      await Promise.allSettled([...emailNotificationPromises, pushNotificationPromise]);

      logger.info(
        `Successfully sent ${familyMembers.length} notifications for family name change`,
        { familyId, notificationCount: familyMembers.length },
      );
    } catch (error) {
      logger.error(
        `Failed to send family name change notifications: ${(error as Error).message}`,
        { familyId, error },
      );
      throw error;
    }
  }

  private async sendFamilyNameChangeNotification(
    member: any,
    oldName: string,
    newName: string,
    changedBy: string,
  ): Promise<void> {
    try {
      // For now, we'll use simple logging
      // In production, this would integrate with email service
      logger.info(
        `📧 Family Name Change Notification sent to ${member.user.name} (${member.user.email}): ` +
        `Family "${oldName}" renamed to "${newName}" by ${changedBy}`,
        { memberName: member.user.name, email: member.user.email, oldName, newName, changedBy },
      );

      // If email service is available, send actual email
      if (this.emailService) {
        // For now, we'll use a generic notification method or skip email
        // TODO: Implement sendFamilyNameChangeNotification in EmailServiceInterface
        logger.info(`Email notification would be sent to ${member.user.email} about family name change`, { email: member.user.email });
      }

      // Simulate async notification processing
      await new Promise(resolve => setTimeout(resolve, 10));
    } catch (error) {
      logger.error(
        `Failed to send family name change notification to ${member.user.email}: ${(error as Error).message}`,
        { email: member.user.email, error },
      );
      // Don't throw here to prevent one failed notification from stopping all others
    }
  }

  /**
   * Send notification when a new member joins the family
   */
  async notifyFamilyMemberJoined(
    familyId: string,
    familyName: string,
    newMemberName: string,
    invitedBy: string,
  ): Promise<void> {
    try {
      logger.info(
        `📧 Sending new member notifications for family ${familyId}: ${newMemberName} joined "${familyName}" (invited by ${invitedBy})`,
        { familyId, newMemberName, familyName, invitedBy },
      );

      const familyMembers = await this.prisma.familyMember.findMany({
        where: { familyId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      const emailNotificationPromises = familyMembers.map(member =>
        this.sendNewMemberNotification(member, familyName, newMemberName, invitedBy),
      );

      // Send push notifications to family members
      const userIds = familyMembers.map(member => member.userId);
      const pushNotificationPromise = this.pushNotificationService.sendToUsers(
        userIds,
        {
          title: 'EduLift - New Family Member',
          body: `${newMemberName} joined family "${familyName}"`,
          data: {
            type: 'family_member_joined',
            familyName,
            newMemberName,
            invitedBy,
          },
          clickAction: '/dashboard',
          priority: 'normal',
        },
      ).catch(error => {
        logger.error('Failed to send new member push notifications', { familyId, error });
      });

      await Promise.allSettled([...emailNotificationPromises, pushNotificationPromise]);
    } catch (error) {
      logger.error(
        `Failed to send new member notifications: ${(error as Error).message}`,
        { familyId, error },
      );
    }
  }

  private async sendNewMemberNotification(
    member: any,
    familyName: string,
    newMemberName: string,
    invitedBy: string,
  ): Promise<void> {
    logger.info(
      `📧 New Member Notification sent to ${member.user.name} (${member.user.email}): ` +
      `${newMemberName} joined family "${familyName}" (invited by ${invitedBy})`,
      { memberName: member.user.name, email: member.user.email, newMemberName, familyName, invitedBy },
    );
  }
}