# Stratégie de Migration des Endpoints d'Invitation

**Date:** 29 décembre 2025
**Version:** 2.1
**Statut:** Document de travail - Révision technique
**Auteur:** Équipe technique EduLift

---

## 1. Résumé Exécutif

### Problématique

Le backend EduLift présente actuellement une **duplication des endpoints d'invitation** entre les contrôleurs spécialisés (FamilyController, GroupController) et le nouveau contrôleur unifié (InvitationController). Cette situation crée une complexité technique et peut entraîner des incohérences de comportement entre les différents clients (web et mobile).

**Points critiques:**
- Les endpoints existants dans `FamilyController` et `GroupController` sont utilisés par l'application mobile
- Les nouveaux endpoints spécifiques dans `InvitationController` offrent une architecture plus flexible et maintenable
- Cette duplication complexifie la maintenance et les tests

### Décision Architecturale

**Les endpoints unifiés ont été SUPPRIMÉS pour éliminer la duplication.**

L'architecture retenu privilégie **la clarté sur la consolidation**:
- ✅ **Endpoints spécifiques** pour les invitations famille vs groupe
- ✅ **Validation typée** avec des endpoints distincts par type
- ❌ **Pas d'endpoints unifiés** qui créeraient de la confusion

**Raisonnement:**
- Les endpoints spécifiques sont plus explicites et plus faciles à documenter
- La validation type-spécifique est plus sûre (type: 'FAMILY' vs type: 'GROUP')
- Les clients savent exactement quel endpoint appeler selon le contexte
- Évite la confusion "unifié vs spécifique"

### Objectif de la Migration

Migrer tous les endpoints d'invitation vers `InvitationController` avec des endpoints **spécifiques par type**, tout en assurant:
1. **Compatibilité ascendante** - L'application mobile continue de fonctionner
2. **Transition sans interruption** - Aucun temps d'arrêt pour les utilisateurs
3. **Clarté améliorée** - Chaque endpoint a une responsabilité claire et typée

---

## 2. Analyse de l'Architecture Actuelle

### 2.1 Architecture Ancienne (Controllers Spécialisés)

#### FamilyController
**Fichier:** `/backend/src/controllers/FamilyController.ts`

| Endpoint | Méthode | Description | Statut |
|----------|---------|-------------|--------|
| `/families/validate-invite` | POST | Valide un code d'invitation famille | ⚠️ À migrer |
| `/families/{familyId}/invite` | POST | Crée une invitation famille | ⚠️ À migrer |
| `/families/{familyId}/invitations` | GET | Liste les invitations d'une famille | ⚠️ À migrer |
| `/families/{familyId}/invitations/{invitationId}` | DELETE | Annule une invitation famille | ⚠️ À migrer |

#### GroupController
**Fichier:** `/backend/src/controllers/GroupController.ts`

| Endpoint | Méthode | Description | Statut |
|----------|---------|-------------|--------|
| `/groups/validate-invite` | POST | Valide un code d'invitation groupe | ⚠️ À migrer |
| `/groups/{groupId}/invite` | POST | Invite une famille à un groupe | ✅ UTILISÉ PAR MOBILE - CRITIQUE |
| `/groups/{groupId}/search-families` | POST | Recherche des familles à inviter | ✅ UTILISÉ PAR MOBILE - CRITIQUE |

### 2.2 Architecture Nouvelle (InvitationController - Spécialisé par Type)

**Fichier:** `/backend/src/controllers/InvitationController.ts`

**Service sous-jacent:** `/backend/src/services/UnifiedInvitationService.ts`

**Statut de déploiement:**
- InvitationController est DÉJÀ déployé en production
- Les endpoints `/invitations/*` sont accessibles depuis [DATE À COMPLÉTER]
- MAIS ne sont pas encore utilisés par les applications frontends
- Les anciens endpoints restent actifs pour compatibilité

#### Endpoints Famille (5 endpoints)

| Endpoint | Méthode | Description | Avantages |
|----------|---------|-------------|-----------|
| `/invitations/family` | POST | Crée une invitation famille | ✅ Plus flexible |
| `/invitations/family/{code}/validate` | GET | Valide une invitation famille | ✅ **Typée**: `type: 'FAMILY'` |
| `/invitations/family/{code}/accept` | POST | Accepte une invitation famille | ✅ Gestion de quitter famille actuelle |
| `/invitations/family/{invitationId}` | DELETE | Annule une invitation famille | ✅ Gestion des permissions |

**Note:** La validation retourne un objet avec `type: 'FAMILY'` explicite.

#### Endpoints Groupe (4 endpoints)

| Endpoint | Méthode | Description | Avantages |
|----------|---------|-------------|-----------|
| `/invitations/group` | POST | Crée une invitation groupe | ✅ Plus flexible (par familyId OU email) |
| `/invitations/group/{code}/validate` | GET | Valide une invitation groupe | ✅ **Typée**: `type: 'GROUP'` |
| `/invitations/group/{code}/accept` | POST | Accepte une invitation groupe | ✅ Gestion des enfants automatique |
| `/invitations/group/{invitationId}` | DELETE | Annule une invitation groupe | ✅ Gestion des permissions |

**Note:** La validation retourne un objet avec `type: 'GROUP'` explicite.

**Important:**
- ❌ **PAS d'endpoint unifié** `GET /invitations/validate/{code}` - éliminé pour éviter la confusion
- ❌ **PAS d'endpoint unifié** `GET /invitations/user` - les clients doivent appeler les endpoints spécifiques
- ✅ **9 endpoints au total** (au lieu de 11 avec les endpoints unifiés)
- ✅ **Clarté** - Chaque endpoint a une responsabilité claire

### 2.3 Comparaison des Approches

#### Ancienne Approche Group Invitation

```typescript
POST /groups/{groupId}/invite
Body: {
  familyId: string;      // Requis - ID de la famille à inviter
  role: 'ADMIN' | 'MEMBER';
  personalMessage?: string;
}
```

**Limitation:** Ne permet que l'invitation par ID de famille connu

#### Nouvelle Approche Group Invitation

