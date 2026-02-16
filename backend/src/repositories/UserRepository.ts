import { PrismaClient } from '@prisma/client';
import { getValidatedTimezone } from '../utils/timezoneUtils';

export interface User {
  id: string;
  email: string;
  name: string;
  timezone: string; // IANA timezone
  createdAt: Date;
  updatedAt: Date;
}
import { CreateUserData, UpdateProfileData } from '../types';

export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: CreateUserData): Promise<User> {
    // Validate and set timezone (defaults to UTC if not provided or invalid)
    const validatedTimezone = getValidatedTimezone(data.timezone);

    return this.prisma.user.create({
      data: {
        ...data,
        timezone: validatedTimezone,
      },
    });
  }

  async update(id: string, data: Partial<CreateUserData> | UpdateProfileData): Promise<User> {
    // Filter out undefined values
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined),
    );

    // Validate timezone if provided
    if (updateData.timezone) {
      updateData.timezone = getValidatedTimezone(updateData.timezone as string);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
  }

  async findGroupMembers(groupId: string): Promise<User[]> {
    // Get all users from families that have access to this group (including owner family)
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        familyMembers: {
          include: {
            family: {
              include: {
                members: {
                  include: { user: true },
                },
              },
            },
          },
        },
      },
    });

    if (!group) return [];

    const users: User[] = [];

    // Add all family members (owner family is now included in familyMembers)
    group.familyMembers.forEach((familyMember: { family: { members: { user: User }[] } }) => {
      familyMember.family.members.forEach((member: { user: User }) => {
        users.push(member.user);
      });
    });

    return users;
  }

  async getUserGroups(userId: string): Promise<unknown> {
    // Get user's family first
    const userFamily = await this.prisma.familyMember.findFirst({
      where: { userId },
      select: { familyId: true },
    });

    if (!userFamily) return [];

    // Get all groups where the user's family has access (including owned groups)
    return this.prisma.group.findMany({
      where: {
        familyMembers: {
          some: { familyId: userFamily.familyId },
        },
      },
      include: {
        _count: {
          select: {
            familyMembers: true,
            scheduleSlots: true,
          },
        },
      },
    });
  }

  // TODO: Remove this method once NotificationService is refactored to use family-based approach
  async getGroupMembers(groupId: string): Promise<unknown> {
    // Temporary implementation for backward compatibility
    // Use the findGroupMembers method and transform to match expected format
    const users = await this.findGroupMembers(groupId);
    return users.map((user: unknown) => ({
      user,
      // Note: This is a simplified mapping - role information is at family level now
      role: 'MEMBER', // Default role, actual role checking should be done at family level
    }));
  }

  async getGroupById(groupId: string): Promise<unknown> {
    return this.prisma.group.findUnique({
      where: { id: groupId },
    });
  }
}