# Spécifications d'Intégration du Concept Famille - EduLift

## 🏗️ Note Architecturale

**IMPORTANT**: Le système famille est conçu pour fonctionner **en parallèle** avec le système de groupes existant, pas pour le remplacer :

- **Familles**: Propriété des ressources (enfants, véhicules) - "Qui possède quoi"  
- **Groupes**: Coordination des horaires (créneaux, trajets) - "Quand et où"

Pour l'information architecturale détaillée, voir [Architecture-Family-vs-Groups.md](./Architecture-Family-vs-Groups.md)

## 🎯 Vue d'Ensemble

### Objectif
Introduire le concept "famille" dans EduLift pour permettre la gestion partagée des enfants et véhicules entre plusieurs utilisateurs (parents, tuteurs, etc.).

### Problématique Actuelle
- Chaque utilisateur gère individuellement ses enfants et véhicules
- Pas de partage possible entre conjoints/famille
- Gestion dupliquée et source d'erreurs

### Solution Proposée
- **Entité Famille** : Regroupement d'utilisateurs avec rôles
- **Ressources Partagées** : Enfants et véhicules appartiennent à la famille
- **Permissions Graduées** : ADMIN, PARENT, MEMBER

---

## 📊 PHASE 1 : SPÉCIFICATION

### Modèle de Données

#### Nouvelle Entité Family
```prisma
model Family {
  id          String   @id @default(cuid())
  name        String   // "Famille Dupont"
  inviteCode  String   @unique // Code pour rejoindre
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relations
  members     FamilyMember[]
  children    Child[]
  vehicles    Vehicle[]
  
  @@map("families")
}
```

#### Table de Liaison avec Rôles
```prisma
model FamilyMember {
  id        String   @id @default(cuid())
  familyId  String
  userId    String
  role      FamilyRole  @default(MEMBER)
  joinedAt  DateTime @default(now())
  
  // Relations
  family    Family @relation(fields: [familyId], references: [id], onDelete: Cascade)
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([familyId, userId])
  @@map("family_members")
}

enum FamilyRole {
  ADMIN    // Peut gérer la famille, inviter/supprimer membres
  PARENT   // Peut gérer enfants et véhicules
  MEMBER   // Accès en lecture, peut contribuer aux trajets
}
```

#### Modifications des Entités Existantes
```prisma
// Child : migration de userId vers familyId
model Child {
  id       String @id @default(cuid())
  name     String
  age      Int
  familyId String  // CHANGEMENT: était userId
  
  family   Family @relation(fields: [familyId], references: [id], onDelete: Cascade)
  // SUPPRESSION: user User @relation(fields: [userId], references: [id])
}

// Vehicle : migration de userId vers familyId  
model Vehicle {
  id       String @id @default(cuid())
  name     String
  capacity Int
  familyId String  // CHANGEMENT: était userId
  
  family   Family @relation(fields: [familyId], references: [id], onDelete: Cascade)
  // SUPPRESSION: user User @relation(fields: [userId], references: [id])
}

// User : nouvelles relations famille
model User {
  id              String @id @default(cuid())
  email           String @unique
  name            String
  
  // NOUVELLE RELATION
  familyMemberships FamilyMember[]
  
  // SUPPRESSION des relations directes
  // children        Child[]
  // vehicles        Vehicle[]
}
```

### Règles Métier

#### 1. Création de Famille
- Un utilisateur peut créer UNE famille en tant qu'ADMIN
- Famille automatiquement créée lors du premier signup
- Nom de famille obligatoire (ex: "Famille Dupont")
- Code d'invitation généré automatiquement

#### 2. Adhésion à une Famille
- Via code d'invitation partageable
- Maximum 6 membres par famille (configurable)
- Un utilisateur = UNE seule famille (contrainte métier)
- Nouveau membre ajouté avec rôle MEMBER par défaut

#### 3. Permissions par Rôle
- **ADMIN** : 
  - Gérer les membres (inviter, supprimer, changer rôles)
  - Gérer enfants et véhicules
  - Supprimer la famille
- **PARENT** : 
  - Gérer enfants et véhicules de la famille
  - Voir tous les membres
- **MEMBER** : 
  - Accès en lecture aux enfants/véhicules
  - Participer aux trajets
  - Voir les membres

#### 4. Contraintes de Sécurité
- Minimum 1 ADMIN par famille (empêcher suppression du dernier admin)
- Validation des codes d'invitation (expiration optionnelle)
- Logs d'activité pour changements de permissions

---

## 🔄 PHASE 2 : PSEUDOCODE

### Service de Gestion des Familles