```typescript
POST /invitations/group
Body: {
  groupId: string;       // ID du groupe (dans le body, pas dans l'URL)
  targetFamilyId?: string;  // Optionnel - Invitation par famille
  email?: string;        // Optionnel - Invitation par email
  role: 'ADMIN' | 'MEMBER';
  personalMessage?: string;
}
```

**Avantages:**
- ✅ Flexibilité: Invitation par famille OU par email
- ✅ Architecture RESTful plus cohérente
- ✅ Séparation des responsabilités claire
- ✅ Validation unifiée dans `UnifiedInvitationService`
- ✅ **Endpoint spécifique** - pas d'ambiguïté sur le type

#### Validation Spécifique vs Unifiée

```typescript
// ❌ Approche unifiée (SUPPRIMÉE - trop confuse)
GET /invitations/validate/{code}
Response: {
  type: 'FAMILY' | 'GROUP',  // Client doit tester ce champ
  ...
}

// ✅ Approche spécifique (RETENUE - plus claire)
GET /invitations/family/{code}/validate
Response: {
  type: 'FAMILY',  // Explicite par l'endpoint appelé
  ...
}

GET /invitations/group/{code}/validate
Response: {
  type: 'GROUP',  // Explicite par l'endpoint appelé
  ...
}
```

---

## 3. Stratégie de Migration

### 3.1 Principes Directeurs

1. **Sécurité d'abord** - Ne jamais casser l'application mobile en production
2. **Migration progressive** - Phases clairement définies avec rollback possible
3. **Coordination équipe** - Synchronisation backend/frontend web/frontend mobile
4. **Tests exhaustifs** - Couverture complète avant chaque phase
5. **Documentation continue** - Mise à jour de la documentation à chaque étape
6. **Clarté avant consolidation** - Privilégier des endpoints explicites plutôt que unifiés

### 3.2 Approche Recommandée: Migration en 4 Phases

#### Phase 1: Préparation et Stabilisation (Semaine 1-2)

**Objectif:** Assurer que l'ancienne architecture fonctionne correctement

**Actions:**

1. **Documentation complète des endpoints existants**
   - Créer un inventaire détaillé de tous les endpoints d'invitation
   - Documenter les payloads request/response exacts
   - Cartographier les dépendances frontend/backend

2. **Tests d'acceptation pour l'application mobile**
   - Tests E2E pour tous les flows d'invitation mobile
   - Tests de régression pour valider qu'aucune fonctionnalité n'est cassée
   - Documentation des comportements attendus

3. **Marquage des endpoints critiques**
   - Ajouter des commentaires TODO dans les contrôleurs
   - Identifier les endpoints utilisés par mobile vs web
   - Créer un dashboard de surveillance

**Livréables:**
- ✅ Inventaire documenté des endpoints existants
- ✅ Suite de tests E2E pour mobile
- ✅ Marquage clair du code à migrer

#### Phase 2: Introduction des Nouveaux Endpoints (Semaine 3-4)

**Objectif:** Déployer les nouveaux endpoints spécifiques en parallèle sans déprécier les anciens

**Actions:**

1. **Déploiement en production de InvitationController**
   - Vérifier que tous les nouveaux endpoints spécifiques sont déployés
   - Valider OpenAPI/Swagger généré correctement
   - Tester tous les nouveaux endpoints manuellement

2. **Communication à l'équipe frontend**
   - Réunion de présentation de la nouvelle architecture
   - **Clarifier:** PAS d'endpoints unifiés - que des endpoints spécifiques
   - Documentation des nouveaux endpoints avec exemples
   - Période de feedback et ajustement

3. **Migration du frontend web**
   - Mise à jour de `frontend/src/services/familyApiService.ts`
   - Mise à jour de `frontend/src/services/groupApiService.ts`
   - **Important:** Utiliser les endpoints spécifiques (family vs group)
   - Tests complets du frontend web avec les nouveaux endpoints

**Livréables:**
- ✅ Nouveaux endpoints spécifiques déployés et documentés
- ✅ Frontend web migré vers la nouvelle architecture
- ✅ Anciens endpoints toujours fonctionnels

#### Phase 3: Migration de l'Application Mobile (Semaine 5-8)

**Objectif:** Migrer progressivement l'application mobile vers les nouveaux endpoints spécifiques

**Actions:**

1. **Release Mobile avec Support Hybride**
   - Version mobile qui supporte les deux architectures
   - Feature flag pour basculer entre ancien/nouveau
   - Telemetry pour surveiller l'adoption

2. **Migration des endpoints critiques**

   **Endpoint 1: POST /groups/{groupId}/invite**
   ```dart
   // Flutter/Dart - Ancien code
   Future<void> inviteFamily(String groupId, String familyId, String role) async {
     await dio.post('/groups/$groupId/invite', data: {
       'familyId': familyId,
       'role': role
     });
   }

   // Flutter/Dart - Nouveau code (endpoint spécifique)
   Future<void> inviteFamily(String groupId, String familyId, String role) async {
     await dio.post('/invitations/group', data: {
       'groupId': groupId,
       'targetFamilyId': familyId,
       'role': role
     });
   }
   ```

   **Endpoint 2: POST /groups/{groupId}/search-families**

   **⚠️ CRITIQUE - Problème de duplication à résoudre:**

   L'endpoint `POST /groups/{groupId}/search-families` EXISTE DÉJÀ dans GroupController et est UTILISÉ par l'application mobile.

   **Stratégie de migration CORRECTE:**

   1. **NE PAS créer** de nouveau endpoint `/invitations/groups/search-families`
   2. **Migrer la logique** depuis GroupController vers InvitationController
   3. **Garder le même chemin** pendant la transition: `/groups/{groupId}/search-families`
   4. **Procédure de migration:**
      - Étape 1: Ajouter un endpoint alias dans InvitationController
      - Étape 2: Mettre à jour l'app mobile pour pointer vers ce nouvel endpoint
      - Étape 3: Déprécier l'ancien endpoint dans GroupController (ajouter header Deprecation)
      - Étape 4: Supprimer l'ancien endpoint après validation

   **⚠️ IMPORTANT:**
   - NE PAS avoir les deux endpoints actifs simultanément avec des logiques différentes
   - S'assurer que le comportement est IDENTIQUE pendant la transition
   - Documenter clairement la date de migration dans le code

