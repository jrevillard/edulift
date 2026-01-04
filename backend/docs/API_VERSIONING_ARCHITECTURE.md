# Architecture Multi-Version d'API - Diagrammes

## Vue d'Ensemble

Ce document illustre l'architecture multi-version d'API avec des diagrammes C4 et des exemples de flux.

## Diagramme C4 : Contexte du Système

```
┌─────────────────────────────────────────────────────────────────┐
│                           Clients                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Frontend    │  │  Mobile App  │  │  Third-party │         │
│  │  (React)     │  │  (Flutter)   │  │  Integrations│         │
│  │              │  │              │  │              │         │
│  │ Uses: v1 & v2│  │ Uses: v1     │  │ Uses: v1     │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                 │
│         └──────────────────┼──────────────────┘                 │
│                            │                                    │
└────────────────────────────┼────────────────────────────────────┘
                             │ HTTP/REST
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EduLift API Gateway                          │
│                     (Hono / Node.js)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  /api/v1/* ──────────────────────> Legacy API (Deprecated)      │
│  /api/v2/* ──────────────────────> Current API                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Diagramme C4 : Conteneurs

```
┌───────────────────────────────────────────────────────────────────┐
│                     Backend API Server                           │
│                    (Node.js + Hono)                             │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    HTTP Layer (Controllers)              │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │                                                           │   │
│  │  ┌──────────────┐         ┌──────────────┐              │   │
│  │  │  API v1      │         │  API v2      │              │   │
│  │  │ Controllers  │         │  Controllers │              │   │
│  │  │              │         │              │              │   │
│  │  │ • AuthV1     │         │ • AuthV2     │              │   │
│  │  │ • FamilyV1   │         │ • FamilyV2   │              │   │
│  │  │ • GroupV1    │         │ • GroupV2    │              │   │
│  │  │              │         │              │              │   │
│  │  │ Routes:      │         │ Routes:      │              │   │
│  │  │ /api/v1/*    │         │ /api/v2/*    │              │   │
│  │  └──────┬───────┘         └──────┬───────┘              │   │
│  │         │                         │                       │   │
│  └─────────┼─────────────────────────┼───────────────────────┘   │
│            │                         │                           │
│  ┌─────────┴─────────────────────────┴───────────────────────┐   │
│  │              Business Layer (Services) ← SHARED           │   │
│  │                                                           │   │
│  │  • AuthService      (used by v1 & v2)                    │   │
│  │  • FamilyService    (used by v1 & v2)                    │   │
│  │  • GroupService     (used by v1 & v2)                    │   │
│  │  • VehicleService   (used by v1 & v2)                    │   │
│  │                                                           │   │
│  └───────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐   │
│  │             Data Layer (Repositories) ← SHARED            │   │
│  │                                                           │   │
│  │  • UserRepository                                       │   │
│  │  • FamilyRepository                                     │   │
│  │  • GroupRepository                                      │   │
│  │                                                           │   │
│  └───────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐   │
│  │                    PostgreSQL Database                    │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

## Diagramme de Séquence : Authentification v1 vs v2

### API v1 - Authentification

```
Client           API v1            AuthService      UserRepository
  │                 │                   │                  │
  │ POST /api/v1    │                   │                  │
  │ /auth/verify    │                   │                  │
  ├────────────────>│                   │                  │
  │                 │                   │                  │
  │                 │ verifyMagicLink() │                  │
  │                 ├──────────────────>│                  │
  │                 │                   │                  │
  │                 │  { token,         │                  │
  │                 │    accessToken,   │                  │
  │                 │    refreshToken } │                  │
  │                 │<──────────────────┤                  │
  │                 │                   │                  │
  │  { success:     │                   │                  │
  │    data: {      │                   │                  │
  │      accessToken│                   │                  │
  │    }            │                   │                  │
  │  }              │                   │                  │
  │<────────────────┤                   │                  │
```

### API v2 - Authentification (Enrichie)

```
Client           API v2            AuthService      UserRepository
  │                 │                   │                  │
  │ POST /api/v2    │                   │                  │
  │ /auth/verify    │                   │                  │
  ├────────────────>│                   │                  │
  │                 │                   │                  │
  │                 │ verifyMagicLink() │                  │
  │                 ├──────────────────>│                  │
  │                 │                   │                  │
  │                 │  { token,         │                  │
  │                 │    accessToken,   │                  │
  │                 │    refreshToken,  │                  │
  │                 │    userId }       │                  │
  │                 │<──────────────────┤                  │
  │                 │                   │                  │
  │                 │ findById(userId)  │                  │
  │                 ├─────────────────────────────────────>│
  │                 │                   │                  │
  │                 │  { user object    │                  │
  │                 │    with createdAt}│                  │
  │                 │<─────────────────────────────────────┤
  │                 │                   │                  │
  │  { success:     │                   │                  │
  │    data: {      │                   │                  │
  │      user: {    │                   │                  │
  │        id,      │                   │                  │
  │        email,   │                   │                  │
  │        createdAt│ ← NOUVEAU        │                  │
  │      },         │                   │                  │
  │      accessToken│                   │                  │
  │    }            │                   │                  │
  │  }              │                   │                  │
  │<────────────────┤                   │                  │
```

## Structure de Dossiers Détaillée

```
backend/src/
│
├── controllers/
│   │
│   ├── v1/                              ← API Version 1
│   │   ├── AuthController.ts
│   │   ├── FamilyController.ts
│   │   ├── GroupController.ts
│   │   ├── VehicleController.ts
│   │   ├── ChildController.ts
│   │   ├── DashboardController.ts
│   │   └── __tests__/
│   │       ├── AuthController.test.ts
│   │       ├── FamilyController.test.ts
│   │       └── ...
│   │
│   ├── v2/                              ← API Version 2
│   │   ├── AuthController.ts
│   │   ├── FamilyController.ts
│   │   ├── GroupController.ts
│   │   └── __tests__/
│   │       ├── AuthController.test.ts
│   │       └── ...
│   │
│   └── helpers/                         ← Shared helpers (optional)
│       ├── authHelpers.ts
│       └── familyHelpers.ts
│
├── routes/
│   │
│   ├── v1/                              ← API v1 Routes
│   │   ├── auth.ts
│   │   ├── families.ts
│   │   ├── groups.ts
│   │   ├── vehicles.ts
│   │   ├── children.ts
│   │   ├── dashboard.ts
│   │   ├── invitations.ts
│   │   ├── fcmTokens.ts
│   │   └── scheduleSlots.ts
│   │
│   └── v2/                              ← API v2 Routes
│       ├── auth.ts
│       ├── families.ts
│       └── groups.ts
│
├── schemas/
│   │
│   ├── v1/                              ← API v1 Schemas
│   │   ├── auth.ts
│   │   ├── families.ts
│   │   ├── groups.ts
│   │   └── ...
│   │
│   └── v2/                              ← API v2 Schemas
│       ├── auth.ts
│       ├── families.ts
│       └── groups.ts
│
├── services/                            ← SHARED between v1 & v2
│   ├── AuthService.ts
│   ├── FamilyService.ts
│   ├── GroupService.ts
│   ├── VehicleService.ts
│   ├── ChildService.ts
│   ├── DashboardService.ts
│   ├── UnifiedInvitationService.ts
│   └── __tests__/
│       ├── AuthService.test.ts
│       └── ...
│
├── repositories/                        ← SHARED between v1 & v2
│   ├── UserRepository.ts
│   ├── FamilyRepository.ts
│   ├── SecureTokenRepository.ts
│   ├── VehicleRepository.ts
│   └── __tests__/
│       ├── UserRepository.test.ts
│       └── ...
│
├── middleware/
│   ├── auth.ts                          ← SHARED
│   ├── versionTracking.ts               ← NEW (track v1 vs v2 usage)
│   └── deprecationWarning.ts            ← NEW (warn v1 users)
│
└── server.ts                            ← Mounts v1 & v2 routes
```

## Flux de Requête Complet

```
┌────────────────────────────────────────────────────────────────┐
│                      Client Request                           │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                    Hono Server (server.ts)                    │
│                                                                 │
│  1. Rate limiting middleware (applies to /api/*)              │
│  2. Logger middleware                                          │
│  3. CORS middleware                                            │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │ Version Detection     │
                │                       │
                │ /api/v1/* → v1 stack │
                │ /api/v2/* → v2 stack │
                └───────────────────────┘
                     │             │
        ┌────────────┘             └────────────┐
        │                                         │
        ▼                                         ▼
┌──────────────────────┐              ┌──────────────────────┐
│   API v1 Router      │              │   API v2 Router      │
│   routes/v1/auth.ts  │              │   routes/v2/auth.ts  │
└──────────────────────┘              └──────────────────────┘
        │                                         │
        ▼                                         ▼
┌──────────────────────┐              ┌──────────────────────┐
│  V1 Controller       │              │  V2 Controller       │
│  controllers/v1/     │              │  controllers/v2/     │
│  AuthController.ts   │              │  AuthController.ts   │
│                      │              │                      │
│  • V1 schema         │              │  • V2 schema         │
│  • V1 response       │              │  • V2 response       │
│  • V1 logic          │              │  • V2 logic          │
└──────────────────────┘              └──────────────────────┘
        │                                         │
        └───────────────┬─────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  SHARED Services Layer       │
        │  (used by v1 & v2)           │
        │                               │
        │  • AuthService               │
        │  • FamilyService             │
        │  • GroupService              │
        └───────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  SHARED Repositories Layer   │
        │  (used by v1 & v2)           │
        │                               │
        │  • UserRepository            │
        │  • FamilyRepository          │
        │  • GroupRepository           │
        └───────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │    PostgreSQL Database       │
        └───────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  Response Path (Reverse)     │
        │                               │
        │  DB → Repo → Service         │
        │    → Controller V1/V2        │
        │    → Router V1/V2            │
        │    → Client                  │
        └───────────────────────────────┘
```

## Stratégie de Migration Progressive

```
Phase 1: Coexistence (Months 1-6)
──────────────────────────────────

┌─────────────────────────────────────────┐
│         Client Landscape                │
├─────────────────────────────────────────┤
│                                          │
│  Frontend (React)   ──> /api/v2/*  ✅   │
│  Mobile App         ──> /api/v1/*  ⚠️   │
│  Third-party API    ──> /api/v1/*  ⚠️   │
│                                          │
└─────────────────────────────────────────┘

Status:
  • v1 and v2 fully operational
  • New features only in v2
  • v1 gets security updates only
  • No breaking changes


Phase 2: Deprecation Warnings (Months 3-6)
───────────────────────────────────────────

┌─────────────────────────────────────────┐
│         HTTP Headers on v1              │
├─────────────────────────────────────────┤
│                                          │
│  Deprecation: true                       │
│  Sunset: Fri, 31 Dec 2025               │
│  Link: </api/v2/auth/verify>;           │
│        rel="successor-version"           │
│                                          │
└─────────────────────────────────────────┘

Status:
  • All v1 responses include deprecation headers
  • Client logs show deprecation warnings
  • Migration guide published
  • Support actively helps clients migrate


Phase 3: Hard Sunset (Month 12+)
────────────────────────────────

┌─────────────────────────────────────────┐
│         Client Landscape                │
├─────────────────────────────────────────┤
│                                          │
│  Frontend (React)   ──> /api/v2/*  ✅   │
│  Mobile App         ──> /api/v2/*  ✅   │
│  Third-party API    ──> /api/v2/*  ✅   │
│                                          │
└─────────────────────────────────────────┘

Status:
  • v1 routes removed
  • v1 controllers deleted
  • v1 schemas deleted
  • v1 tests deleted
  • v2 becomes the new "current"
  • Planning for v3 begins (if needed)
```

## Partage de Code : Services

### Services : Aucune Duplication

```typescript
// backend/src/services/AuthService.ts
// CE CODE EST UTILISÉ PAR V1 ET V2

export class AuthService {
  async verifyMagicLink(params: VerifyMagicLinkParams) {
    // Logique métier 100% partagée

    // 1. Valider le token
    // 2. Vérifier PKCE
    // 3. Générer JWT
    // 4. Traiter les invitations

    return {
      accessToken,
      refreshToken,
      isNewUser,
      userId,
    };
  }
}

// Utilisé par:
// - controllers/v1/AuthController.ts
// - controllers/v2/AuthController.ts
```

### Controllers : Logique Spécifique par Version

```typescript
// controllers/v1/AuthController.ts
app.openapi(verifyMagicLinkRouteV1, async (c) => {
  const { token, code_verifier } = c.req.valid('json');

  // Appeler le service partagé
  const result = await authService.verifyMagicLink({
    token,
    code_verifier,
  });

  // Réponse V1 (format simple)
  return c.json({
    success: true,
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      isNewUser: result.isNewUser,
    },
  }, 200);
});

// controllers/v2/AuthController.ts
app.openapi(verifyMagicLinkRouteV2, async (c) => {
  const { token, code_verifier, deviceId } = c.req.valid('json');

  // Appeler le MÊME service partagé
  const result = await authService.verifyMagicLink({
    token,
    code_verifier,
  });

  // Récupérer plus de données pour V2
  const user = await userRepository.findById(result.userId);

  // Réponse V2 (format enrichi)
  return c.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(), // NOUVEAU
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      isNewUser: result.isNewUser,
    },
  }, 200);
});
```

## Tests par Couche

```
Tests Unitaires (Isolés par Version)
─────────────────────────────────────

controllers/v1/__tests__/AuthController.test.ts
  • Teste uniquement V1 response format
  • Mock AuthService
  • Mock UserRepository

controllers/v2/__tests__/AuthController.test.ts
  • Teste uniquement V2 response format
  • Mock AuthService
  • Mock UserRepository


Tests d'Intégration (Services Partagés)
───────────────────────────────────────

services/__tests__/AuthService.test.ts
  • Teste la logique métier
  • Utilisé par V1 ET V2
  • Pas de duplication


Tests E2E (Par Version)
────────────────────────

e2e/tests/api/v1/auth.spec.ts
  • Teste le flux V1 complet
  • Vérifie format V1

e2e/tests/api/v2/auth.spec.ts
  • Teste le flux V2 complet
  • Vérifie format V2
```

## OpenAPI Documentation Structure

```
http://localhost:3000/
│
├─ /docs/v1                    ← Swagger UI for API v1
│  └─ Uses /openapi/v1.json
│
├─ /docs/v2                    ← Swagger UI for API v2 (Default)
│  └─ Uses /openapi/v2.json
│
├─ /docs                       ← Redirects to /docs/v2
│
├─ /openapi/v1.json            ← OpenAPI Spec v1
│  {
│    "openapi": "3.1.0",
│    "info": {
│      "version": "1.0.0",
│      "title": "EduLift API v1 (Legacy)"
│    }
│  }
│
├─ /openapi/v2.json            ← OpenAPI Spec v2
│  {
│    "openapi": "3.1.0",
│    "info": {
│      "version": "2.0.0",
│      "title": "EduLift API v2 (Current)"
│    }
│  }
│
└─ /docs/info                  ← API information
   {
     "versions": ["v1", "v2"],
     "current": "v2",
     "deprecated": ["v1"]
   }
```

## Monitoring et Métriques

```
API Version Tracking
────────────────────

Request Metrics:
  GET /api/v1/auth/*    → 1,234 requests/day
  GET /api/v2/auth/*    → 5,678 requests/day

Client Breakdown:
  Frontend React  → 100% v2
  Mobile App      →  80% v1, 20% v2
  Third-party     → 100% v1

Deprecation Timeline:
  Month 1-3:  Coexistence      (v1: 70%, v2: 30%)
  Month 3-6:  Migration phase  (v1: 40%, v2: 60%)
  Month 6-9:  Deprecation      (v1: 10%, v2: 90%)
  Month 12+:  Sunset          (v1: 0%,  v2: 100%)
```

## Résumé des Principes Clés

1. **Séparation des Contrôleurs** : v1 et v2 sont complètement isolés
2. **Partage des Services** : Logique métier commune à v1 et v2
3. **Routes Préfixées** : `/api/v1/*` vs `/api/v2/*`
4. **Tests Isolés** : Tests séparés pour v1 et v2
5. **Documentation Séparée** : OpenAPI specs pour chaque version
6. **Migration Progressive** : Coexistence → Déprécation → Sunset

---

**Documents Complémentaires** :
- Guide complet : `API_VERSIONING_STRATEGY.md`
- Guide de démarrage : `API_VERSIONING_QUICK_START.md`