```typescript
class FamilyService {
  
  // Création d'une famille (première inscription)
  async createFamily(userId: string, familyName: string): Promise<Family> {
    BEGIN_TRANSACTION
    
    // Vérifier que l'utilisateur n'a pas déjà de famille
    IF user.hasFamily() THEN
      THROW FamilyAlreadyExistsError
    END IF
    
    // Créer la famille
    family = CREATE Family {
      name: familyName,
      inviteCode: generateInviteCode()
    }
    
    // Ajouter l'utilisateur comme ADMIN
    CREATE FamilyMember {
      familyId: family.id,
      userId: userId,
      role: ADMIN
    }
    
    COMMIT_TRANSACTION
    RETURN family
  }
  
  // Rejoindre une famille existante
  async joinFamily(userId: string, inviteCode: string): Promise<Family> {
    BEGIN_TRANSACTION
    
    // Vérifications préalables
    IF user.hasFamily() THEN THROW UserAlreadyInFamilyError
    
    family = FIND Family WHERE inviteCode = inviteCode
    IF NOT family THEN THROW InvalidInviteCodeError
    
    IF family.members.count >= MAX_FAMILY_MEMBERS THEN
      THROW FamilyFullError
    END IF
    
    // Ajouter comme MEMBER
    CREATE FamilyMember {
      familyId: family.id,
      userId: userId,
      role: MEMBER
    }
    
    COMMIT_TRANSACTION
    RETURN family
  }
  
  // Changement de rôle (admin seulement)
  async changeRole(adminUserId: string, targetUserId: string, newRole: FamilyRole): Promise<void> {
    // Vérifications d'autorisation
    adminMember = FIND FamilyMember WHERE userId = adminUserId AND role = ADMIN
    IF NOT adminMember THEN THROW UnauthorizedError
    
    targetMember = FIND FamilyMember WHERE userId = targetUserId AND familyId = adminMember.familyId
    IF NOT targetMember THEN THROW UserNotInFamilyError
    
    // Empêcher qu'il n'y ait plus d'admin
    IF targetMember.role = ADMIN AND newRole != ADMIN THEN
      adminsCount = COUNT FamilyMember WHERE familyId = adminMember.familyId AND role = ADMIN
      IF adminsCount <= 1 THEN
        THROW MustHaveAtLeastOneAdminError
      END IF
    END IF
    
    UPDATE targetMember SET role = newRole
  }
}
```

### Service d'Autorisation

```typescript
class FamilyAuthService {
  
  // Vérifier l'accès aux enfants
  async canAccessChild(userId: string, childId: string): Promise<boolean> {
    userFamily = GET_USER_FAMILY(userId)
    child = FIND Child WHERE id = childId
    
    RETURN child.familyId = userFamily.id
  }
  
  // Vérifier la permission de modification
  async canModifyChild(userId: string, childId: string): Promise<boolean> {
    IF NOT canAccessChild(userId, childId) THEN RETURN false
    
    userRole = GET_USER_ROLE_IN_FAMILY(userId)
    RETURN userRole IN [ADMIN, PARENT]
  }
  
  // Middleware d'autorisation famille
  function familyAuthMiddleware(requiredRole?: FamilyRole) {
    RETURN (req, res, next) => {
      userId = req.user.id
      userFamily = GET_USER_FAMILY(userId)
      
      IF NOT userFamily THEN
        RETURN res.status(403).json({error: "User must belong to a family"})
      END IF
      
      IF requiredRole THEN
        userRole = GET_USER_ROLE_IN_FAMILY(userId)
        IF NOT hasPermission(userRole, requiredRole) THEN
          RETURN res.status(403).json({error: "Insufficient family permissions"})
        END IF
      END IF
      
      req.family = userFamily
      req.familyRole = userRole
      next()
    }
  }
}
```

### Algorithme de Migration

```typescript
class FamilyMigrationService {
  
  async migrateExistingUsersToFamilies(): Promise<void> {
    BEGIN_TRANSACTION
    
    allUsers = GET ALL Users
    
    FOR EACH user IN allUsers DO
      // Créer une famille par défaut
      family = CREATE Family {
        name: `Famille ${user.name}`,
        inviteCode: generateInviteCode()
      }
      
      // Ajouter l'utilisateur comme admin
      CREATE FamilyMember {
        familyId: family.id,
        userId: user.id,
        role: ADMIN
      }
      
      // Migrer ses enfants
      UPDATE Children SET familyId = family.id WHERE userId = user.id
      
      // Migrer ses véhicules
      UPDATE Vehicles SET familyId = family.id WHERE userId = user.id
      
    END FOR
    
    COMMIT_TRANSACTION
  }
}
```

---

## 🏗️ ARCHITECTURE DÉTAILLÉE

### Backend - Structure des Services