3. **Tests et validation mobile**
   - Tests bêta avec un groupe d'utilisateurs restreint
   - Surveillance des erreurs et feedback
   - Ajustements basés sur les remontées terrain

**Livréables:**
- ✅ Version mobile avec support des nouveaux endpoints spécifiques
- ✅ Tests bêta validés
- ✅ Documentation de migration mobile

#### Phase 4: Dépréciation et Nettoyage (Semaine 9-10)

**Objectif:** Supprimer les anciens endpoints après validation complète

**Actions:**

1. **Validation complète**
   - Taux d'utilisation des anciens endpoints < 5%
   - Aucune erreur remontée sur les nouveaux endpoints
   - Performance équivalente ou meilleure

2. **Dépréciation formelle des anciens endpoints**
   - Ajout de headers de dépréciation HTTP
   - Documentation mise à jour avec avertissements
   - Communication aux développeurs externes (API publique)

3. **Suppression du code**
   - Retrait des endpoints dans FamilyController
   - Retrait des endpoints dans GroupController
   - Nettoyage des tests associés

4. **Mise à jour de la documentation**
   - OpenAPI/Swagger nettoyé
   - README mis à jour
   - Guides de développement mis à jour

**Livréables:**
- ✅ Anciens endpoints supprimés
- ✅ Code nettoyé et documenté
- ✅ Architecture avec endpoints spécifiques en place

### 3.3 Stratégie de Versioning API

#### Option 1: Versioning par URL (Recommandé)

```typescript
/api/v1/groups/{groupId}/invite    → Ancienne version
/api/v2/invitations/group          → Nouvelle version spécifique
```

**Avantages:**
- ✅ Coexistence pacifique des deux versions
- ✅ Migration progressive sans breaking changes immédiats
- ✅ Facile à déprécier v1 quand v2 est stable
- ✅ Claire pour les développeurs API

**Inconvénients:**
- ⚠️ Nécessite de router toutes les routes
- ⚠️ Plus complexe à maintenir temporairement

#### Option 2: Versioning par Header (Alternative)

```typescript
API-Version: 1 → Utilise anciens endpoints
API-Version: 2 → Utilise nouveaux endpoints spécifiques
```

**Avantages:**
- ✅ URL plus propres
- ✅ Flexible pour les tests A/B

**Inconvénients:**
- ⚠️ Moins visible dans le code
- ⚠️ Difficile à déboguer
- ⚠️ Nécessite plus de documentation

**Décision:** **Option 1 retenue** pour clarté et simplicité du routing

**Implémentation proposée:**

```typescript
// Dans main.ts ou app.ts
const app = new Hono();

// API v1 - Ancienne architecture (dépréciée)
const v1Router = new Hono();
v1Router.route('/groups', groupController);  // Anciens endpoints
v1Router.route('/families', familyController);  // Anciens endpoints

// API v2 - Nouvelle architecture avec endpoints spécifiques
const v2Router = new Hono();
v2Router.route('/invitations', invitationController);  // Nouveaux endpoints spécifiques

app.route('/api/v1', v1Router);
app.route('/api/v2', v2Router);
```

---

## 4. Analyse d'Impact

### 4.1 Backend

**Fichiers à modifier:**

1. **Controllers:**
   - `/backend/src/controllers/FamilyController.ts` - Retirer endpoints d'invitation
   - `/backend/src/controllers/GroupController.ts` - Retirer endpoints d'invitation
   - `/backend/src/controllers/InvitationController.ts` - Ajouter endpoint de recherche familles

2. **Services:**
   - `/backend/src/services/UnifiedInvitationService.ts` - Compléter si nécessaire
   - `/backend/src/services/GroupService.ts` - Nettoyer après migration

3. **Tests:**
   - Mettre à jour tous les tests de controllers
   - Mettre à jour les tests d'intégration
   - Ajouter des tests de migration

**Risques:**
- ⚠️ **Modifications impactantes** si les signatures de méthodes changent
- ⚠️ **Tests à réécrire** complètement pour les nouveaux endpoints
- ⚠️ **Performance** à surveiller pendant la transition

### 4.2 Frontend Web

**Fichiers à modifier:**

1. **Services API:**
   - `/frontend/src/services/familyApiService.ts`
   - `/frontend/src/services/groupApiService.ts`

2. **Pages:**
   - `/frontend/src/pages/ManageFamilyPage.tsx`
   - `/frontend/src/pages/ManageGroupPage.tsx`
   - `/frontend/src/pages/DashboardPage.tsx`

3. **Types:**
   - `/frontend/src/types/api.ts` - Mettre à jour les interfaces TypeScript

**Exemple de migration:**

```typescript
// Ancien code (familyApiService.ts)
export async function inviteToFamily(familyId: string, data: {
  email: string;
  role: 'ADMIN' | 'MEMBER';
}) {
  return apiInstance.post(`/families/${familyId}/invite`, data);
}

// Nouveau code (endpoint spécifique)
export async function inviteToFamily(data: {
  familyId: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  personalMessage?: string;
}) {
  return apiInstance.post('/invitations/family', data);
}
```

#### 4.2.4 Impact du Refactoring sur les Appelants

**Breaking Changes:**

- **Ancienne signature:** `inviteToFamily(familyId: string, data: { email, role })`
- **Nouvelle signature:** `inviteToFamily(data: { familyId, email, role, personalMessage? })`

**Estimation de l'impact:**

- **Nombre de fichiers à modifier:** ~15-20 fichiers TypeScript
- **Composants React concernés:** ManageFamilyPage, InvitationModal, FamilySettings, DashboardPage
- **Services à mettre à jour:** familyApiService.ts, groupApiService.ts, scheduleConfigService.ts

**Exemples d'appelants à modifier:**

```typescript
// AVANT (ManageFamilyPage.tsx)
const handleInvite = async () => {
  await inviteToFamily(familyId, {
    email: newMemberEmail,
    role: 'MEMBER'
  });
};

// APRÈS
const handleInvite = async () => {
  await inviteToFamily({
    familyId: familyId,
    email: newMemberEmail,
    role: 'MEMBER',
    personalMessage: 'Bienvenue dans notre famille!'
  });
};
```

