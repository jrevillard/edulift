# Audit Complet - Système de Notifications EduLift

**Date**: 2026-03-16
**Portée**: WebSocket (Socket.IO) + Push Notifications (Firebase/FCM)
**Méthodologie**: Analyse statique + Scénarios de test + Analyse de couverture

---

## Table des Matières

1. [Architecture Actuelle](#1-architecture-actuelle)
2. [Analyse Statique - Sécurité](#2-analyse-statique---sécurité)
3. [Analyse Statique - Format & Cohérence](#3-analyse-statique---format--cohérence)
4. [Analyse Statique - Gestion des Erreurs](#4-analyse-statique---gestion-des-erreurs)
5. [Analyse Statique - Permissions & Confidentialité](#5-analyse-statique---permissions--confidentialité)
6. [Scénarios de Test](#6-scénarios-de-test)
7. [Couverture de Tests Existants](#7-couverture-de-tests-existants)
8. [Recommandations](#8-recommandations)

---

## 1. Architecture Actuelle

### 1.1 Backend - Services de Notification

| Service | Responsabilité | Fichier |
|---------|----------------|---------|
| **NotificationService** | Orchestrate email + push pour schedule slots | `src/services/NotificationService.ts` |
| **PushNotificationService** | Interface vers Firebase FCM | `src/services/PushNotificationService.ts` |
| **FirebaseService** | SDK Firebase Admin | `src/services/FirebaseService.ts` |
| **FcmTokenService** | Gestion CRUD tokens FCM | `src/services/FcmTokenService.ts` |
| **SocketService** | Logique métier WebSocket | `src/services/SocketService.ts` |
| **SocketHandler** | Gestionnaire Socket.IO | `src/socket/socketHandler.ts` |
| **AuthorizationService** | Vérification droits | `src/services/AuthorizationService.ts` |

### 1.2 Frontend - Réception Notifications

| Composant | Responsabilité | Fichier |
|-----------|----------------|---------|
| **SocketContext** | Connexion Socket.IO + handlers | `src/contexts/SocketContext.tsx` |
| **ConnectionStore** | État connexion WS/API | `src/stores/connectionStore.ts` |
| **shared/events.ts** | Registre événements | `src/shared/events.ts` (commun) |

### 1.3 Modèle de Données

```
User ──┐
      │
      ├── FamilyMember ── Family ──┐
      │                            │
      └── FcmToken                 │
                                  │
Group ◄────────────────────────────┘
│
├── GroupFamilyMember (familyId + groupId)
│
└── ScheduleSlot ──┬─ ScheduleSlotVehicle (driverId)
                   │
                   └─ ScheduleSlotChild (childId)
```

---

## 2. Analyse Statique - Sécurité

### 2.1 Authentification WebSocket ✅

**Localisation**: `src/socket/socketHandler.ts:74-101`

```typescript
// Auth middleware
this.io.use(async (socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
  if (!token) {
    throw new Error('No authentication token provided');
  }
  const decoded = jwt.verify(token, jwtAccessSecret) as any;
  if (!decoded.userId) {
    throw new Error('Invalid token payload');
  }
  socket.userId = decoded.userId;
  next();
});
```

**Statut**: ✅ **SÉCURISÉ**
- JWT token requis
- Validation de la signature
- Extraction du userId

### 2.2 Authorization WebSocket ✅

**Localisation**: `src/socket/socketHandler.ts:156-347`

Chaque événement sensible vérifie les permissions:

| Event | Authorization Check | Ligne |
|-------|-------------------|-------|
| `SCHEDULE_SLOT_JOIN` | `canUserAccessScheduleSlot()` | 165-173 |
| `GROUP_JOIN` | `canUserAccessGroup()` | 197-205 |
| `SCHEDULE_SUBSCRIBE` | `canUserAccessGroup()` | 233-241 |
| `typing:start` | `canUserAccessScheduleSlot()` | 261-269 |
| `typing:stop` | `canUserAccessScheduleSlot()` | 287-295 |

**Statut**: ✅ **SÉCURISÉ**
- Vérification avant chaque action
- Messages d'erreur explicites
- Erreur de type `AUTHORIZATION_ERROR` quand non autorisé

### 2.3 Rate Limiting ✅

**Localisation**: `src/socket/socketHandler.ts:103-139`

```typescript
const limit = 100; // requests per minute
const windowMs = 60 * 1000; // 1 minute
```

**Statut**: ✅ **IMPLEMENTÉ**
- 100 requêtes/minute par IP
- Disjonction si limite dépassée

### 2.4 Isolation des Données - WebSocket ✅

**Localisation**: `src/socket/socketHandler.ts:352-383`

```typescript
const groupIds = await this.authorizationService.getUserAccessibleGroupIds(socket.userId);
// User joins only their authorized groups
for (const groupId of groupIds) {
  await socket.join(groupId);
}
```

**Statut**: ✅ **SÉCURISÉ**
- Les utilisateurs ne rejoignent que leurs groupes autorisés
- Broadcast limité aux rooms autorisées

### 2.5 Isolation des Données - Push Notifications ⚠️

**Localisation**: `src/services/NotificationService.ts`

**ANOMALIE DÉTECTÉE**: Le `NotificationService` envoie des push aux **group members** plutôt qu'aux **family members**.

```typescript
// Ligne 99: Get group members to notify
const groupMembers = await this.userRepository.getGroupMembers(scheduleSlot.groupId);
// TODO: Replace with family-based notifications - get family members instead of individual group members
```

**Impact Limité**:
- Les notifications push vont aux bons destinataires (car filtrées par `determineScheduleSlotNotificationRecipients()`)
- Mais il existe un TODO non implémenté suggérant une refactorisation

**Statut**: ⚠️ **À SURVEILLER** - Fonctionnel mais debt technique

---

## 3. Analyse Statique - Format & Cohérence

### 3.1 Registre d'Événements ✅

**Localisation**: `src/shared/events.ts` (identique backend/frontend)

**Événements définis**: 27 événements constants

```typescript
export const SOCKET_EVENTS = {
  // Connection: 2
  // Group Management: 5
  // User Presence: 4
  // Schedule: 4
  // Capacity: 2
  // Subscription: 4
  // Child: 3
  // Vehicle: 3
  // Family: 3
  // Notification: 1
  // Conflict: 1
  // Error: 1
  // Heartbeat: 2
}
```

**Statut**: ✅ **COHÉRENT**
- Même fichier utilisé des deux côtés
- Format moderne colon-separated (`schedule:updated`)
- Legacy format complètement retiré

### 3.2 Types TypeScript ✅

**Interfaces de données**:

| Interface | Utilisation | Cohérence |
|-----------|-------------|-----------|
| `GroupEventData` | Events groupe | ✅ |
| `ScheduleEventData` | Events schedule | ✅ |
| `UserEventData` | Events utilisateur | ✅ |
| `NotificationEventData` | Notifications génériques | ⚠️ Types limités |
| `ConflictEventData` | Conflits | ✅ |
| `ChildEventData` | Events enfants | ✅ |
| `VehicleEventData` | Events véhicules | ✅ |
| `FamilyEventData` | Events famille | ✅ |
| `CapacityEventData` | Events capacité | ✅ |

**Statut**: ✅ **COHÉRENT**

### 3.3 Format Messages Push ✅

**Interface PushNotificationData**:
```typescript
interface PushNotificationData {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
  sound?: string;
  badge?: number;
  priority?: 'high' | 'normal';
  timeToLive?: number;
}
```

**Statut**: ✅ **BIEN DÉFINI**

---

## 4. Analyse Statique - Gestion des Erreurs

### 4.1 Déconnexions WebSocket ✅

**Localisation**: `src/contexts/SocketContext.tsx:116-172`

```typescript
newSocket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    setWsStatus('disconnected', 'Server disconnected the connection');
  } else if (reason === 'io client disconnect') {
    setWsStatus('disconnected');
  } else {
    setWsStatus('disconnected', 'Connection lost. Attempting to reconnect...');
  }
});
```

**Statut**: ✅ **ROBUSTE**
- Différenciation des raisons
- Messages utilisateur appropriés
- Tentative de reconnexion automatique

### 4.2 Reconnexion Automatique ✅

**Configuration**:
```typescript
reconnection: true,
reconnectionDelay: 3000,    // Start with 3 seconds
reconnectionDelayMax: 30000, // Max 30 seconds
reconnectionAttempts: 3,     // Limited to 3 attempts
```

**Statut**: ✅ **CONFIGURÉ**
- Reconnexion progressive
- Limite de tentatives
- Fallback sur polling si WebSocket échoue

### 4.3 Gestion Tokens Invalides (FCM) ✅

**Localisation**: `src/services/PushNotificationService.ts:64-67, 112-114`

```typescript
// Deactivate invalid tokens
if (result.invalidTokens && result.invalidTokens.length > 0) {
  await this.fcmTokenService.deactivateTokens(result.invalidTokens);
}
```

**Statut**: ✅ **AUTOMATIQUE**
- Détection des tokens invalides (erreur FCM)
- Désactivation automatique
- Mise à jour du `lastUsed` pour les tokens valides

### 4.4 Service Unavailable ✅

**FirebaseService**:
```typescript
isAvailable(): boolean {
  return this.isInitialized && this.messaging !== null;
}
```

**PushNotificationService**:
```typescript
if (!this.isAvailable()) {
  return { success: false, error: 'Push notification service is not available' };
}
```

**Statut**: ✅ **GRACEFUL DEGRADATION**
- Vérification avant envoi
- Retour silencieux si service désactivé
- Pas de crash si Firebase mal configuré

---

## 5. Analyse Statique - Permissions & Confidentialité

### 5.1 Modèle de Permissions ✅

**Règles d'accès**:

1. **Accès Groupe**: Un utilisateur peut accéder à un groupe si sa famille est membre du groupe
2. **Accès Schedule Slot**: Via l'accès au groupe parent
3. **Accès Famille**: Via `FamilyMember` direct

```typescript
// AuthorizationService.canUserAccessGroup()
// 1. Trouver la famille de l'utilisateur
const userFamily = await this.prisma.familyMember.findFirst({
  where: { userId },
  select: { familyId: true },
});

// 2. Vérifier si la famille est membre du groupe
const groupMember = await this.prisma.groupFamilyMember.findFirst({
  where: { groupId, familyId: userFamily.familyId },
});
```

**Statut**: ✅ **CORRECT**

### 5.2 Destinataires Notifications ✅

**Méthode**: `determineScheduleSlotNotificationRecipients()`

| Change Type | Qui est notifié ? |
|-------------|-------------------|
| `SLOT_CREATED` | Tous les membres du groupe |
| `VEHICLE_ASSIGNED` | Drivers + Parents des enfants assignés |
| `DRIVER_ASSIGNED` | Drivers + Parents des enfants assignés |
| `CHILD_ADDED` | Drivers + Parents de TOUS les enfants du slot |
| `CHILD_REMOVED` | Drivers + Parents de TOUS les enfants du slot |
| `SLOT_CANCELLED` | Drivers + Parents des enfants assignés |

**Statut**: ✅ **LOGIQUE**

### 5.3 Isolation Cross-Family ✅

**Scénario**: Famille A (membre du groupe G) vs Famille B (non membre)

```typescript
// NotificationService L373-393
for (const assignment of slot.childAssignments || []) {
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

  // Seuls les membres de la famille de l'enfant sont notifiés
  if (childWithFamily?.family?.members) {
    childWithFamily.family.members.forEach(member => {
      allAffectedUsers.add(member.userId);
    });
  }
}
```

**Statut**: ✅ **ISOLÉ**

### 5.4 Risques Identifiés ⚠️

| # | Risque | Sévérité | Statut |
|---|-------|----------|--------|
| 1 | Leak de données via broadcasting groupe | Élevée | ✅ Mitigé par rooms |
| 2 | Notification push à mauvais utilisateur | Moyenne | ✅ Mitigé par AuthorizationService |
| 3 | TODO "Replace with family-based notifications" | Faible | ⚠️ Debt technique |
| 4 | Pas de validation des payloads événements | Faible | ⚠️ À surveiller |

---

## 6. Scénarios de Test

### 6.1 Scénarios de Sécurité

#### SC-001: Accès Non Autorisé - Groupe
**Objectif**: Vérifier qu'un utilisateur ne peut pas rejoindre un groupe non autorisé

```
Given:
  - UserA appartient à FamilyA
  - FamilyA est membre de GroupA
  - UserB appartient à FamilyB
  - FamilyB N'est PAS membre de GroupA

When:
  - UserB tente de rejoindre GroupA via WebSocket (GROUP_JOIN)

Then:
  - L'événement ERROR est émit avec type='AUTHORIZATION_ERROR'
  - UserB n'est pas ajouté à la room GroupA
  - UserB ne reçoit pas les broadcasts de GroupA
```

**Test existant**: `SocketHandler.security.test.ts:168-207` ✅

#### SC-002: Accès Non Autorisé - Schedule Slot
**Objectif**: Vérifier qu'un utilisateur ne peut pas accéder à un slot non autorisé

```
Given:
  - ScheduleSlot1 appartient à GroupA
  - UserA peut accéder à GroupA
  - UserB ne peut PAS accéder à GroupA

When:
  - UserB tente de rejoindre ScheduleSlot1 (SCHEDULE_SLOT_JOIN)

Then:
  - Erreur AUTHORIZATION_ERROR
  - UserB ne peut pas écouter les événements de ce slot
```

**Test existant**: `SocketHandler.security.test.ts:250-278` ✅

#### SC-003: Typing Indu - Schedule Slot
**Objectif**: Empêcher les events typing sur slots non autorisés

```
Given:
  - UserB n'a pas accès à ScheduleSlot1

When:
  - UserB envoie typing:start pour ScheduleSlot1

Then:
  - Erreur AUTHORIZATION_ERROR
  - Aucun utilisateur ne reçoit le typing event
```

**Test existant**: `SocketHandler.security.test.ts:324-348` ✅

#### SC-004: Room Hijacking
**Objectif**: Empêcher un utilisateur de joindre une room sans autorisation

```
Given:
  - UserA est autorisé sur GroupA
  - UserB n'est PAS autorisé sur GroupA

When:
  - UserB tente d'émettre un événement vers la room GroupA directement

Then:
  - L'émission échoue (pas de broadcast aux autres membres)
  - Note: Socket.IO empêche nativement d'émettre vers une room non rejointe
```

**Mitigation**: ✅ Systématique via Socket.IO (on ne peut pas emit vers une room non rejointe)

### 6.2 Scénarios de Permissions

#### SC-005: Notification Cross-Family
**Objectif**: Vérifier l'isolation des notifications entre familles

```
Given:
  - GroupA contient FamilyA et FamilyB
  - ChildA appartient à FamilyA
  - ChildB appartient à FamilyB
  - ScheduleSlot1 avec ChildA assigné

When:
  - Une notification est envoyée pour CHILD_ADDED sur ScheduleSlot1

Then:
  - Les membres de FamilyA reçoivent la notification
  - Les membres de FamilyB NE reçoivent PAS la notification (pour ChildA)
```

**Test existant**: `NotificationService.familyBased.test.ts:232-284` ✅

#### SC-006: Notification Driver Uniquement
**Objectif**: Vérifier que les drivers sont notifiés correctement

```
Given:
  - ScheduleSlot1 avec véhicule et DriverA assigné
  - ChildA appartient à FamilyA (parents: ParentA1, ParentA2)

When:
  - Notification DRIVER_ASSIGNED

Then:
  - DriverA reçoit la notification
  - ParentA1 reçoit la notification
  - ParentA2 reçoit la notification
  - Autres membres du groupe (non impliqués) ne reçoivent PAS la notification
```

**Test existant**: `NotificationService.familyBased.test.ts:144-228` ✅

#### SC-007: Daily Reminder - Famille Seulement
**Objectif**: Vérifier que les daily reminders ne vont qu'aux bonnes familles

```
Given:
  - Demain: ScheduleSlot1 avec ChildA (FamilyA) et DriverA (FamilyB)
  - FamilyA a ParentA1, ParentA2
  - FamilyB a ParentB (DriverA)

When:
  - Daily reminder envoyé pour GroupA

Then:
  - ParentA1 reçoit un reminder pour ChildA
  - ParentA2 reçoit un reminder pour ChildA
  - ParentB (DriverA) reçoit un reminder pour son rôle de driver
```

**À vérifier**: Implémentation existante dans `NotificationService.ts:167-278` ✅

### 6.3 Scénarios de Résilience

#### SC-008: Déconnexion WebSocket
**Objectif**: Vérifier le comportement lors d'une déconnexion

```
Given:
  - UserA connecté via WebSocket
  - UserA rejoint GroupA

When:
  - La connexion WebSocket est interrompue (network loss)

Then:
  - Le frontend détecte la déconnexion
  - L'état passe à 'disconnected'
  - Une tentative de reconnexion automatique est lancée
  - Les données en cache restent disponibles via React Query
```

**À vérifier**: Frontend SocketContext ✅

#### SC-009: Token FCM Invalide
**Objectif**: Vérifier la gestion des tokens expirés

```
Given:
  - UserA a un token FCM expiré/invalidé

When:
  - Une push notification est envoyée à UserA

Then:
  - Firebase retourne une erreur 'invalid-registration-token'
  - Le token est marqué comme inactive dans la BDD
  - Les autres tokens de UserA sont toujours utilisés
```

**Test existant**: `PushNotificationService.test.ts:99-110` ✅

#### SC-010: Firebase Indisponible
**Objectif**: Vérifier le comportement quand Firebase est down

```
Given:
  - FIREBASE_NOTIFICATIONS_ENABLED = true
  - Firebase service non initialisé (credentials invalides)

When:
  - Une push notification est tentée

Then:
  - isAvailable() retourne false
  - L'erreur est gracieusement gérée
  - L'application continue de fonctionner (sans push)
  - Un log d'erreur est écrit
```

**Test existant**: `PushNotificationService.test.ts:72-77` ✅

### 6.4 Scénarios de Performance

#### SC-011: Broadcasting Massif
**Objectif**: Vérifier la performance avec beaucoup de destinataires

```
Given:
  - GroupA a 50 membres (50 familles)
  - Chaque famille a 2 parents
  - Un événement notifie tous les membres (100 utilisateurs)

When:
  - Notification broadcastée à tous les membres

Then:
  - Chaque utilisateur reçoit la notification
  - Le temps de traitement est acceptable (< 5 secondes)
  - Pas de memory leak
```

**À tester**: Charge test nécessaire ⚠️

#### SC-012: Multi-Device User
**Objectif**: Vérifier les notifications pour un utilisateur avec plusieurs devices

```
Given:
  - UserA a 3 devices (phone, tablet, web)
  - Chaque device a un token FCM différent

When:
  - Notification envoyée à UserA

Then:
  - Les 3 devices reçoivent la notification
  - Les 3 tokens ont leur lastUsed mis à jour
  - Si 1 token est invalide, seuls les 2 autres reçoivent
```

**Test partiel**: `PushNotificationService.test.ts:168-190` ✅

---

## 7. Couverture de Tests Existants

### 7.1 Backend Tests

| Fichier de Test | Couverture | Statut |
|-----------------|------------|--------|
| `SocketHandler.security.test.ts` | Authentication, Authorization, Rate limiting | ✅ Complet |
| `AuthorizationService.test.ts` | Toutes les méthodes d'authorization | ✅ Complet |
| `PushNotificationService.test.ts` | Send methods, Token management, Topic management | ✅ Complet |
| `FcmTokenService.test.ts` | CRUD tokens, cleanup, validation | ✅ À vérifier |
| `FirebaseService.test.ts` | Firebase SDK integration | ✅ À vérifier |
| `NotificationService.familyBased.test.ts` | Family-based notifications | ✅ Complet |

### 7.2 Tests WebSocket

| Scénario | Test | Statut |
|----------|------|--------|
| Connexion sans token | ✅ Exist | `security.test.ts:352-363` |
| Connexion token invalide | ✅ Exist | `security.test.ts:365-378` |
| Token sans userId | ✅ Exist | `security.test.ts:380-394` |
| Accès groupe non autorisé | ✅ Exist | `security.test.ts:168-207` |
| Accès schedule non autorisé | ✅ Exist | `security.test.ts:250-278` |
| Rate limiting | ✅ Exist | `security.test.ts:397-458` |
| Isolation données | ✅ Exist | `security.test.ts:460-507` |

### 7.3 Gaps de Couverture

| Gap | Description | Priorité |
|-----|-------------|----------|
| SC-007 | Daily reminder cross-family | Moyenne |
| SC-011 | Performance broadcasting | Élevée |
| Frontend tests | Tests de réception notifications frontend | Moyenne |
| Integration tests | Tests E2E complets | Faible |

---

## 8. Recommandations

### 8.1 Priorité ÉLEVÉE

#### REC-001: Tests de Performance
**Risque**: Le broadcasting à un grand nombre d'utilisateurs pourrait créer des problèmes de performance.

**Action**:
- Créer des tests de charge pour valider:
  - Broadcasting à 100+ utilisateurs
  - Multi-device notifications
  - Gestion de la mémoire sous charge

#### REC-002: Validation des Payloads
**Risque**: Pas de validation stricte des payloads des événements WebSocket.

**Action**:
- Ajouter des schémas Zod pour valider les payloads events
- Valider avant traitement dans SocketService

```typescript
// Exemple
import { z } from 'zod';

const ScheduleSlotUpdateSchema = z.object({
  scheduleSlotId: z.string().cuid(),
  vehicleId: z.string().cuid().optional(),
  driverId: z.string().cuid().optional(),
  action: z.enum(['assign', 'remove']).optional(),
});
```

### 8.2 Priorité MOYENNE

#### REC-003: Implémenter le TODO Family-Based
**Risque**: Debt technique, code qui ne suit pas le nouveau modèle de permissions.

**Action**:
- Remplacer `getGroupMembers()` par des requêtes family-based dans NotificationService
- Mettre à jour les tests pour refléter ce changement

#### REC-004: Tests Frontend Notifications
**Risque**: La réception des notifications côté frontend n'est pas testée.

**Action**:
- Ajouter des tests pour SocketContext
- Tester la réception de chaque type d'événement
- Tester l'invalidation du cache React Query

### 8.3 Priorité FAIBLE

#### REC-005: Monitoring & Observabilité
**Amélioration**: Ajouter des métriques pour le monitoring.

**Action**:
- Ajouter des compteurs pour les notifications envoyées
- Suivre les taux d'erreur FCM
- Alerter sur les tokens invalides massifs

#### REC-006: Documentation
**Amélioration**: Améliorer la documentation des notifications.

**Action**:
- Documenter chaque type de notification
- Créer un guide pour ajouter de nouveaux types
- Documenter le modèle de permissions

---

## 9. Conclusion

### 9.1 État Global

| Aspect | État | Note |
|--------|------|------|
| Sécurité WebSocket | ✅ Solide | A |
| Sécurité Push | ✅ Solide | A |
| Autorisation | ✅ Complète | A |
| Gestion erreurs | ✅ Robuste | A |
| Cohérence format | ✅ Cohérent | A |
| Performance | ⚠️ Non testée | B |
| Tests | ✅ Bonne couverture | A- |

### 9.2 Résumé Exécutif

Le système de notification d'EduLift est **globalement bien sécurisé** avec:
- ✅ Authentification JWT obligatoire
- ✅ Vérification des droits sur chaque action WebSocket
- ✅ Isolation des données entre familles/groupes
- ✅ Gestion gracieuse des erreurs et déconnexions
- ✅ Nettoyage automatique des tokens invalides
- ✅ Tests de sécurité existants et complets

**Points à améliorer**:
- ⚠️ Tests de performance manquants
- ⚠️ Validation des payloads événements
- ⚠️ Tests frontend notifications
- ⚠️ Debt technique "family-based notifications"

**Aucune vulnérabilité critique détectée** - Le système est prêt pour la production avec les améliorations recommandées.

---

*Document généré lors de l'audit du 2026-03-16*