```
src/
├── services/
│   ├── FamilyService.ts          # Gestion CRUD familles
│   ├── FamilyAuthService.ts      # Autorisation et permissions
│   ├── FamilyMigrationService.ts # Migration des données
│   └── FamilyInviteService.ts    # Gestion codes d'invitation
├── controllers/
│   └── FamilyController.ts       # Endpoints REST
├── middleware/
│   └── familyAuth.ts            # Middleware d'autorisation
└── migrations/
    └── add_family_system.sql    # Script de migration DB
```

### API Endpoints

```typescript
// Nouveaux endpoints famille
POST   /api/v1/families                    # Créer famille
GET    /api/v1/families/current           # Famille actuelle
POST   /api/v1/families/join              # Rejoindre avec code
GET    /api/v1/families/invite-code       # Générer/récupérer code
PUT    /api/v1/families/members/:id/role  # Changer rôle membre
DELETE /api/v1/families/members/:id       # Supprimer membre
GET    /api/v1/families/members           # Liste des membres

// Endpoints modifiés avec contexte famille
GET    /api/v1/children     # Enfants de la famille (au lieu de l'utilisateur)
POST   /api/v1/children     # Créer enfant pour la famille
GET    /api/v1/vehicles     # Véhicules de la famille
POST   /api/v1/vehicles     # Créer véhicule pour la famille
```

### Frontend - Architecture React

```
src/
├── contexts/
│   └── FamilyContext.tsx        # État global famille
├── components/
│   ├── family/
│   │   ├── FamilyOnboarding.tsx # Première configuration
│   │   ├── FamilyMembersList.tsx
│   │   ├── JoinFamilyModal.tsx
│   │   └── InviteCodeDisplay.tsx
│   └── guards/
│       └── FamilyProtectedRoute.tsx
├── hooks/
│   ├── useFamilyAuth.tsx        # Permissions par rôle
│   └── useFamilyData.tsx        # État famille
└── pages/
    └── FamilySetupPage.tsx      # Page configuration famille
```

---

## 🧪 STRATÉGIE TDD

### Tests par Fonctionnalité

#### 1. Création de Famille
```typescript
describe('FamilyService.createFamily', () => {
  it('should create family and add user as admin')
  it('should generate unique invite code')
  it('should throw error if user already has family')
  it('should validate family name requirements')
})
```

#### 2. Adhésion à une Famille
```typescript
describe('FamilyService.joinFamily', () => {
  it('should add user to family with MEMBER role')
  it('should throw error for invalid invite code')
  it('should throw error if family is full')
  it('should throw error if user already in family')
})
```

#### 3. Autorisations
```typescript
describe('FamilyAuthService', () => {
  it('should allow ADMIN to modify any resource')
  it('should allow PARENT to modify children and vehicles')
  it('should restrict MEMBER to read-only access')
  it('should deny access to resources from other families')
})
```

#### 4. Migration de Données
```typescript
describe('FamilyMigrationService', () => {
  it('should create family for each existing user')
  it('should migrate children to family ownership')
  it('should migrate vehicles to family ownership')
  it('should preserve data integrity during migration')
  it('should support rollback in case of error')
})
```

### Cycle TDD pour Chaque Feature

1. **❌ RED** : Écrire test qui échoue
2. **✅ GREEN** : Code minimal pour faire passer
3. **🔄 REFACTOR** : Optimiser et nettoyer
4. **📊 VERIFY** : Vérifier couverture 90%+

---

## 📋 PLAN D'IMPLÉMENTATION

### Étape 1 : Foundation (TDD)
- [ ] Tests et implémentation `FamilyService`
- [ ] Tests et implémentation `FamilyAuthService`
- [ ] Tests et migration de base de données

### Étape 2 : API Backend (TDD)
- [ ] Tests et endpoints famille
- [ ] Tests et middleware d'autorisation
- [ ] Tests et modification endpoints existants

### Étape 3 : Frontend Core (TDD)
- [ ] Tests et `FamilyContext`
- [ ] Tests et composants onboarding
- [ ] Tests et hooks d'autorisation

### Étape 4 : Integration (TDD)
- [ ] Tests d'intégration bout-en-bout
- [ ] Migration des données existantes
- [ ] Tests de non-régression

### Étape 5 : Déploiement
- [ ] Tests en environnement de staging
- [ ] Migration production avec rollback
- [ ] Monitoring et métriques

---

## ⚡ Contraintes Techniques

### Performance
- Index sur `familyId` pour enfants/véhicules
- Cache des permissions utilisateur
- Pagination pour listes de membres

### Sécurité
- Validation stricte des rôles
- Logs d'audit pour changements
- Chiffrement des codes d'invitation

### Monitoring
- Métriques d'adoption des familles
- Alertes sur erreurs de permissions
- Suivi des migrations de données

---

**Status** : Spécifications complètes ✅  
**Prochaine étape** : PHASE 3 - Architecture détaillée et début d'implémentation TDD