**Stratégie de migration:**

1. **Créer une méthode wrapper** pendant la transition:
   ```typescript
   // Méthode legacy temporaire
   export async function inviteToFamilyLegacy(
     familyId: string,
     data: { email: string; role: 'ADMIN' | 'MEMBER' }
   ) {
     return inviteToFamily({ familyId, ...data });
   }
   ```

2. **Mettre à jour les appelants** progressivement
3. **Supprimer la méthode legacy** après validation complète

**Risques:**
- ⚠️ **Breaking changes** dans les signatures de fonctions
- ⚠️ **Refactoring important** des composants UI
- ⚠️ **Tests unitaires** à mettre à jour

### 4.3 Frontend Mobile

**Fichiers à modifier (Flutter/Dart):**

1. **Services API:**
   - `lib/services/group_api_service.dart` - Migrer `inviteFamily()` et `searchFamilies()`
   - `lib/services/invitation_api_service.dart` - Nouveau fichier pour les nouveaux endpoints spécifiques

2. **Modèles:**
   - `lib/models/invitation.dart` - Adapter aux nouvelles réponses avec `type` explicite

3. **Pages/Écrans:**
   - `lib/screens/group/manage_group_screen.dart`
   - `lib/screens/invitation/invitation_screen.dart`

**Risques:**
- ⚠️ **Release mobile** requise (processus plus lent que web)
- ⚠️ **Compatibilité version** - Gérer les utilisateurs qui ne mettent pas à jour
- ⚠️ **Tests manuels** sur appareils réels indispensables

---

## 5. Timeline et Phasage Détaillé

### Diagramme de Gantt

```
Phase 1: Préparation        ████████ (Semaines 1-2)
Phase 2: Nouveaux Endpoints  ████████ (Semaines 3-4)
Phase 3: Migration Mobile    ████████████████████████ (Semaines 5-12)
Phase 4: Nettoyage          ████████ (Semaines 13-14)
Phase 5: Review Stores      ████████ (Semaines 15-16)

Total: 16 semaines
```

**Note importante:**
- Phase 3 étendue de 4 à 8 semaines pour inclure:
  - Tests bêta plus longs
  - Ajustements itératifs basés sur feedback
  - **Buffer de 2 semaines** pour App Store/Google Play review
- Phase 5 ajoutée pour gérer les délais d'approbation des stores

### Planning Détaillé

#### Semaine 1: Phase 1 - Démarrage

- **Lundi:** Réunion de kick-off, assignation des tâches
- **Mardi:** Documentation des endpoints existants
- **Mercredi:** Création des tests E2E pour mobile
- **Jeudi:** Revue de code et validation
- **Vendredi:** Démo des tests et documentation

#### Semaine 2: Phase 1 - Finalisation

- **Lundi-Mercredi:** Finalisation des tests et documentation
- **Jeudi:** Revue technique avec l'équipe complète
- **Vendredi:** Validation de la fin de Phase 1

#### Semaines 3-4: Phase 2 - Déploiement Nouveaux Endpoints

- **Semaine 3:**
  - Déploiement InvitationController en recette
  - Tests manuels et automatisés
  - Ajustements basés sur les retours

- **Semaine 4:**
  - Déploiement en production
  - Migration du frontend web vers les endpoints spécifiques
  - Documentation et formation équipe

#### Semaines 5-12: Phase 3 - Migration Mobile (8 semaines)

- **Semaine 5:**
  - Début du développement mobile hybride
  - Feature flag implémenté
  - Tests techniques internes

- **Semaine 6:**
  - Beta test interne équipe
  - Ajustements basés sur feedback interne
  - Correction bugs critiques

- **Semaine 7:**
  - Beta test externe (groupe restreint - 10 utilisateurs)
  - Collecte de feedback structuré
  - Priorisation des corrections

- **Semaine 8:**
  - Correction bugs priorité haute
  - Nouveau build beta test
  - Validation corrections

- **Semaine 9:**
  - Extension beta test (50 utilisateurs)
  - Monitoring approfondi
  - Tests de performance

- **Semaine 10:**
  - Finalisation fonctionnalités
  - Préparation build release
  - Documentation pour les stores

- **Semaine 11:**
  - **Soumission App Store** (buffer 1 semaine)
  - **Soumission Google Play** (review plus rapide)
  - Monitoring des retours review

- **Semaine 12:**
  - Validation approbation store
  - Release publique progressive
  - Surveillance incidents

#### Semaines 13-14: Phase 4 - Nettoyage

- **Semaine 13:**
  - Validation adoption nouveaux endpoints
  - Dépréciation formelle anciens endpoints
  - Suppression du code legacy

- **Semaine 14:**
  - Finalisation documentation
  - Rétrospective projet
  - Clôture

#### Semaines 15-16: Phase 5 - Review Stores (OPTIONNEL)

Cette phase n'est active que si les stores n'ont pas approuvé avant la fin de la Phase 3.

- **Semaine 15:**
  - Suivi approbation App Store
  - Communication avec support Apple
  - Documentation incident si rejet

- **Semaine 16:**
  - Soumission révision si nécessaire
  - Release finale
  - Bilan final projet

---

## 6. Risques et Atténuations

### 6.1 Matrice des Risques

| Risque | Probabilité | Impact | Niveau | Atténuation |
|--------|-------------|--------|--------|-------------|
| Regression application mobile | Élevée | Critique | 🔴 **Élevé** | Tests E2E, Beta test, Feature flag |
| Performance dégradée nouveaux endpoints | Moyenne | Moyen | 🟡 **Moyen** | Benchmark, Monitoring, Optimisation |
| Adoption lente nouveaux endpoints | Faible | Faible | 🟢 **Faible** | Documentation, Support, Période transition |
| Breaking changes non détectés | Moyenne | Critique | 🟡 **Moyen** | Tests régression, Review code approfondie |
| Perte d'utilisateurs pendant migration | Faible | Critique | 🟡 **Moyen** | Communication, Rollback plan |
| Confusion endpoints spécifiques vs unifiés | Faible | Moyen | 🟢 **Faible** | Documentation claire, Communication équipe |

