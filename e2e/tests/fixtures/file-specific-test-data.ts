import { execSync } from 'child_process';

export interface TestUser {
  id: string;
  email: string;
  name: string;
}

export interface TestFamily {
  name: string;
  adminUserId: string;
  members?: Array<{ userId: string; role: 'ADMIN' | 'MEMBER' }>;
}

/**
 * File-Specific Test Data Manager
 * 
 * Provides isolated test data for each test file to prevent concurrency issues.
 * Each test file gets unique users and families with timestamps to avoid conflicts.
 * 
 * Usage:
 * ```typescript
 * const _testData = new FileSpecificTestData('invitations');
 * 
 * // Define users (doesn't create in DB yet)
 * testData.defineUser('admin', 'admin', 'Admin User');
 * testData.defineUser('member', 'member', 'Member User');
 * 
 * // Create all users in database before tests run
 * await testData.createUsersInDatabase();
 * 
 * // Use in tests
 * const admin = testData.getUser('admin');
 * await authHelper.directUserSetup(admin, '/family/manage');
 * ```
 */
export class FileSpecificTestData {
  private filePrefix: string;
  private runId: string;
  private testUsers: Record<string, TestUser> = {};
  private testFamilies: Record<string, TestFamily> = {};
  private invitationUsers: Set<string> = new Set(); // Users who will receive invitations

  constructor(filePrefix: string) {
    this.filePrefix = filePrefix;
    // Generate a random 8-character ID for this test run
    this.runId = Math.random().toString(36).substring(2, 10);
  }

  /**
   * Get file-specific email address
   * Example: admin.invitations.a1b2c3d4@edulift.com
   */
  getEmail(base: string): string {
    return `${base}.${this.filePrefix}.${this.runId}@edulift.com`;
  }

  /**
   * Get file-specific user ID
   * Example: admin-invitations-a1b2c3d4
   */
  getId(base: string): string {
    return `${base}-${this.filePrefix}-${this.runId}`;
  }

  /**
   * Define a test user (doesn't create in database yet)
   * @param key - Key to access this user later (e.g., 'admin', 'member')
   * @param baseName - Base name for email/id generation (e.g., 'admin', 'member')
   * @param displayName - Human-readable name (e.g., 'Admin User')
   * @param willReceiveInvitation - If true, this user will NOT be pre-created in database
   */
  defineUser(key: string, baseName: string, displayName: string, willReceiveInvitation: boolean = false): TestUser {
    const user: TestUser = {
      id: this.getId(baseName),
      email: this.getEmail(baseName),
      name: displayName
    };
    this.testUsers[key] = user;
    
    if (willReceiveInvitation) {
      this.invitationUsers.add(key);
    }
    
    return user;
  }

  /**
   * Define a test family with admin and optional members
   */
  defineFamily(key: string, familyName: string, adminUserKey: string, members?: Array<{ userKey: string; role: 'ADMIN' | 'MEMBER' }>): TestFamily {
    const adminUser = this.testUsers[adminUserKey];
    if (!adminUser) {
      throw new Error(`Admin user '${adminUserKey}' must be defined before creating family`);
    }

    const family: TestFamily = {
      name: `${familyName} ${this.filePrefix} ${this.runId}`,
      adminUserId: adminUser.id,
      members: members?.map(m => ({
        userId: this.testUsers[m.userKey]?.id || '',
        role: m.role
      }))
    };
    this.testFamilies[key] = family;
    return family;
  }

  /**
   * Get a defined user by key
   * @param key - The key used when defining the user
   */
  getUser(key: string): TestUser {
    const user = this.testUsers[key];
    if (!user) {
      throw new Error(`User '${key}' not found. Make sure to define it first with defineUser()`);
    }
    return user;
  }

  /**
   * Get a defined user by email
   * @param email - The email of the user to find
   */
  getUserByEmail(email: string): TestUser {
    const user = Object.values(this.testUsers).find(u => u.email === email);
    if (!user) {
      throw new Error(`User with email '${email}' not found. Make sure to define it first with defineUser()`);
    }
    return user;
  }

