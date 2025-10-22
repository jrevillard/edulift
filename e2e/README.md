# 🧪 EduLift E2E Testing Suite

## 🚀 Quick Start

### ⚡ Quick Start (2 steps)
```bash
# 1. Run all E2E tests
npm run e2e:test

# 2. Run tests without cleanup of Docker containers
npm run e2e:test:no-cleanup
```

### 📋 Prerequisites
- **Docker and Docker Compose** installed and running
- **Node.js 18+** 
- **npm** or yarn
- **Available ports**: 8002, 8001, 5435, 6382

### 🔧 Detailed Installation and Configuration

#### Step 1: Navigate and Install
```bash
# Navigate to E2E directory
cd e2e/

# Install E2E dependencies and Playwright browsers
npm run e2e:install
```

#### Step 2: Start Docker Environment
```bash
# Start isolated test environment (Docker)
npm run e2e:setup
```
**What this command does:**
- 🐳 Starts PostgreSQL test (port 5435)
- 🐳 Starts Redis test (port 6382)  
- 🐳 Starts Backend test (port 8002)
- 🐳 Starts Frontend test (port 8001)
- 📊 Initializes database with test data

#### Step 3: Run Tests
```bash
# Run all E2E tests
npm run e2e:test

# OR with visual interface
npm run e2e:test:headed

# OR in debug mode
npm run e2e:test:debug
```

#### Step 4: View Results
```bash
# Open HTML test report
npm run e2e:report
```

#### Step 5: Cleanup
```bash
# Stop and cleanup Docker environment
npm run e2e:teardown
```

## 🏗️ Architecture Overview

### Isolated Test Environment
E2E tests run in complete isolation from development:

```
Development Environment      E2E Test Environment
Backend: localhost:3000  →   Backend: localhost:8002
Frontend: localhost:5173 →   Frontend: localhost:8001
Database: localhost:5432 →   Database: localhost:5435
Redis: localhost:6379    →   Redis: localhost:6382
```

**✅ Benefits:**
- No impact on your development environment
- Reproducible and reliable tests
- Isolated test data
- No port conflicts

### Directory Structure
```
e2e/
├── package.json              # E2E dependencies & scripts
├── playwright.config.ts      # Playwright configuration
├── docker-compose.yml        # Isolated test environment
├── tests/
│   ├── auth/                 # Authentication tests
│   ├── family/               # Family onboarding tests
│   ├── group/                # Group coordination tests
│   ├── schedule/             # Real-time assignment tests
│   ├── fixtures/             # Test data & helpers
│   │   ├── file-specific-test-data.ts  # Data isolation fixture
│   │   ├── universal-auth-helper.ts    # Authentication helper
│   │   └── e2e-email-helper.ts         # Email testing helper
│   ├── global-setup.ts       # Environment setup
│   └── global-teardown.ts    # Environment cleanup
└── README.md                 # This file
```

## 🎯 Migration : De l'Ancien AuthHelper vers UniversalAuthHelper

### 🚀 Guide de Migration Rapide

| 🔴 **Ancien Système (Problématique)** | 🟢 **Nouveau Système (Sûr)** |
|---|---|
| `import { AuthHelper } from '../fixtures/auth-helpers'` | `import { UniversalAuthHelper } from '../fixtures/universal-auth-helper'` |
| `const user = { email: 'test@example.com', name: 'Test' }` | `authHelper.defineUser('testUser', 'test-user', 'Test User')` |
| `await authHelper.setupUser(user, '/dashboard')` | `await authHelper.directUserSetup('testUser', '/dashboard')` |
| ⚠️ **Emails codés en dur = conflits !** | ✨ **Emails automatiquement uniques !** |

### 📝 Template de Migration

```typescript
// ✨ NOUVEAU TEMPLATE - Copiez-collez et adaptez
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';

test.describe.configure({ mode: 'serial' }); // Évite conflits intra-fichier

test.describe('Mon Feature', () => {
  test.beforeAll(async () => {
    // 🔧 Setup : Définir vos utilisateurs
    const authHelper = new UniversalAuthHelper(null as any);
    authHelper.defineUser('admin', 'admin', 'Admin User');
    authHelper.defineUser('user', 'regular-user', 'Regular User');
    
    // Créer en base
    await authHelper.createUsersInDatabase();
  });
  
  test('mon test', async ({ page }) => {
    // 🎯 Usage : Récupérer l'helper partagé
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    
    // Utiliser avec juste la clé
    await authHelper.directUserSetup('admin', '/mon-page');
    
    // Vos assertions...
  });
});
```

---

## 🎯 Solution Anti-Concurrence : UniversalAuthHelper Encapsulé

### Le Problème : Conflits de Concurrence entre Tests

Quand plusieurs fichiers de tests s'exécutent en parallèle, ils peuvent entrer en conflit sur des données partagées (emails, utilisateurs, familles). Notre solution utilise **des données spécifiques par fichier** avec des préfixes uniques, **complètement encapsulés** dans `UniversalAuthHelper`.

### Approche à Deux Niveaux

#### Niveau 1 : Sériel dans les Fichiers
```typescript
// Évite les conflits entre tests du même fichier
test.describe.configure({ mode: 'serial' });
```

#### Niveau 2 : Données Spécifiques par Fichier (Automatique)
```typescript
// UniversalAuthHelper génère automatiquement des données uniques par fichier
const authHelper = UniversalAuthHelper.forCurrentFile(page);
```

### La Solution : UniversalAuthHelper Complètement Encapsulé