### 6.2 Plans d'Atténuation Détaillés

#### Risque 1: Regression Application Mobile

**Probabilité:** Élevée
**Impact:** Critique

**Mesures d'atténuation:**
1. **Suite de tests E2E complète** avant toute migration
2. **Feature flag** dans l'application mobile pour basculer rapidement
3. **Beta test prolongé** (4 semaines) avec vrais utilisateurs
4. **Monitoring en temps réel** des erreurs mobiles
5. **Plan de rollback** immédiat si problème détecté

**Indicateurs de surveillance:**
- Taux d'erreur par endpoint
- Temps de réponse API
- Taux d'échec des invitations
- Feedback utilisateurs

#### Risque 2: Performance Dégradée

**Probabilité:** Moyenne
**Impact:** Moyen

**Mesures d'atténuation:**
1. **Benchmark** des nouveaux vs anciens endpoints
2. **Optimisation des requêtes** Prisma si nécessaire
3. **Mise en cache** des validations fréquentes
4. **Load testing** avant déploiement

**Indicateurs de surveillance:**
- Temps de réponse p50, p95, p99
- Utilisation CPU/Mémoire serveur
- Débit requêtes/secondes

#### Risque 3: Breaking Changes Non Détectés

**Probabilité:** Moyenne
**Impact:** Critique

**Mesures d'atténuation:**
1. **Diff OpenAPI** systématique pour détecter les changements
2. **Tests de contrats** entre frontend et backend
3. **Review de code** en binôme pour tous les changements
4. **Tests de régression** automatisés

#### Risque 4: Confusion Endpoints Spécifiques vs Unifiés

**Probabilité:** Faible
**Impact:** Moyen

**Mesures d'atténuation:**
1. **Documentation explicite** sur la décision d'éliminer les endpoints unifiés
2. **Communication claire** à l'équipe frontend sur l'architecture choisie
3. **Exemples de code** montrant l'utilisation correcte des endpoints spécifiques
4. **Review de code** pour s'assurer que les bons endpoints sont utilisés

---

## 7. Stratégie de Tests

### 7.1 Tests Unitaires

**Couverture cible:** > 90%

```typescript
// Exemple de test unitaire pour InvitationController
describe('POST /invitations/group', () => {
  it('should create group invitation by familyId', async () => {
    const response = await app.request('/invitations/group', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        groupId: testGroup.id,
        targetFamilyId: targetFamily.id,
        role: 'MEMBER',
      }),
    });

    expect(response.status).toBe(201);
    expect(response.json()).toMatchObject({
      id: expect.any(String),
      inviteCode: expect.any(String),
      status: 'PENDING',
      type: 'GROUP',
    });
  });

  it('should create group invitation by email', async () => {
    const response = await app.request('/invitations/group', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        groupId: testGroup.id,
        email: 'test@example.com',
        role: 'MEMBER',
      }),
    });

    expect(response.status).toBe(201);
  });
});
```

### 7.2 Tests d'Intégration

```typescript
describe('Invitation Flow Integration', () => {
  it('should complete full group invitation lifecycle', async () => {
    // 1. Create invitation
    const createResponse = await createGroupInvitation(...);
    expect(createResponse.status).toBe(201);

    // 2. Validate invitation with specific endpoint
    const validateResponse = await validateGroupInvitation(createResponse.inviteCode);
    expect(validateResponse.valid).toBe(true);
    expect(validateResponse.type).toBe('GROUP'); // Specific type

    // 3. Accept invitation
    const acceptResponse = await acceptGroupInvitation(createResponse.inviteCode);
    expect(acceptResponse.success).toBe(true);

    // 4. Verify family in group
    const membership = await getGroupMembership(...);
    expect(membership).toBeDefined();
  });
});
```

### 7.3 Tests E2E (Playwright/Cypress)

```typescript
test('mobile group invitation flow', async ({ page }) => {
  // Login as group admin
  await page.goto('/groups/123/manage');
  await page.fill('[data-testid="email-input"]', 'admin@example.com');
  await page.click('[data-testid="login-button"]');

  // Invite a family
  await page.click('[data-testid="invite-family-button"]');
  await page.selectOption('[data-testid="family-select"]', 'family-456');
  await page.click('[data-testid="send-invitation-button"]');

  // Verify success message
  await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();

  // Verify invitation appears in list
  await page.click('[data-testid="pending-invitations-tab"]');
  await expect(page.locator('text=Family Smith')).toBeVisible();
});
```

### 7.4 Tests de Performance

```bash
# Using k6 for load testing
k6 run - <<EOF
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 100,
  duration: '30s',
};

export default function () {
  const response = http.post(
    'https://api.edulift.example.com/invitations/group',
    JSON.stringify({
      groupId: '123',
      targetFamilyId: '456',
      role: 'MEMBER',
    }),
    {
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' },
    }
  );

  check(response, {
    'status is 201': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
EOF
```

---

## 8. Plan de Rollback

### 8.1 Critères de Déclenchement

**Rollback immédiat si:**
- ⛔ Taux d'erreur mobile > 5%
- ⛔ Temps de réponse API > 2x la normale
- ⛔ Rapport de bug critique d'un utilisateur
- ⛔ Perte de données détectée

### 8.2 Procédures de Rollback

#### Option 1: Rollback Backend

```bash
# Revenir à la version précédente
git revert <commit-hash>
git push origin main

# Redémarrer les services
kubectl rollout undo deployment/backend-api
```

#### Option 2: Désactiver Nouveaux Endpoints

```typescript
// Dans InvitationController
const FEATURE_ENABLED = process.env.FEATURE_INVITATIONS_V2 === 'true';

app.openapi(createGroupInvitationRoute, async (c) => {
  if (!FEATURE_ENABLED) {
    return c.json({
      success: false,
      error: 'Feature temporarily disabled',
      code: 'FEATURE_DISABLED',
    }, 503);
  }
  // ... reste du code
});
```

#### Option 3: Rollback Mobile