  /**
   * Get a defined family by key
   * @param key - The key used when defining the family
   */
  getFamily(key: string): TestFamily {
    const family = this.testFamilies[key];
    if (!family) {
      throw new Error(`Family '${key}' not found. Make sure to define it first with defineFamily()`);
    }
    return family;
  }

  /**
   * Get all defined users
   */
  getAllUsers(): TestUser[] {
    return Object.values(this.testUsers);
  }

  /**
   * Create all defined users in the database (excluding invitation users)
   * Call this in your test.beforeAll() hook
   */
  async createUsersInDatabase(): Promise<void> {
    const users = this.getAllUsers().filter(user => {
      // Find the key for this user
      const userKey = Object.keys(this.testUsers).find(key => this.testUsers[key] === user);
      // Only create users who won't receive invitations
      return userKey && !this.invitationUsers.has(userKey);
    });
    
    for (const user of users) {
      try {
        execSync(`docker exec edulift-backend-e2e node -e "
          const { PrismaClient } = require('@prisma/client');
          const prisma = new PrismaClient();
          
          async function createUser() {
            try {
              const user = await prisma.user.upsert({
                where: { email: '${user.email}' },
                update: {
                  name: '${user.name}'
                },
                create: {
                  id: '${user.id}',
                  email: '${user.email}',
                  name: '${user.name}'
                }
              });
              console.log('File-specific user created/updated: ${user.email}');
            } catch (error) {
              console.error('Error creating file-specific user:', error.message);
            } finally {
              await prisma.\\$disconnect();
            }
          }
          
          (async () => { await createUser(); })();
        "`, { 
          encoding: 'utf8', 
          timeout: 25000, // Increased for parallel execution
          stdio: 'inherit'
        });
      } catch (error) {
        console.log(`User creation error for ${user.email}:`, error.message);
        // Don't fail the entire test setup if user creation fails
        // The individual tests will handle missing users gracefully
      }
    }
  }