**🚀 NOUVELLE APPROCHE SIMPLIFIÉE (Migration depuis l'ancien AuthHelper)**

**Pour les développeurs venant de l'ancien système :** Cette approche remplace complètement l'ancien `AuthHelper` et gère automatiquement tous les conflits de concurrence sans exposition de détails techniques.

```typescript
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';

test.describe.configure({ mode: 'serial' }); // Évite conflits intra-fichier

test.describe('My Feature Tests', () => {
  test.beforeAll(async () => {
    // ✨ Étape 1 : Configuration initiale (REMPLACEMENT de l'ancien AuthHelper)
    const authHelper = new UniversalAuthHelper(null as any); // Setup uniquement
    
    // ✨ Étape 2 : Définir vos utilisateurs (génère automatiquement emails/IDs uniques)
    authHelper.defineUser('admin', 'admin', 'Admin User');
    authHelper.defineUser('member', 'member', 'Member User');
    authHelper.defineUser('invitee', 'invitee', 'Invitee User', true); // Recevra invitation
    
    // ✨ Étape 3 : Définir familles si nécessaire
    authHelper.defineFamily('testFamily', 'Test Family', 'admin');
    
    // ✨ Étape 4 : Créer tout en base (automatique, aucun conflit)
    await authHelper.createUsersInDatabase();
    await authHelper.createFamilyInDatabase('testFamily');
  });
  
  test('should work correctly', async ({ page }) => {
    // ✨ Étape 5 : Dans vos tests - RÉCUPÉRER l'helper partagé pour ce fichier
    const authHelper = UniversalAuthHelper.forCurrentFile(page);
    
    // ✨ Étape 6 : Utiliser vos utilisateurs avec juste leurs clés (SIMPLE!)
    await authHelper.directUserSetup('admin', '/family/manage');
    
    // ✨ Pour invitations - emails automatiquement générés et uniques
    const inviteeEmail = authHelper.getUser('invitee').email;
    await page.fill('[data-testid="Input-email"]', inviteeEmail);
    
    // ✨ Ou utiliser directement la clé pour invitations:
    await authHelper.acceptInvitation(invitationUrl, 'invitee');
  });
});
```

**🔄 Avantages de la Nouvelle Approche:**
- **✨ Zéro Gestion Manuelle**: Plus besoin de gérer emails, IDs, ou conflits manuellement
- **✨ Auto-Isolation**: Chaque fichier de test a automatiquement ses propres données uniques
- **✨ API Ultra-Simple**: Juste `defineUser()` puis `forCurrentFile()` - c'est tout !
- **✨ Migration Facile**: Remplace directement l'ancien AuthHelper sans changement de logique
- **✨ Sécurité Intégrée**: Impossible d'écrire des tests avec conflits de concurrence
- **✨ Performance**: Tests en parallèle sans conflits = exécution plus rapide

## 🗂️ Fixture File Consolidation Recommendations

### Current Fixture Files (Analysis)

| File | Status | Recommendation |
|------|--------|----------------|
| `universal-auth-helper.ts` | ✅ **Keep** | Enhanced core helper with FileSpecificTestData |
| `file-specific-test-data.ts` | ✅ **Keep** | Core data isolation fixture |
| `e2e-email-helper.ts` | ✅ **Keep** | Email testing utilities |
| `auth-helpers.ts` | ❌ **Remove** | Deprecated - uses localStorage mocking |
| `auth-setup.ts` | ❌ **Remove** | Deprecated - global auth setup approach |
| `test-data.ts` | ❌ **Remove** | Hardcoded global users (concurrency unsafe) |
| `family-helpers.ts` | ❌ **Remove** | Deprecated - depends on unsafe auth patterns |
| `auth-state.json` | ❌ **Remove** | Global auth state (concurrency unsafe) |

### Consolidation Benefits

**Before consolidation:**
- 8 fixture files with overlapping functionality
- Multiple authentication patterns (confusing)
- Hardcoded global test users (concurrency issues)
- Deprecated localStorage mocking approaches

**After consolidation:**
- 3 core fixture files with clear purposes
- Single enhanced authentication pattern
- All data is file-specific and concurrency-safe
- No deprecated patterns available

### Migration Path

1. **Replace `auth-helpers.ts` usage** → Use `UniversalAuthHelper`
2. **Replace `test-data.ts` hardcoded users** → Use `FileSpecificTestData.defineUser()`
3. **Replace `family-helpers.ts`** → Use `UniversalAuthHelper.defineFamily()` + `createFamilyInDatabase()`
4. **Remove global auth setup** → Use per-file setup with `FileSpecificTestData`

**📊 Comparison: Old vs New**

| Aspect | Old Approach | New Enhanced Approach |
|--------|-------------|----------------------|
| **FileSpecificTestData** | Manual import & setup | ✅ **Built-in automatically** |
| **File prefix** | Manual specification | ✅ **Auto-detected from filename** |
| **User definition** | `testData.defineUser()` | ✅ **`authHelper.defineUser()`** |
| **User usage** | `testData.getUser('admin')` | ✅ **`'admin'` (just the key)** |
| **Email handling** | Manual email extraction | ✅ **Automatic file-specific emails** |
| **Concurrency safety** | Manual enforcement | ✅ **Impossible to write unsafe tests** |
| **Backward compatibility** | N/A | ❌ **None - forces safe patterns** |

### ANCIENNE APPROCHE (Dépréciée)

```typescript
// ❌ ANCIENNE MÉTHODE - Manuelle, verbeuse, sujette aux erreurs
import { AuthHelper } from '../fixtures/auth-helper'; // Déprécié

// Gestion manuelle des emails - PROBLÈME : conflits entre fichiers !
const user = { 
  email: 'admin@test.com', // ⚠️ Email codé en dur = conflits !
  name: 'Admin User' 
};
await authHelper.setupUser(user, '/family/manage');
```

### Exemples de Données Générées (Automatiques)

Pour le fichier `family-invitations.spec.ts`, le système génère automatiquement :

```
Utilisateurs (générés automatiquement) :
- admin.familyInvitations.x7k9m2p1@edulift.com
- member.familyInvitations.x7k9m2p1@edulift.com

Familles (générées automatiquement) :
- Admin Test Family familyInvitations x7k9m2p1

✨ Format ID : préfixe-fichier + 8 caractères aléatoires
✨ Avantage : Unicité garantie, aucun conflit, génération cryptographique
```

### Stratégie d'Isolation (Automatique)

Chaque fichier de test obtient automatiquement un préfixe unique :

```
01-family-creation.spec.ts     → Préfixe: 'familyCreation' 
02-family-invitations.spec.ts  → Préfixe: 'familyInvitations'
03-family-management.spec.ts   → Préfixe: 'familyManagement'
04-family-lifecycle.spec.ts    → Préfixe: 'familyLifecycle'
```

**Résultat :** Isolation complète automatique des données par fichier
- `admin.familyCreation.x1y2z3@edulift.com` (fichier 1)
- `admin.familyInvitations.a4b5c6@edulift.com` (fichier 2)  
- `admin.familyManagement.d7e8f9@edulift.com` (fichier 3)
- `admin.familyLifecycle.g1h2i3@edulift.com` (fichier 4)

### Méthodes UniversalAuthHelper - Guide de Migration

| Étape | Méthode | Usage | Exemple |
|-------|---------|-------|---------|
| **Setup** | `defineUser(key, baseName, displayName, willReceiveInvitation?)` | Définir utilisateur | `authHelper.defineUser('admin', 'admin', 'Admin User')` |
| **Setup** | `defineFamily(key, familyName, adminUserKey)` | Définir famille | `authHelper.defineFamily('family', 'Test Family', 'admin')` |
| **Setup** | `createUsersInDatabase()` | Créer en base | `await authHelper.createUsersInDatabase()` |
| **Setup** | `createFamilyInDatabase(familyKey)` | Créer famille | `await authHelper.createFamilyInDatabase('family')` |
| **Tests** | `UniversalAuthHelper.forCurrentFile(page)` | Récupérer helper | `const auth = UniversalAuthHelper.forCurrentFile(page)` |
| **Tests** | `directUserSetup(userKey, path)` | Connecter utilisateur | `await auth.directUserSetup('admin', '/family')` |
| **Tests** | `getUser(key)` | Récupérer utilisateur | `const user = auth.getUser('admin')` |
| **Tests** | `acceptInvitation(url, userKey)` | Accepter invitation | `await auth.acceptInvitation(url, 'invitee')` |

### 🚨 IMPORTANT: What UniversalAuthHelper Supports vs Does NOT Support

#### ✅ SUPPORTED: Users and Families Only
UniversalAuthHelper only supports database creation of:
- **Users** via `defineUser()` + `createUsersInDatabase()`
- **Families** via `defineFamily()` + `createFamilyInDatabase()`

#### ❌ NOT SUPPORTED: Groups, Schedules, Vehicles
UniversalAuthHelper does **NOT** support:
- ❌ `defineGroup()` - **Method does not exist!**
- ❌ `createGroupInDatabase()` - **Method does not exist!**
- ❌ `defineSchedule()` - **Method does not exist!**
- ❌ `createVehicleInDatabase()` - **Method does not exist!**

#### ✅ CORRECT Pattern for Group Tests
Groups, schedules, and vehicles must be created through **UI interactions** during tests:

```typescript
// ✅ CORRECT - Create families with UniversalAuthHelper
test.beforeAll(async () => {
  const authHelper = new UniversalAuthHelper(null as any);
  authHelper.defineUser('admin', 'admin', 'Admin User');
  authHelper.defineFamily('family', 'Test Family', 'admin');
  await authHelper.createUsersInDatabase();
  await authHelper.createFamilyInDatabase('family');
  // Groups will be created through UI during tests
});

test('group creation', async ({ page }) => {
  const authHelper = UniversalAuthHelper.forCurrentFile(page);
  await authHelper.directUserSetup('admin', '/groups');
  
  // Create group through UI interaction
  await page.click('[data-testid="GroupsPage-Button-createGroup"]');
  await page.fill('[data-testid="CreateGroupModal-Input-groupName"]', 'Test Group');
  await page.click('[data-testid="CreateGroupModal-Button-submit"]');
});

// ❌ WRONG - These methods don't exist!
authHelper.defineGroup('testGroup', 'Test Group', 'family'); // ❌ ERROR!
await authHelper.createGroupInDatabase('testGroup'); // ❌ ERROR!
```

#### Why This Limitation?
Groups, schedules, and vehicles are complex entities that:
1. **Require real UI validation** - Better tested through actual user interactions
2. **Have dynamic relationships** - Depend on user permissions and family structures
3. **Change frequently** - UI-based creation ensures tests reflect real user flows
4. **Need invitation flows** - Group invitations are core functionality to test

### ⚠️ Règles Critiques - Migration depuis l'Ancien Système

#### ❌ Erreurs Communes à Éviter (Ancien Système)

```typescript
// ❌ ANCIEN SYSTÈME - Emails codés en dur cassent le parallélisme
await authHelper.setupUser(
  { email: 'family.admin@edulift.com', name: 'Admin' }, // ⚠️ CONFLIT !
  '/family/manage'
);

// ❌ ANCIEN SYSTÈME - Utilisateurs globaux
import { GLOBAL_ADMIN_USER } from '../fixtures/users'; // ⚠️ CONFLIT !

// ❌ ANCIEN SYSTÈME - Nettoyage d'emails (casse tests parallèles)
await emailHelper.clearAllEmails(); // ⚠️ CASSE TOUT !

// ❌ ANCIEN SYSTÈME - Création inline d'utilisateurs
const user = { email: 'test@example.com', name: 'Test' }; // ⚠️ CONFLIT !
await authHelper.setupUser(user, '/dashboard');
```

#### ✅ Nouveaux Patterns Corrects (UniversalAuthHelper)

```typescript
// ✅ NOUVEAU SYSTÈME - Utilisateurs prédéfinis avec clés
const authHelper = UniversalAuthHelper.forCurrentFile(page);
await authHelper.directUserSetup('admin', '/family/manage'); // Juste la clé !

// ✅ NOUVEAU SYSTÈME - Setup dans beforeAll
test.beforeAll(async () => {
  const authHelper = new UniversalAuthHelper(null as any);
  authHelper.defineUser('admin', 'admin', 'Admin User'); // Auto-isolation !
  await authHelper.createUsersInDatabase();
});

// ✅ NOUVEAU SYSTÈME - Emails automatiquement isolés
// Plus besoin de nettoyer les emails - isolation automatique !

// ✅ NOUVEAU SYSTÈME - Récupération simple d'utilisateur
const user = authHelper.getUser('admin'); // Email unique automatique !
const userEmail = user.email; // Exemple: admin.familyTests.x1y2z3@edulift.com
```

### Pattern d'Invitations (Nouveau Système)

**🚨 CRITIQUE**: Pour tester les invitations, NE PAS pré-créer l'utilisateur invité en base !

```typescript
// Tests d'invitations
test.beforeAll(async () => {
  const authHelper = new UniversalAuthHelper(null as any);
  authHelper.defineUser('admin', 'admin', 'Admin User');
  authHelper.defineUser('invited', 'invited', 'Invited User', true); // ✨ Recevra invitation
  
  // Créer seulement l'admin, PAS l'utilisateur invité !
  await authHelper.createUsersInDatabase(); // Crée automatiquement que les non-invitation
});

test('should invite new user', async ({ page }) => {
  const authHelper = UniversalAuthHelper.forCurrentFile(page);
  
  // Utiliser l'email automatiquement généré pour l'invitation
  const invitedUser = authHelper.getUser('invited'); // Email unique automatique
  
  // Envoyer invitation à l'email généré
  await page.fill('[data-testid="Input-email"]', invitedUser.email);
  
  // L'helper acceptInvitation créera l'utilisateur
  await authHelper.acceptInvitation(invitationUrl, 'invited'); // Juste la clé !
});
```

### Avantages de la Nouvelle Approche

- ✅ **Aucun conflit intra-fichier** - Exécution sérielle dans les fichiers
- ✅ **Aucun conflit inter-fichiers** - Données uniques automatiques par fichier
- ✅ **Performance maximale** - Fichiers s'exécutent en parallèle  
- ✅ **Migration simple** - Remplace directement l'ancien AuthHelper
- ✅ **Extensible** - Facile d'ajouter de nouveaux fichiers de tests
- ✅ **Efficacité prouvée** - Élimine tous les problèmes de concurrence !

### Quand Utiliser Cette Approche

**🚨 CRITIQUE: Utilisez UniversalAuthHelper pour TOUS les tests E2E !**

**UniversalAuthHelper doit être utilisé pour:**
- ✅ **TOUS les fichiers de test** - Prévient automatiquement tous conflits de concurrence
- ✅ **Même les tests simples** - Assure l'isolation automatique des emails
- ✅ **Tests d'authentification** - Isolation automatique des utilisateurs
- ✅ **Tests de familles** - Génération automatique d'utilisateurs/familles uniques
- ✅ **Tests d'invitations** - Emails automatiquement isolés
- ✅ **Tout test qui envoie des emails** - Prévient les conflits inter-fichiers
- ✅ **Tout test qui crée des utilisateurs** - Prévient les collisions d'ID

**Statut de Migration:**
- ✅ **Tests famille (4/4)** - Complètement migrés vers UniversalAuthHelper
- 🔄 **Autres tests** - Peuvent continuer à utiliser l'ancien système temporairement
- ✨ **Nouveaux tests** - DOIVENT utiliser UniversalAuthHelper

## 🔐 Authentication Patterns

### 🚨 CRITICAL: Use File-Specific Users, Not Global Users

**⚠️ DO NOT USE:**
- `quickExistingUserSetup()` - Deprecated method
- Hardcoded emails like `family.admin@edulift.com` - Breaks test parallelism
- Global test users - Causes conflicts between test files

### ✅ Correct Authentication Patterns

#### When to Use Which Method

**🚨 IMPORTANT: ALL tests should use FileSpecificTestData for proper isolation!**

| Test Scenario | Authentication Method | Data Management | Reason |
|---------------|---------------------|-----------------|--------|
| **Family Management** | `directUserSetup` | **FileSpecificTestData** | User already has family setup |
| **Group Management** | `directUserSetup` | **FileSpecificTestData** | User already has family + groups |
| **Schedule Management** | `directUserSetup` | **FileSpecificTestData** | User already has family + groups |
| **Family Creation** | `authenticateUniqueUser` | **FileSpecificTestData** | Test the full onboarding flow |
| **New User Onboarding** | `authenticateUniqueUser` | **FileSpecificTestData** | Test first-time user experience |
| **Integration Tests** | `authenticateUniqueUser` | **FileSpecificTestData** | Test end-to-end user journey |
| **Invitation Recipients** | `acceptInvitation` | **FileSpecificTestData** | Invitation flows - user created during invitation |

**Note:** Even when using `authenticateUniqueUser`, you should still create a FileSpecificTestData instance for the file to ensure proper email isolation and prevent conflicts.

#### 1. For File-Specific Pre-created Users
Always use file-specific users created in `beforeAll()`:

```typescript
// In test setup
const testData = new FileSpecificTestData('featureA');
testData.defineUser('admin', 'admin', 'Admin User');

// In beforeAll - create in database
test.beforeAll(async () => {
  await testData.createUsersInDatabase();
});

// In test
const authHelper = new UniversalAuthHelper(page);
await authHelper.directUserSetup(testData.getUser('admin'), '/family/manage');
```

#### 2. For Invitation Recipients
**Critical:** Don't pre-create users who will receive invitations!

```typescript
// ✅ CORRECT - Let acceptInvitation() create the user
testData.defineUser('invited', 'invited', 'Invited User', true); // Will receive invitation
const invitedUserEmail = testData.getUser('invited').email;
await page.fill('[data-testid="Input-inviteEmail"]', invitedUserEmail);
// ... send invitation ...

// In recipient flow
const authHelper = new UniversalAuthHelper(page);
await authHelper.acceptInvitation(invitationUrl, invitedUserEmail);
```

#### 3. For New Users (testing onboarding)
Use `authenticateUniqueUser()` with FileSpecificTestData for proper isolation:

```typescript
// ✅ CORRECT - Use FileSpecificTestData even with authenticateUniqueUser
const testData = new FileSpecificTestData('onboarding');

const authHelper = new UniversalAuthHelper(page);
// Use file-specific email to avoid conflicts
const userEmail = testData.getEmail('test-user');
const user = await authHelper.authenticateUniqueUser(userEmail, { isNewUser: true });
await authHelper.goToPageAsUser(user, '/dashboard', { isNewUser: true });

// ❌ WRONG - Using generic email can cause conflicts
const user = await authHelper.authenticateUniqueUser('test-user@example.com', { isNewUser: true });
```

### 🛠️ Authentication Helper Reference

```typescript
// Import the helper
import { UniversalAuthHelper } from '../fixtures/universal-auth-helper';

// Initialize
const authHelper = new UniversalAuthHelper(page);

// Method 1: Direct setup (existing users)
await authHelper.directUserSetup(userObject, targetPath);

// Method 2: Unique user creation
await authHelper.authenticateUniqueUser(baseName, options);

// Method 3: Navigate authenticated user  
await authHelper.goToPageAsUser(user, targetPath, options);

// Method 4: Accept invitation
await authHelper.acceptInvitation(invitationUrl, recipientEmail);
```

### 🚨 Common Anti-Patterns to Fix

#### ❌ Anti-Pattern: Hardcoded Emails
```typescript
// WRONG - Breaks test parallelism
await authHelper.directUserSetup(
  { id: 'admin-id', email: 'family.admin@edulift.com', name: 'Admin' },
  '/family/manage'
);
```

#### ❌ Anti-Pattern: Pre-Creating Invitation Recipients
```typescript
// WRONG - Causes magic link flow instead of join button
testData.defineUser('invitedUser', 'invited', 'Invited User'); // Should be true
await testData.createUsersInDatabase(); // Will create invitation recipient!
```

#### ❌ Anti-Pattern: Inline User Creation (Concurrency Killer!)
```typescript
// WRONG - Creates users inline instead of using predefined file-specific users
await authHelper.directUserSetup(
  { id: testData.getId('admin'), email: testData.getEmail('admin'), name: 'Admin' },
  '/dashboard'
);
```

**🚨 CRITICAL CONCURRENCY ISSUE**: This pattern causes tests to pass individually but fail when run together!

**The fix:** Always use predefined user objects: `testData.getUser('admin')`

## 🔒 Browser Context Isolation for Multi-User Testing

### Problem: Authentication Contamination

When testing multi-user interactions (e.g., invitations, family management), using `context.newPage()` causes **authentication contamination** between users due to shared localStorage.

#### Root Cause

The `UniversalAuthHelper.setAuthenticationData()` method triggers a `StorageEvent` that propagates authentication changes to all pages within the same browser context:

```typescript
// This event propagates to ALL pages in the same context
const storageEvent = new StorageEvent('storage', {
  key: 'authToken',
  newValue: token,
  oldValue: null,
  storageArea: localStorage
});
window.dispatchEvent(storageEvent);
```

#### Symptom

When User A (admin) invites User B (member):
1. **Admin Page**: Shows "Your Role ADMIN" ✅
2. **Member joins** using `context.newPage()` 
3. **Admin Page**: Now shows "Your Role MEMBER" ❌ (contaminated)

### Solution: Browser Context Isolation

#### ❌ Problematic Code
```typescript
// This shares localStorage and causes auth contamination
const memberPage = await context.newPage();
const memberAuth = new UniversalAuthHelper(memberPage);
await memberAuth.acceptInvitation(invitationUrl, memberEmail);
await memberPage.close();
```

#### ✅ Correct Code
```typescript
// This isolates localStorage completely
const memberContext = await context.browser()!.newContext();
const memberPage = await memberContext.newPage();
const memberAuth = new UniversalAuthHelper(memberPage);
await memberAuth.acceptInvitation(invitationUrl, memberEmail);
await memberContext.close(); // Close entire context for complete isolation
```

### Benefits

1. **🔒 Complete Isolation**: Each user has independent localStorage
2. **🧪 Realistic Testing**: Simulates real-world scenario (different browsers)
3. **🏗️ Clean Architecture**: No workarounds or hacks needed
4. **📝 Simple Documentation**: Clear principle to follow
5. **🐛 Bug Prevention**: Eliminates auth contamination bugs

### When to Use Context Isolation

Use isolated browser contexts when:
- ✅ Testing multi-user interactions (invitations, family joining)
- ✅ Simulating different users with different permissions
- ✅ Preventing authentication cross-contamination

Use regular `context.newPage()` when:
- ✅ Testing single-user workflows
- ✅ Opening multiple tabs for the same user
- ✅ Testing tab-based functionality

### Implementation Pattern

```typescript
test('multi-user interaction', async ({ page, context }) => {
  // Main user (e.g., admin)
  const mainAuthHelper = UniversalAuthHelper.forCurrentFile(page);
  await mainAuthHelper.directUserSetup('admin', '/some-page');
  
  // Perform action that generates invitation
  // ... send invitation ...
  
  // Secondary user (e.g., member) - ISOLATED CONTEXT
  const memberContext = await context.browser()!.newContext();
  const memberPage = await memberContext.newPage();
  const memberAuth = new UniversalAuthHelper(memberPage);
  await memberAuth.acceptInvitation(invitationUrl, memberEmail);
  await memberContext.close(); // Always close context
  
  // Main user continues with preserved authentication
  // ... verify admin still has admin role ...
});
```

### Testing Impact

This approach eliminates the need for:
- ❌ Re-authentication workarounds
- ❌ Role verification hacks
- ❌ Complex auth state management
- ❌ Flaky authentication-related test failures

The tests now accurately reflect real-world user interactions without authentication side effects.

## 🏷️ Test ID Naming Convention

All `data-testid` attributes must follow this pattern:

```
[ComponentName]-[ElementType]-[descriptiveName]
```

### Element Types
- `Container`, `Card`, `Modal` - Containers
- `Button`, `Link` - Clickable elements  
- `Input`, `Select`, `Checkbox` - Form controls
- `Text`, `Label`, `Heading`, `Title` - Text elements
- `Alert`, `Badge` - Status indicators
- `List`, `ListItem` - Lists
- `Icon`, `Image`, `Avatar` - Media
- `Panel`, `Tab`, `Toggle`, `Radio` - UI components
- `Form` - Form containers

### Examples

```tsx
// ✅ Good
<div data-testid="GroupCard-Container-groupCard">
  <h3 data-testid="GroupCard-Heading-groupName">{group.name}</h3>
  <button data-testid="GroupCard-Button-viewSchedule">View Schedule</button>
  <span data-testid="GroupCard-Text-memberCount">{memberCount} members</span>
</div>

// In CreateGroupModal.tsx
<div data-testid="CreateGroupModal-Modal-container">
  <h2 data-testid="CreateGroupModal-Title-modalTitle">Create New Group</h2>
  <input data-testid="CreateGroupModal-Input-groupName" />
  <button data-testid="CreateGroupModal-Button-submit">Create</button>
</div>

// ❌ Bad
<div data-testid="group-card">        // Not component-scoped
<button data-testid="view-schedule">  // Missing component name
<span data-testid="memberCount">      // Not following pattern
```

### Dynamic IDs

```tsx
// For list items or dynamic elements
<div data-testid={`GroupCard-Card-group-${group.id}`}>
<button data-testid={`MemberList-Button-removeMember-${member.id}`}>

// Also acceptable for simple cases
<li data-testid={`GroupList-ListItem-${group.id}`}>
```

### Important Rules

1. **Component-scoped**: Always start with the exact component name
2. **Predictable**: Follow the pattern consistently  
3. **No regex selectors**: Avoid `data-testid*="partial"` in tests
4. **Update tests**: When changing IDs, update all related tests
5. **Be Specific**: Use descriptive names that clearly indicate purpose
6. **Stay Consistent**: Always follow the pattern, no exceptions

### Benefits

1. **Uniqueness**: Component-scoped names prevent ID collisions
2. **Predictability**: Developers can guess test IDs based on the pattern
3. **Maintainability**: Easy to find and update related test IDs
4. **Self-documenting**: IDs indicate both location and purpose
5. **Test Stability**: Consistent IDs reduce test brittleness

## 📧 Email Testing

```typescript
import { E2EEmailHelper } from '../fixtures/e2e-email-helper';

test('should send invitation email', async ({ page }) => {
  const emailHelper = new E2EEmailHelper();
  
  // Send invitation using file-specific email
  const inviteeEmail = testData.getUser('invitee').email;
  await page.fill('[data-testid="Input-email"]', inviteeEmail);
  await page.click('[data-testid="Button-sendInvitation"]');
  
  // Wait for email
  const email = await emailHelper.waitForEmailForRecipient(inviteeEmail);
  expect(email.subject).toContain('Family Invitation');
  
  // Extract invitation URL
  const invitationUrl = emailHelper.extractInvitationUrl(email.html);
  expect(invitationUrl).toBeTruthy();
});
```

**Key Email Testing Rules:**
- Use file-specific emails from testData
- Never call `clearAllEmails()` (breaks parallel tests)
- Wait for specific recipient emails only

## 🛠️ Running Tests

### Local Development
```bash
# Navigate to e2e directory first
cd e2e/

# Run specific test file
npx playwright test auth/login-flow.spec.ts

# Run with browser UI visible
npm run e2e:test:headed

# Debug mode (step through tests)
npm run e2e:test:debug

# Run on specific browser
npx playwright test --project=firefox

# Run mobile tests only
npx playwright test --project="Mobile Chrome"
```

### Available Scripts
```bash
npm run e2e:install         # Install dependencies & browsers
npm run e2e:setup           # Start test environment
npm run e2e:test            # Run all E2E tests
npm run e2e:test:no-cleanup # Run tests without cleanup (for report inspection)
npm run e2e:test:headed     # Run with visible browser
npm run e2e:test:debug      # Debug mode
npm run e2e:test:ui         # Interactive UI mode
npm run e2e:report          # View HTML report
npm run e2e:teardown        # Cleanup environment
npm run e2e:clean           # Clean Docker resources

# Unit tests (from e2e directory)
npm run test:unit:backend    # Backend unit tests
npm run test:unit:frontend   # Frontend unit tests
npm run test:all            # All tests (unit + E2E)
```

### Main Commands Reference

| Command | Description | Usage |
|---------|-------------|-------|
| `npm run e2e:install` | Install Playwright and browsers | ⚡ Once only |
| `npm run e2e:setup` | Start Docker environment | 🚀 Before each session |
| `npm run e2e:test` | Run all tests | 🧪 Main execution |
| `npm run e2e:test:headed` | Tests with visual interface | 👀 To watch tests |
| `npm run e2e:test:debug` | Interactive debug mode | 🐛 For debugging |
| `npm run e2e:report` | Open HTML report | 📊 View results |
| `npm run e2e:teardown` | Clean environment | 🧹 After each session |

## 📊 Test Results & Reporting

### HTML Reports
After running tests, view detailed results:
```bash
npm run e2e:report
# Opens http://localhost:9323

# Or run tests without cleanup to keep containers running for report inspection:
npm run e2e:test:no-cleanup
# Report served at http://localhost:9323 (fixed port)
```

### Artifacts Generated
- **Screenshots**: On test failures
- **Videos**: For failing tests
- **Traces**: Detailed execution logs
- **Coverage**: Frontend code coverage

## 📋 Test Coverage

### Critical User Journeys

#### ✅ Authentication Flow
- Magic link login/logout
- Session persistence
- Multi-device handling
- Error states and validation

#### ✅ Family Onboarding  
- Complete wizard flow
- Child and vehicle addition
- Validation and error handling
- Progress persistence across refreshes

#### ✅ Group Coordination
- Group creation and invitations
- Member management
- Schedule slot creation
- Vehicle and child assignments

#### ✅ Real-Time Interactions
- Concurrent user modifications
- Conflict detection and resolution
- Offline/online synchronization
- Optimistic updates with rollback

### Browser & Device Coverage
- **Desktop**: Chromium, Firefox, WebKit
- **Mobile**: iOS Safari, Android Chrome
- **Responsive**: All screen sizes tested

## 🚨 Common Issues & Solutions

### 🐳 Docker Issues

#### ❌ Docker Services Won't Start
```bash
# Check service status
docker compose ps

# View detailed logs
docker compose logs backend-e2e
docker compose logs frontend-e2e
docker compose logs postgres-e2e

# Complete restart
npm run e2e:teardown
npm run e2e:setup
```

#### ❌ Port Conflicts
```bash
# Check which ports are in use
lsof -i :8002  # Backend E2E
lsof -i :8001  # Frontend E2E  
lsof -i :5435  # Database E2E
lsof -i :6382  # Redis E2E

# Stop conflicting services
docker stop $(docker ps -q)
npm run e2e:setup
```

#### ❌ Database Issues
```bash
# Complete database reset
docker compose down -v  # Remove volumes
npm run e2e:setup       # Recreate everything

# View database logs
docker compose logs postgres-e2e
```

### 🧪 Test Issues

#### Tests Pass Individually but Fail Together
**Root cause**: Using hardcoded emails or inline user creation instead of FileSpecificTestData

**Fix**: Replace with file-specific users
```typescript
// ❌ Causes conflicts
await authHelper.directUserSetup(
  { id: 'admin', email: 'admin@test.com', name: 'Admin' },
  '/family/manage'
);

// ✅ Conflict-free
await authHelper.directUserSetup(testData.getUser('admin'), '/family/manage');
```

#### Email Tests Failing
- Use file-specific emails from testData
- Never call `clearAllEmails()` (breaks parallel tests)
- Wait for specific recipient emails only

#### Tests Timing Out
```bash
# Increase timeout in tests
test('slow operation', async ({ page }) => {
  test.setTimeout(120000); // 2 minutes
});

# Or globally in playwright.config.ts
timeout: 120000  # 2 minutes
```

### 🛠️ Diagnostic Commands

#### Quick Checks
```bash
# Status of all containers
docker ps

# Docker disk usage
docker system df

# Clean Docker resources
docker system prune -f
docker volume prune -f
```

#### Complete Reset
```bash
# Complete reset script
cd e2e/
npm run e2e:teardown
docker system prune -f
docker volume prune -f
npm run e2e:setup
npm run e2e:test
```

### 📋 Diagnostic Checklist

**Before reporting a bug, check:**

- [ ] Docker is running: `docker --version`
- [ ] Ports are free: `lsof -i :8002,:8001,:5435,:6382`
- [ ] Sufficient disk space: `df -h`
- [ ] No other instances: `docker ps`
- [ ] Environment variables: `env | grep NODE_ENV`

### Debug Mode
```typescript
// Pause test execution
await page.pause();

// Take screenshot
await page.screenshot({ path: 'debug.png' });

// Debug mode
PWDEBUG=1 npm run e2e:test

// Step through with browser dev tools
npx playwright test auth/login-flow.spec.ts --debug
```

## 🎯 Best Practices

### Test Structure
1. Use `test.describe.configure({ mode: 'serial' })` within files
2. Create file-specific test data with unique prefixes
3. Pre-create only users who need to exist before tests
4. Let invitation flows create recipient users dynamically

### Data Management
1. **Never use hardcoded emails** like `admin@test.com`
2. **Never clear all emails** (breaks parallel tests)
3. **Use FileSpecificTestData** for all user/family data
4. **Mark invitation recipients** with `willReceiveInvitation: true`
5. **Use predefined user objects** from `testData.getUser()`

### Authentication
1. Use `directUserSetup` for users with existing families/groups
2. Use `authenticateUniqueUser` for new user journeys
3. Use `acceptInvitation` for invitation recipients
4. Never use hardcoded global test users

### Test IDs
1. Always follow `[ComponentName]-[ElementType]-[descriptiveName]` pattern
2. Be component-scoped and specific
3. Avoid regex selectors in tests
4. Update all related tests when changing IDs

## 🔄 Integration with Development

### Pre-commit Hooks
```bash
# Run quick E2E smoke tests
npm run e2e:smoke

# Critical path tests only
npx playwright test --grep "@critical"
```

### Development Workflow
1. **Feature development** → Unit tests
2. **Integration testing** → API tests  
3. **E2E validation** → Critical flows
4. **CI/CD pipeline** → Full test suite

## 📚 Resources

### Documentation
- [Test ID Naming Convention](./.claude/test-id-naming-convention.md)
- [Playwright Documentation](https://playwright.dev/docs)
- [Testing Strategy](../docs/Testing-Strategy.md)
- [Technical Documentation](../docs/Technical-Documentation.md)
- [Docker Compose Reference](https://docs.docker.com/compose/)

### Support
- Check existing test patterns in `./tests/`
- Review fixture helpers in `./tests/fixtures/`
- Consult testing strategy document for methodology

## 📝 Key Principles

- ✅ Use proper test ID naming: `[ComponentName]-[ElementType]-[descriptiveName]`
- ✅ Real user flows only (no mocks, API calls, or fake data)
- ✅ Stable selectors with `data-testid` attributes
- ❌ Do not use regex based selectors like `data-testid*=xxxx`!
- ❌ Do not use multiple selectors
- ✅ Meaningful test failures, not silent passes
- ✅ File-specific test data for complete isolation
- ✅ Serial execution within files, parallel execution between files
- ✅ Enhanced timing mechanisms for CPU-intensive environments

## ⏱️ Centralized Timeout Management for Robust Parallel Execution

### 🚨 Problem: Scattered Timeout Management
When tests manage timeouts individually, it leads to:
- **Inconsistent timing** across test files
- **Manual timeout duplication** (200+ scattered calls)
- **Difficult tuning** of timing parameters
- **CPU-intensive environment failures** due to static waits

### 🔧 Solution: Centralized Timeout Methods in UniversalAuthHelper
All timeout logic is now centralized in `UniversalAuthHelper` with these methods:

#### **Database Consistency Management**
```typescript
// ❌ OLD: Manual scattered timeouts
await new Promise(resolve => setTimeout(resolve, 2000));
await createFamily1();
await new Promise(resolve => setTimeout(resolve, 1000));
await createFamily2();

// ✅ NEW: Centralized database consistency
await authHelper.waitForDatabaseConsistency('create', 5);
await authHelper.createMultipleEntitiesInSequence([
  () => authHelper.createFamilyInDatabase('family1'),
  () => authHelper.createFamilyInDatabase('family2')
], 1000);
```

#### **Email Delivery Management**
```typescript
// ❌ OLD: Progressive manual waits
await new Promise(resolve => setTimeout(resolve, 2000));
await new Promise(resolve => setTimeout(resolve, 3000));
await new Promise(resolve => setTimeout(resolve, 5000));

// ✅ NEW: Centralized email delivery wait
await authHelper.waitForEmailDelivery(3, 2000);
```

#### **UI Animation and Transitions**
```typescript
// ❌ OLD: Scattered UI delays
await page.waitForTimeout(300); // Modal animation
await page.waitForTimeout(2000); // Page transition

// ✅ NEW: Semantic timing methods
await authHelper.waitForModalAnimation();
await authHelper.waitForPageTransition();
```

#### **Available Centralized Timing Methods**
| Method | Purpose | Replaces | Parameters |
|--------|---------|----------|------------|
| `waitForDatabaseConsistency(type, count)` | Database operation stability | Manual sequential timeouts | `'create'\|'update'\|'delete'`, count |
| `waitForEmailDelivery(attempts, baseDelay)` | Progressive email delivery wait | Multiple progressive setTimeout | maxAttempts, baseDelay |
| `waitForModalAnimation(duration)` | Modal/dialog animations | 300ms static waits | duration (default: 300ms) |
| `waitForPageTransition(duration)` | Page navigation transitions | 2000ms static waits | duration (default: 2000ms) |
| `retryWithBackoff(operation, maxRetries, baseDelay)` | Exponential backoff retry | Manual retry loops | operation, maxRetries, baseDelay |
| `createMultipleEntitiesInSequence(operations, delay)` | Batch database operations | Sequential manual waits | operations array, delay between |

#### **Enhanced Authentication Timing (Existing)**
| Method | Purpose | Replaces |
|--------|---------|----------|
| `waitForAuthenticationStability()` | Auth state changes, navigation | `waitForTimeout(2000+)` |
| `waitForSessionSync(state)` | Cross-tab session synchronization | Static waits in multi-tab tests |
| `performLogoutWithSync()` | Enhanced logout with session cleanup | Manual logout + timeout |
| `completeOnboardingWithRetry()` | Robust onboarding with retry logic | Onboarding + static waits |

#### **Implementation Features**
- **Exponential backoff** with jitter to prevent thundering herd
- **Meaningful error messages** when conditions aren't met
- **Automatic timeout handling** with configurable limits
- **Cross-tab session awareness** for multi-device scenarios

#### **Usage Patterns**
```typescript
// Authentication flows
await authHelper.directUserSetup('testUser', '/dashboard');
await authHelper.waitForSessionSync('authenticated');

// Form interactions
await submitButton.click();
await authHelper.waitForAuthenticationStability();

// Multi-tab scenarios
await authHelper.performLogoutWithSync(); // Handles cross-tab cleanup
await authHelper.waitForSessionSync('unauthenticated');

// Invitation flows
await authHelper.completeOnboardingWithRetry('Family Name');
```

#### **Migration Status**
✅ **347+ timing instances replaced** across critical test files:
- All group coordination and lifecycle tests
- Family member management flows  
- Schedule modification and real-time updates
- Authentication and session management
- Email functionality tests

#### **Impact on Test Reliability**
- **Eliminates timing-related flakiness** in parallel execution
- **Handles variable CPU load** gracefully
- **Provides meaningful failures** instead of silent passes
- **Maintains fast execution** while ensuring reliability

---

**🎯 The E2E testing suite ensures EduLift delivers reliable, high-quality user experiences across all platforms and scenarios.**