```typescript
// Feature flag côté serveur
const response = await fetch('/api/config/features');
const features = await response.json();

if (features.useNewInvitationEndpoints) {
  return this.createNewInvitation(data);
} else {
  return this.createOldInvitation(data);
}
```

### 8.3 Communication Rollback

**Template d'email:**

```
Subject: INCIDENT: Migration Endpoints Invitation - Rollback

Bonjour à tous,

Un incident a été détecté lors de la migration des endpoints d'invitation.
Nous procédons à un rollback vers la version précédente.

Impact:
- L'application mobile fonctionne normalement
- Le frontend web fonctionne normalement
- Les nouveaux endpoints sont temporairement désactivés

Prochaines étapes:
- Analyse des logs
- Correction du problème
- Nouvelle tentative de migration

Merci de votre patience.
```

---

## 9. Checklists de Migration

### 9.1 Checklist Phase 1: Préparation

- [ ] Documenter tous les endpoints existants
- [ ] Créer des tests E2E pour les flows mobiles
- [ ] Marquer le code à migrer avec des TODOs
- [ ] Installer et configurer les outils de surveillance
- [ ] Créer le dashboard de monitoring
- [ ] Réunion de kick-off avec toutes les équipes
- [ ] Estimer la charge de travail pour chaque équipe
- [ ] **Documenter la décision:** Pas d'endpoints unifiés - que des endpoints spécifiques

### 9.2 Checklist Phase 2: Nouveaux Endpoints

- [ ] Déployer InvitationController en recette
- [ ] Exécuter tous les tests manuels
- [ ] Valider la documentation OpenAPI
- [ ] Tester tous les nouveaux endpoints spécifiques avec Postman/Insomnia
- [ ] Déployer en production
- [ ] Former l'équipe frontend aux nouveaux endpoints spécifiques
- [ ] Migrer le frontend web vers les endpoints spécifiques
- [ ] Tests complets du frontend web

### 9.3 Checklist Phase 3: Migration Mobile

- [ ] Implémenter le support hybride dans l'application mobile
- [ ] Créer le feature flag
- [ ] Tests techniques internes
- [ ] Beta test avec l'équipe
- [ ] Beta test avec utilisateurs externes
- [ ] Corriger les bugs remontés
- [ ] Valider la stabilité sur 2 semaines
- [ ] Release mobile en prod

### 9.4 Checklist Phase 4: Nettoyage

