import { PrismaClient, FamilyRole } from '@prisma/client';
import { FamilyError } from '../types/family';

interface Logger {
  info(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
}

export interface MigrationResult {
  totalUsers: number;
  familiesCreated: number;
  childrenMigrated: number;
  vehiclesMigrated: number;
  errors: string[];
}

export class FamilyMigrationService {
  constructor(
    private prisma: PrismaClient,
    private logger: Logger
  ) {}

  async migrateExistingUsersToFamilies(): Promise<MigrationResult> {
    this.logger.info('Starting family migration for existing users');
    
    const result: MigrationResult = {
      totalUsers: 0,
      familiesCreated: 0,
      childrenMigrated: 0,
      vehiclesMigrated: 0,
      errors: []
    };

    try {
      return await this.prisma.$transaction(async (tx: any) => {
        // Get all users
        const users = await tx.user.findMany({
          include: {
            children: true,
            vehicles: true
          }
        });

        result.totalUsers = users.length;
        this.logger.info(`Found ${users.length} users to migrate`);

        for (const user of users) {
          try {
            // Check if user already has a family
            const existingMembership = await tx.familyMember.findFirst({
              where: { userId: user.id }
            });

            if (existingMembership) {
              this.logger.warn(`User ${user.id} already has family membership, skipping`);
              continue;
            }

            // Create family for user
            const family = await tx.family.create({
              data: {
                name: `Famille ${user.name}`,
                // Note: No more permanent inviteCode as per unified invitation system
              }
            });

            // Add user as admin
            await tx.familyMember.create({
              data: {
                familyId: family.id,
                userId: user.id,
                role: FamilyRole.ADMIN
              }
            });

            result.familiesCreated++;

            // Migrate children
            if (user.children.length > 0) {
              await tx.child.updateMany({
                where: { userId: user.id },
                data: { familyId: family.id }
              });
              result.childrenMigrated += user.children.length;
            }

            // Migrate vehicles
            if (user.vehicles.length > 0) {
              await tx.vehicle.updateMany({
                where: { userId: user.id },
                data: { familyId: family.id }
              });
              result.vehiclesMigrated += user.vehicles.length;
            }

            this.logger.info(`Migrated user ${user.id} with ${user.children.length} children and ${user.vehicles.length} vehicles`);

          } catch (error) {
            const errorMsg = `Failed to migrate user ${user.id}: ${error}`;
            this.logger.error(errorMsg);
            result.errors.push(errorMsg);
          }
        }

        this.logger.info('Family migration completed', result);
        return result;
      });

    } catch (error) {
      const errorMsg = `Migration transaction failed: ${error}`;
      this.logger.error(errorMsg);
      result.errors.push(errorMsg);
      throw new FamilyError('MIGRATION_FAILED', errorMsg);
    }
  }

  async rollbackMigration(): Promise<MigrationResult> {
    this.logger.info('Starting family migration rollback');
    
    const result: MigrationResult = {
      totalUsers: 0,
      familiesCreated: 0,
      childrenMigrated: 0,
      vehiclesMigrated: 0,
      errors: []
    };

    try {
      return await this.prisma.$transaction(async (tx: any) => {
        // Get all families
        const families = await tx.family.findMany({
          include: {
            members: true,
            children: true,
            vehicles: true
          }
        });

        for (const family of families) {
          try {
            // Find the admin (original owner)
            const admin = family.members.find((m: any) => m.role === FamilyRole.ADMIN);
            if (!admin) {
              result.errors.push(`No admin found for family ${family.id}`);
              continue;
            }

            // Restore children to admin
            if (family.children.length > 0) {
              await tx.child.updateMany({
                where: { familyId: family.id },
                data: { 
                  userId: admin.userId,
                  familyId: null 
                }
              });
              result.childrenMigrated += family.children.length;
            }

            // Restore vehicles to admin
            if (family.vehicles.length > 0) {
              await tx.vehicle.updateMany({
                where: { familyId: family.id },
                data: { 
                  userId: admin.userId,
                  familyId: null 
                }
              });
              result.vehiclesMigrated += family.vehicles.length;
            }

            result.totalUsers += family.members.length;

          } catch (error) {
            const errorMsg = `Failed to rollback family ${family.id}: ${error}`;
            this.logger.error(errorMsg);
            result.errors.push(errorMsg);
          }
        }

        // Delete all family data
        await tx.familyMember.deleteMany({});
        await tx.family.deleteMany({});
        result.familiesCreated = -families.length; // Negative to indicate deletion

        this.logger.info('Family migration rollback completed', result);
        return result;
      });

    } catch (error) {
      const errorMsg = `Rollback transaction failed: ${error}`;
      this.logger.error(errorMsg);
      result.errors.push(errorMsg);
      throw new FamilyError('ROLLBACK_FAILED', errorMsg);
    }
  }

  async validateMigration(): Promise<boolean> {
    try {
      // Check that all users have families
      const usersWithoutFamilies = await this.prisma.user.findMany({
        where: {
          familyMemberships: {
            none: {}
          }
        }
      });

      if (usersWithoutFamilies.length > 0) {
        this.logger.warn(`Found ${usersWithoutFamilies.length} users without families`);
        return false;
      }

      // Check that all children have families
      const childrenWithoutFamilies = await this.prisma.child.findMany({
        where: {
          familyId: ''
        }
      });

      if (childrenWithoutFamilies.length > 0) {
        this.logger.warn(`Found ${childrenWithoutFamilies.length} children without families`);
        return false;
      }

      // Check that all vehicles have families
      const vehiclesWithoutFamilies = await this.prisma.vehicle.findMany({
        where: {
          familyId: ''
        }
      });

      if (vehiclesWithoutFamilies.length > 0) {
        this.logger.warn(`Found ${vehiclesWithoutFamilies.length} vehicles without families`);
        return false;
      }

      this.logger.info('Migration validation passed');
      return true;

    } catch (error) {
      this.logger.error(`Migration validation failed: ${error}`);
      return false;
    }
  }
}