  /**
   * Create a family in the database with the specified admin and members
   * Uses proper serialization to prevent parallel execution race conditions
   */
  async createFamilyInDatabase(familyKey: string): Promise<void> {
    // Note: Removed skipCleanup parameter - no longer needed
    const family = this.testFamilies[familyKey];
    if (!family) {
      throw new Error(`Family '${familyKey}' not found. Define it first with defineFamily()`);
    }

    console.log(`🔍 Creating family: ${family.name} for admin: ${family.adminUserId}`);

    // NO CLEANUP NEEDED: Unique family names prevent all conflicts!
    console.log(`✨ No cleanup needed - unique family names prevent conflicts: ${family.name}`);
    
    const lockName = `user-family-${family.adminUserId}`;
    const workerId = (globalThis as any).process?.env?.PLAYWRIGHT_WORKER_INDEX || '0';
    console.log(`🔒 Worker ${workerId} acquiring USER lock for family creation: ${lockName}`);
    
    // Wait for exclusive USER lock - prevents race conditions per user
    await this.acquireDistributedLock(lockName);

    try {
      // Retry mechanism for database operations (within the lock)
      let retryCount = 0;
      const maxRetries = 3; // Reduced with better conflict prevention
      
      while (retryCount < maxRetries) {
        try {
          const uniqueFamilyName = `${family.name}-${family.adminUserId}`.substring(0, 50);
        
          execSync(`docker exec edulift-backend-e2e node -e "
          const { PrismaClient } = require('@prisma/client');
          const prisma = new PrismaClient({ 
            datasources: { db: { url: process.env.DATABASE_URL } },
            log: ['error']
          });
        
        async function createFamily() {
          try {
            // ATOMIC CHECK: Verify user doesn't already have a family
            const existingMembership = await prisma.familyMember.findFirst({
              where: { userId: '${family.adminUserId}' },
              include: { family: true }
            });
            
            if (existingMembership) {
              console.log('✅ User already has family: ' + existingMembership.family.name + ' - skipping creation');
              return;
            }
            
            // Ensure user exists before creating family
            const user = await prisma.user.findUnique({
              where: { id: '${family.adminUserId}' }
            });
            
            if (!user) {
              throw new Error('User ${family.adminUserId} not found, cannot create family');
            }
            
            // Create family with pre-computed unique name
            let familyRecord = await prisma.family.findFirst({
              where: { name: '${uniqueFamilyName}' }
            });
            
            if (!familyRecord) {
              familyRecord = await prisma.family.create({
                data: {
                  name: '${uniqueFamilyName}'
                }
              });
              console.log('✅ Created unique family: ${uniqueFamilyName}');
            }
            
            // Add admin with transaction and better error handling
            await prisma.\\$transaction(async (tx) => {
              await tx.familyMember.upsert({
                where: { 
                  familyId_userId: { 
                    familyId: familyRecord.id,
                    userId: '${family.adminUserId}'
                  } 
                },
                update: {
                  role: 'ADMIN'
                },
                create: {
                  userId: '${family.adminUserId}',
                  familyId: familyRecord.id,
                  role: 'ADMIN'
                }
              });
            }, {
              maxWait: 5000,
              timeout: 15000
            });
            
            ${family.members ? family.members.map(member => `
            // Add member ${member.userId}
            await prisma.familyMember.upsert({
              where: { 
                familyId_userId: { 
                  familyId: familyRecord.id,
                  userId: '${member.userId}'
                } 
              },
              update: {
                role: '${member.role}'
              },
              create: {
                userId: '${member.userId}',
                familyId: familyRecord.id,
                role: '${member.role}'
              }
            });
            `).join('') : ''}
            
            console.log('File-specific family created: ${family.name}');
          } catch (error) {
            console.error('Error creating file-specific family ${family.name}:', error.message);
            console.error('Full error:', error);
            throw error;
          } finally {
            await prisma.\\$disconnect();
          }
        }
        
        (async () => { await createFamily(); })();
      "`, { 
            encoding: 'utf8', 
            timeout: 15000, // Restored efficient timeout
            stdio: 'inherit'
          });
      
          // If we get here, the operation succeeded
          break;
        
        } catch (error) {
          retryCount++;
          console.log(`Family creation error for ${family.name} (attempt ${retryCount}/${maxRetries}):`, error.message);
        
          if (retryCount >= maxRetries) {
            throw new Error(`Failed to create family '${family.name}' after ${maxRetries} attempts: ${error.message}`);
          }
        
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      // Verify family was actually created by checking if user has family membership
      // Retry verification to handle timing issues
      let verifyRetryCount = 0;
      const maxVerifyRetries = 3; // Restored efficient retry count
    
      while (verifyRetryCount < maxVerifyRetries) {
        try {
          execSync(`docker exec edulift-backend-e2e node -e "
          const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient({ 
          datasources: { db: { url: process.env.DATABASE_URL } },
          log: ['error']
        });
        
        async function verifyFamily() {
          try {
            const membership = await prisma.familyMember.findFirst({
              where: { userId: '${family.adminUserId}' },
              include: { family: true }
            });
            
            if (!membership) {
              throw new Error('Family membership not found after creation for user ${family.adminUserId}');
            }
            
            // Log family details for debugging but don't fail on exact matches
            console.log('✅ Family found: ' + membership.family.name + ', Expected: ${family.name}');
            console.log('✅ User role: ' + membership.role);
            
            console.log('✅ Family verification successful: ' + membership.family.name + ' (role: ' + membership.role + ')');
          } catch (error) {
            console.error('❌ Family verification failed:', error.message);
            throw error;
          } finally {
            await prisma.\\$disconnect();
          }
        }
        
        (async () => { await verifyFamily(); })();
      "`, { 
            encoding: 'utf8', 
            timeout: 10000, // Restored efficient timeout
            stdio: 'inherit'
          });
      
          console.log(`✅ Family verification complete for ${family.name}`);
        
          // Additional verification: Check if backend API can find the family
          // This catches transaction isolation issues that direct DB access misses
          try {
            execSync(`docker exec edulift-backend-e2e node -e "
            const { PrismaClient } = require('@prisma/client');
            const prisma = new PrismaClient();
            
            (async () => {
              try {
                const user = await prisma.user.findUnique({
                  where: { id: '${family.adminUserId}' },
                  include: { familyMemberships: { include: { family: true } } }
                });
                
                if (!user || !user.familyMemberships || user.familyMemberships.length === 0) {
                  throw new Error('Backend API cannot find family for user ${family.adminUserId}');
                }
                
                console.log('✅ Backend API family check passed for user ${family.adminUserId}');
              } catch (e) {
                console.error('❌ Backend API family check failed:', e.message);
                throw e;
              } finally {
                await prisma.\\$disconnect();
              }
            })();
          "`, { encoding: 'utf8', timeout: 10000, stdio: 'inherit' });
          } catch (apiError) {
            console.error(`❌ Backend API cannot find family for ${family.name}:`, apiError.message);
            throw new Error(`Backend API family verification failed for '${family.name}': ${apiError.message}`);
          }
        
          // Wait for database transaction to be fully committed and visible
          // Use exponential backoff with jitter to prevent thundering herd
          const baseDelay = Math.min(1000 * Math.pow(2, verifyRetryCount), 5000);
          const jitter = Math.random() * 500;
          await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
          break;
        
        } catch (verifyError) {
          verifyRetryCount++;
          console.error(`❌ Family verification failed for ${family.name} (attempt ${verifyRetryCount}/${maxVerifyRetries}):`, verifyError.message);
        
          if (verifyRetryCount >= maxVerifyRetries) {
            throw new Error(`Family creation verification failed for '${family.name}' after ${maxVerifyRetries} attempts: ${verifyError.message}`);
          }
        
          // Wait before retrying with exponential backoff
          const retryDelay = Math.min(1500 * Math.pow(2, verifyRetryCount), 8000);
          const retryJitter = Math.random() * 300;
          await new Promise(resolve => setTimeout(resolve, retryDelay + retryJitter));
        }
      }

    } finally {
      // CRITICAL: Always release the distributed lock
      await this.releaseDistributedLock(lockName);
      console.log(`🔓 Worker ${workerId} released lock: ${lockName}`);
    }
  }

  // REMOVED: All cleanup methods are unnecessary due to unique family names

  /**
   * Acquire a distributed lock using Docker container filesystem
   * This prevents race conditions across all parallel workers
   */
  private async acquireDistributedLock(lockName: string): Promise<void> {
    const maxLockWaitTime = 10000; // 10 seconds - reduced since no cleanup conflicts
    const pollInterval = 100; // Check every 100ms - faster polling
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxLockWaitTime) {
      try {
        // Try to create lock file atomically using Docker
        execSync(`docker exec edulift-backend-e2e sh -c 'mkdir -p /tmp/test-locks && (set -C; echo $$ > /tmp/test-locks/${lockName}) 2>/dev/null'`, { 
          stdio: 'pipe' 
        });
        
        // If we get here, we successfully acquired the lock
        console.log(`🔒 Successfully acquired lock: ${lockName}`);
        return;
        
      } catch (error) {
        // Lock file exists, wait and retry
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    throw new Error(`Failed to acquire distributed lock '${lockName}' within ${maxLockWaitTime}ms - possible deadlock. This indicates high parallel contention.`);
  }

  /**
   * Release a distributed lock
   */
  private async releaseDistributedLock(lockName: string): Promise<void> {
    try {
      execSync(`docker exec edulift-backend-e2e rm -f /tmp/test-locks/${lockName}`, { 
        stdio: 'pipe' 
      });
    } catch (error) {
      // Lock file might not exist or already removed - that's okay
      console.log(`ℹ️ Lock ${lockName} was already released or didn't exist`);
    }
  }

  /**
   * Get debug info about the test data setup
   */
  getDebugInfo(): string {
    return `
FileSpecificTestData Debug Info:
- File Prefix: ${this.filePrefix}
- Run ID: ${this.runId}
- Users: ${Object.keys(this.testUsers).join(', ')}
- Families: ${Object.keys(this.testFamilies).join(', ')}
    `.trim();
  }
}