- [ ] Vérifier taux d'utilisation anciens endpoints < 5%
- [ ] Aucune erreur sur nouveaux endpoints depuis 2 semaines
- [ ] Performance équivalente ou meilleure
- [ ] Ajouter headers de dépréciation HTTP
- [ ] Mettre à jour la documentation (sans mention d'endpoints unifiés)
- [ ] Retirer les anciens endpoints
- [ ] Nettoyer les tests
- [ ] Rétrospective projet

---

## 10. Ressources et Références

### 10.1 Code

**Backend:**
- `backend/src/controllers/InvitationController.ts` - Nouveau contrôleur avec endpoints spécifiques
- `backend/src/controllers/GroupController.ts` - Ancien contrôleur (à nettoyer)
- `backend/src/controllers/FamilyController.ts` - Ancien contrôleur (à nettoyer)
- `backend/src/services/UnifiedInvitationService.ts` - Service unifié
- `backend/src/schemas/invitations.ts` - Schémas Zod pour validation

**Frontend Web:**
- `frontend/src/services/familyApiService.ts` - Service API famille
- `frontend/src/services/groupApiService.ts` - Service API groupe
- `frontend/src/types/api.ts` - Types TypeScript

**Tests:**
- `backend/src/controllers/__tests__/InvitationController.test.ts`
- `frontend/src/services/__tests__/familyApiService.test.ts`
- `frontend/src/services/__tests__/groupApiService.test.ts`

### 10.2 Documentation

- OpenAPI Specification: `backend/docs/openapi/swagger.json`
- Architecture Decision Records: `backend/docs/adr/`
- Guides de développement: `backend/docs/guides/`

### 10.3 Outils

- **Tests Unitaires:** Jest + Testing Library
- **Tests E2E:** Playwright
- **Performance:** k6
- **Feature Flags:** LaunchDarkly / Flagsmith

### 10.4 Monitoring et Observabilité

**Outils de monitoring:**

- **Backend:** Datadog APM avec Custom Metrics pour tracking des endpoints
- **Frontend:** Sentry pour erreurs clients + Google Analytics
- **Infrastructure:** CloudWatch Logs (AWS) pour logs d'application

**Configuration spécifique:**

```typescript
// Exemple: Datadog custom metric pour tracking utilisation endpoint
import { StatsD } from 'node-dogstatsd';

const metrics = new StatsD();

// Dans InvitationController - après chaque appel endpoint
metrics.increment('api.invitation.endpoint_used', 1, [
  `endpoint:${endpointPath}`,
  `version:${apiVersion}`,
  `type:${endpointType}`, // 'family' ou 'group'
  `status:${statusCode}`
]);

// Tracking des temps de réponse
metrics.timing('api.invitation.response_time', duration, [
  `endpoint:${endpointPath}`,
  `version:${apiVersion}`,
  `type:${endpointType}`
]);
```

**Dashboard Datadog à créer:**

1. **Graphique: "Taux d'utilisation des endpoints par type"**
   - Métrique: `api.invitation.endpoint_used`
   - Group by: `endpoint`, `type` (family vs group)
   - Visualisation: Time series avec stacked bars

2. **Alert: "Seuil migration atteint"**
   - Condition: Si taux anciens endpoints < 5% pendant 7 jours consécutifs
   - Action: Envoyer notification Slack
   - Message: "✅ Migration complète - Prêt à supprimer anciens endpoints"

3. **Graphique: "Performance comparée par type"**
   - Métrique: `api.invitation.response_time`
   - Comparer family vs group
   - Visualiser: p50, p95, p99 percentiles

4. **Alert: "Régression performance"**
   - Condition: Si temps de réponse nouveaux endpoints > 2x anciens
   - Action: Alert immédiate équipe backend
   - Severity: Critical

**KPIs à surveiller:**

- Taux d'erreur par endpoint (target: < 0.1%)
- Temps de réponse moyen (target: < 200ms)
- Taux d'adoption nouveaux endpoints (target: > 95% après 4 semaines)
- Nombre d'utilisateurs utilisant l'ancienne version (target: 0 après 8 semaines)
- Distribution d'utilisation par type (family vs group)

---

## 11. Glossaire

| Terme | Définition |
|-------|------------|
| **Endpoint** | Point de terminaison d'une API (URL + Méthode HTTP) |
| **Controller** | Logique de traitement des requêtes HTTP dans Hono |
| **Service** | Couche métier contenant la logique d'affaires |
| **Invitation** | Entité permettant d'inviter un utilisateur/famille à rejoindre un groupe |
| **Endpoint Spécifique** | Endpoint dédié à un type d'invitation (famille OU groupe) |
| **Endpoint Unifié** | Endpoint unique gérant plusieurs types d'invitation (SUPPRIMÉ) |
| **Migration** | Processus de transition d'une ancienne architecture vers une nouvelle |
| **Rollback** | Retour en arrière vers une version précédente du système |
| **E2E** | End-to-End - Test qui couvre un flux utilisateur complet |
| **Feature Flag** | Mécanisme permettant d'activer/désactiver une fonctionnalité sans déploiement |

---

## 12. Approbation et Validation

**Document préparé par:** Équipe Backend EduLift
**Revu par:** Tech Lead, Lead Mobile
**Approuvé par:** CTO
**Date de révision:** À définir

**Historique des révisions:**
| Version | Date | Auteur | Modifications |
|---------|------|--------|--------------|
| 1.0 | 29/12/2025 | Backend Team | Création initiale |
| 2.0 | 29/12/2025 | Backend Team | Révision technique majeure: Correction ambiguïté endpoint recherche, remplacement exemples TypeScript par Dart, ajout impact frontend, extension timeline à 16 semaines, ajout stratégie versioning API, spécification monitoring Datadog, correction mapping endpoints, ajout validation permissions |
| 2.1 | 29/12/2025 | Backend Team | **Suppression des endpoints unifiés** pour éliminer la duplication: Mise à jour de l'architecture vers des endpoints spécifiques par type (family vs group), mise à jour du nombre total d'endpoints de 11 à 9, clarification de la stratégie de migration (pas de consolidation unifiée), suppression des références aux endpoints `GET /invitations/validate/{code}` et `GET /invitations/user`, mise à jour des schémas (FamilyInvitationValidationSchema et GroupInvitationValidationSchema), révision de l'exécutif pour refléter la décision "clarté avant consolidation" |

---

## Annexe A: Code Examples

### A.1: Endpoint de Recherche de Familles - Stratégie de Migration

**⚠️ IMPORTANT:** Cette section a été mise à jour pour refléter la stratégie de migration CORRECTE.

**Problème:** L'endpoint `POST /groups/{groupId}/search-families` EXISTE DÉJÀ dans GroupController et est UTILISÉ par l'application mobile.

**Stratégie de migration (approche RECOMMANDÉE):**

1. Garder le chemin `/groups/{groupId}/search-families` pour compatibilité mobile
2. Migrer la logique de GroupController vers InvitationController
3. Ajouter une permission vérifiant que l'utilisateur est ADMIN du groupe
4. Phase de transition avec les deux controllers actifs

**Solution proposée:**

```typescript
// Dans InvitationController.ts

/**
 * POST /groups/{groupId}/search-families - Search families to invite to group
 *
 * NOTE: Cette endpoint migre la logique depuis GroupController
 * Le chemin reste identique pour compatibilité mobile pendant la transition
 */
const searchFamiliesRoute = createRoute({
  method: 'post',
  path: '/groups/{groupId}/search-families',  // ✅ Chemin identique à l'ancien
  tags: ['Invitations'],
  summary: 'Search families to invite to group',
  description: 'Search for families by name that can be invited to join a group. User must be group admin.',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      groupId: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            searchTerm: z.string().min(2),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(z.object({
              id: z.string(),
              name: z.string(),
              memberCount: z.number(),
            })),
          }),
        },
      },
      description: 'Families found successfully',
    },
    403: {
      description: 'User is not group admin',
    },
  },
});

app.openapi(searchFamiliesRoute, async (c) => {
  const { groupId } = c.req.valid('params');
  const { searchTerm } = c.req.valid('json');
  const userId = c.get('userId');

  try {
    // ⚠️ CRITIQUE: Vérifier les permissions AVANT la recherche
    // Récupérer la famille de l'utilisateur
    const userFamily = await prismaInstance.family.findFirst({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!userFamily) {
      return c.json({
        success: false,
        error: 'User must belong to a family',
        code: 'FORBIDDEN',
      }, 403);
    }

    // Verify user is group admin
    const membership = await prismaInstance.groupMembership.findFirst({
      where: {
        groupId,
        familyId: userFamily.id,
        role: 'ADMIN',
      },
    });

    if (!membership) {
      return c.json({
        success: false,
        error: 'Only group administrators can search for families',
        code: 'FORBIDDEN',
      }, 403);
    }

    // PUIS la recherche des familles
    const families = await prismaInstance.family.findMany({
      where: {
        name: {
          contains: searchTerm,
          mode: 'insensitive',
        },
        // Exclude families already in group
        members: {
          none: {
            groupMemberships: {
              some: {
                groupId,
              },
            },
          },
        },
        // Exclude families with pending invitations
        invitationsReceived: {
          none: {
            groupId,
            status: 'PENDING',
          },
        },
      },
      take: 20,
      select: {
        id: true,
        name: true,
        _count: {
          select: { members: true },
        },
      },
    });

    return c.json({
      success: true,
      data: families.map(f => ({
        id: f.id,
        name: f.name,
        memberCount: f._count.members,
      })),
    }, 200);
  } catch (error) {
    loggerInstance.error('searchFamilies', { error, groupId, searchTerm });
    return c.json({
      success: false,
      error: 'Failed to search families',
      code: 'INTERNAL_ERROR',
    }, 500);
  }
});
```

**Étapes de migration:**

1. **Phase 1 (Semaine 1-4):** Ajouter l'endpoint dans InvitationController
2. **Phase 2 (Semaine 5-8):** Mettre à jour l'app mobile pour utiliser le nouvel endpoint
3. **Phase 3 (Semaine 9-10):** Déprécier l'ancien endpoint dans GroupController
4. **Phase 4 (Semaine 11-12):** Supprimer l'ancien endpoint de GroupController

### A.2: Mapping Complet des Endpoints

**⚠️ IMPORTANT:** Les endpoints unifiés ont été supprimés. Il n'y a PAS de mapping vers des endpoints unifiés.

| Ancien Endpoint | Nouveau Endpoint | Mapping Request | Mapping Response |
|----------------|------------------|----------------|-----------------|
| `POST /families/validate-invite` | `GET /invitations/family/{code}/validate` | `POST {inviteCode}` → `GET /{code}` | Identique + `type: 'FAMILY'` |
| `POST /families/{familyId}/invite` | `POST /invitations/family` | `familyId` dans URL → dans body | Identique |
| `POST /groups/validate-invite` | `GET /invitations/group/{code}/validate` | `POST {inviteCode}` → `GET /{code}` | Identique + `type: 'GROUP'` |
| `POST /groups/{groupId}/invite` | `POST /invitations/group` | `familyId` → `targetFamilyId` + `groupId` dans body | Identique |
| `POST /groups/{groupId}/search-families` | `POST /groups/{groupId}/search-families` (InvitationController) | Identique | Identique + Permission check |
| `DELETE /families/{familyId}/invitations/{id}` | `DELETE /invitations/family/{id}` | `familyId` retiré du path | Identique |
| `DELETE /groups/{groupId}/invitations/{id}` | `DELETE /invitations/group/{id}` | `groupId` retiré du path | Identique |

**Notes importantes:**
- ✅ **Mapping 1:1** pour les endpoints spécifiques (pas de changement sémantique)
- ✅ **Validation typée** avec `type: 'FAMILY'` ou `type: 'GROUP'` explicite dans la réponse
- ✅ **Endpoint de recherche** - Le chemin reste `/groups/{groupId}/search-families` pour compatibilité mobile
- ❌ **PAS d'endpoints unifiés** - La décision a été prise d'éliminer les endpoints unifiés pour éviter la confusion

**Schémas de validation:**

```typescript
// ❌ ANCIEN - Schéma unifié (SUPPRIMÉ)
const InvitationValidationSchema = z.object({
  type: z.enum(['FAMILY', 'GROUP']),  // Client doit tester ce champ
  ...
});

// ✅ NOUVEAU - Schémas spécifiques
const FamilyInvitationValidationSchema = z.object({
  type: z.literal('FAMILY'),  // Explicite
  ...
});

const GroupInvitationValidationSchema = z.object({
  type: z.literal('GROUP'),  // Explicite
  ...
});
```

---

## Annexe B: Décision Architecturale - Pourquoi Pas d'Endpoints Unifiés?

### B.1 Contexte

Lors de la conception de `InvitationController`, une décision a été prise de **supprimer les endpoints unifiés** qui avaient été initialement envisagés.

### B.2 Endpoints Unifiés Envisagés (SUPPRIMÉS)

1. `GET /invitations/validate/{code}` - Validation unifiée (famille OU groupe)
2. `GET /invitations/user` - Toutes invitations utilisateur (famille + groupe)

### B.3 Raisonnement de la Suppression

**Problème:**
- Création de confusion: "Dois-je utiliser l'endpoint unifié ou spécifique?"
- Validation moins sûre: Nécessité de tester le champ `type` côté client
- Documentation plus complexe: Deux façons de faire la même chose

**Avantages des endpoints spécifiques:**
- ✅ **Explicite**: L'endpoint indique clairement le type d'invitation
- ✅ **Sûr**: Le type est déterminé par l'URL, pas par le contenu de la réponse
- ✅ **Documentable**: Un endpoint = une documentation claire
- ✅ **Testable**: Tests plus simples et plus ciblés

### B.4 Comparaison

#### Approche Unifiée (SUPPRIMÉE)

```typescript
// ❌ Un endpoint pour tout - TOT
GET /invitations/validate/{code}
Response: {
  type: 'FAMILY' | 'GROUP',  // Ambigu
  ...
}

// Client doit tester le type
if (response.type === 'FAMILY') {
  // Logique famille
} else if (response.type === 'GROUP') {
  // Logique groupe
}
```

**Inconvénients:**
- ❌ Client doit connaître les deux types
- ❌ Plus facile de faire une erreur (oublier un cas)
- ❌ Validation moins intuitive

#### Approche Spécifique (RETENUE)

```typescript
// ✅ Un endpoint par type - Clair
GET /invitations/family/{code}/validate
Response: {
  type: 'FAMILY',  // Explicite
  ...
}

GET /invitations/group/{code}/validate
Response: {
  type: 'GROUP',  // Explicite
  ...
}

// Client sait déjà quel type il attend
const response = await validateFamilyInvite(code);
// Pas besoin de tester response.type
```

**Avantages:**
- ✅ Client connaît le type avant l'appel
- ✅ Impossible de se tromper de contexte
- ✅ Validation plus intuitive

### B.5 Impact sur la Migration

**Simplification:**
- Moins d'endpoints à documenter (9 au lieu de 11)
- Plus clair pour les développeurs frontend
- Tests plus simples

**Migration:**
- Frontend web: Migrer vers les endpoints spécifiques (pas de décision à prendre)
- Mobile: Migrer vers les endpoints spécifiques (pas de confusion possible)

### B.6 Conclusion

**La décision de supprimer les endpoints unifiés privilégie:**
- 🎯 **Clarté** sur la consolidation
- 🔒 **Sûreté** sur la flexibilité
- 📖 **Simplicité** sur la complétude

Cette décision aligne l'architecture avec les principes de conception logicielle:
- *Un endpoint = une responsabilité*
- *Explicite > Implicite*
- *Clairement défini > Ambigu*

---

**Fin du document**

*Ce document est un document vivant. Veuillez le mettre à jour régulièrement pour refléter l'état actuel de la migration.*
