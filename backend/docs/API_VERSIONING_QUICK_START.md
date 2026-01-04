# API Multi-Versioning - Guide de Démarrage Rapide

## Vue d'Ensemble

Ce guide montre comment implémenter v1 et v2 en parallèle dans EduLift avec des exemples concrets basés sur le code actuel.

## Architecture Recommandée

```
backend/src/
├── controllers/
│   ├── v1/                # Contrôleurs API v1 (actuels)
│   │   ├── AuthController.ts
│   │   └── FamilyController.ts
│   └── v2/                # Contrôleurs API v2 (nouveaux)
│       ├── AuthController.ts
│       └── FamilyController.ts
├── routes/
│   ├── v1/                # Routes API v1
│   │   ├── auth.ts
│   │   └── families.ts
│   └── v2/                # Routes API v2
│       ├── auth.ts
│       └── families.ts
├── services/              # SHARED entre v1 et v2
│   ├── AuthService.ts
│   └── FamilyService.ts
└── server.ts             # Monte /api/v1/* et /api/v2/*
```

## Étape 1 : Migrer les contrôleurs existants vers v1

### 1.1 Créer les dossiers v1

```bash
cd /workspace/.worktrees/account-deletion-and-api-standardization/backend

mkdir -p src/controllers/v1
mkdir -p src/routes/v1
mkdir -p src/schemas/v1
```

### 1.2 Déplacer les fichiers existants

```bash
# Controllers
git mv src/controllers/AuthController.ts src/controllers/v1/AuthController.ts
git mv src/controllers/FamilyController.ts src/controllers/v1/FamilyController.ts
git mv src/controllers/GroupController.ts src/controllers/v1/GroupController.ts

# Routes
git mv src/routes/auth.ts src/routes/v1/auth.ts
git mv src/routes/families.ts src/routes/v1/families.ts
git mv src/routes/groups.ts src/routes/v1/groups.ts

# Schemas
git mv src/schemas/auth.ts src/schemas/v1/auth.ts
git mv src/schemas/families.ts src/schemas/v1/families.ts
```

### 1.3 Mettre à jour les imports dans les routes v1

```typescript
// src/routes/v1/auth.ts
import { OpenAPIHono } from '@hono/zod-openapi';
import { createAuthControllerRoutes } from '../../controllers/v1/AuthController';  // CHANGÉ ICI

const app = new OpenAPIHono();
app.route('/', createAuthControllerRoutes());
export default app;
```

## Étape 2 : Créer le contrôleur v2

### 2.1 Créer AuthController v2

```typescript
// src/controllers/v2/AuthController.ts

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../../services/AuthService';
import { UserRepository } from '../../repositories/UserRepository';
import { SecureTokenRepository } from '../../repositories/SecureTokenRepository';
import { EmailServiceFactory } from '../../services/EmailServiceFactory';
import { UnifiedInvitationService } from '../../services/UnifiedInvitationService';
import { createLogger } from '../../utils/logger';

// Schémas V2 (peuvent avoir des champs supplémentaires)
const VerifyMagicLinkSchemaV2 = z.object({
  token: z.string().min(1, "Token is required"),
  code_verifier: z.string().min(43),
  inviteCode: z.string().optional(),
  deviceId: z.string().optional(), // NOUVEAU champ V2
});

const UserResponseSchemaV2 = z.object({
  id: z.string().openapi({ example: 'user_123' }),
  email: z.string().email().openapi({ example: 'user@example.com' }),
  name: z.string().nullable().openapi({ example: 'John Doe' }),
  timezone: z.string().nullable().openapi({ example: 'Europe/Paris' }),
  createdAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }), // NOUVEAU
});

const VerifyMagicLinkResponseSchemaV2 = z.object({
  success: z.literal(true),
  data: z.object({
    user: UserResponseSchemaV2, // NOUVEAU en v2
    accessToken: z.string(),
    refreshToken: z.string(),
    isNewUser: z.boolean(),
  }),
});

const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
});

// Factory function V2
export function createAuthControllerRoutesV2(dependencies: {
  prisma?: PrismaClient;
  authService?: AuthService;
  userRepository?: UserRepository;
  secureTokenRepository?: SecureTokenRepository;
  unifiedInvitationService?: UnifiedInvitationService;
} = {}): OpenAPIHono {

  const prismaInstance = dependencies.prisma ?? new PrismaClient();
  const loggerInstance = createLogger('AuthControllerV2');
  const emailServiceInstance = dependencies.emailService ?? EmailServiceFactory.getInstance();
  const userRepositoryInstance = dependencies.userRepository ?? new UserRepository(prismaInstance);
  const secureTokenRepositoryInstance = dependencies.secureTokenRepository ?? new SecureTokenRepository(prismaInstance);
  const authServiceInstance = dependencies.authService ?? new AuthService(
    userRepositoryInstance,
    secureTokenRepositoryInstance,
    emailServiceInstance,
    prismaInstance
  );
  const unifiedInvitationServiceInstance = dependencies.unifiedInvitationService ?? new UnifiedInvitationService(
    prismaInstance,
    loggerInstance,
    emailServiceInstance
  );

  const app = new OpenAPIHono();

  // Route V2 avec schéma enrichi
  const verifyMagicLinkRouteV2 = createRoute({
    method: 'post',
    path: '/verify',
    tags: ['Authentication V2'],
    summary: 'Verify magic link (V2 - Enhanced)',
    description: 'Verify magic link and return user data with creation date',
    security: [],
    request: {
      body: {
        content: {
          'application/json': {
            schema: VerifyMagicLinkSchemaV2,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: VerifyMagicLinkResponseSchemaV2,
          },
        },
        description: 'Authentication successful (V2 format with user object)',
      },
      400: {
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
        description: 'Bad request',
      },
    },
  });

  app.openapi(verifyMagicLinkRouteV2, async (c) => {
    const { token, code_verifier, inviteCode } = c.req.valid('json');

    try {
      // Utiliser le MÊME service que v1 (SHARED)
      const result = await authServiceInstance.verifyMagicLink({
        token,
        code_verifier,
        inviteCode,
      });

      // Récupérer les données utilisateur pour la réponse V2 enrichie
      const user = await userRepositoryInstance.findById(result.userId);

      return c.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            timezone: user.timezone,
            createdAt: user.createdAt.toISOString(), // NOUVEAU en V2
          },
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          isNewUser: result.isNewUser,
        },
      }, 200);
    } catch (error) {
      loggerInstance.error('Magic link verification failed', error);
      throw error;
    }
  });

  return app;
}

export default createAuthControllerRoutesV2();
```

### 2.2 Créer la route v2

```typescript
// src/routes/v2/auth.ts

import { OpenAPIHono } from '@hono/zod-openapi';
import createAuthControllerRoutesV2 from '../../controllers/v2/AuthController';

const app = new OpenAPIHono();

app.route('/', createAuthControllerRoutesV2());

export default app;
```

## Étape 3 : Monter v1 et v2 dans server.ts

```typescript
// src/server.ts

// Imports v1
import authRoutesV1 from './routes/v1/auth';
import familiesRoutesV1 from './routes/v1/families';
import groupsRoutesV1 from './routes/v1/groups';
import vehiclesRoutesV1 from './routes/v1/vehicles';
import childrenRoutesV1 from './routes/v1/children';
import invitationsRoutesV1 from './routes/v1/invitations';
import fcmTokensRoutesV1 from './routes/v1/fcmTokens';
import dashboardRoutesV1 from './routes/v1/dashboard';
import scheduleSlotsRoutesV1 from './routes/v1/scheduleSlots';

// Imports v2 (commencer avec 1-2 endpoints)
import authRoutesV2 from './routes/v2/auth';
// import familiesRoutesV2 from './routes/v2/families'; // Plus tard

// ... configuration ...

// Rate limiting pour v1
app.use('/api/v1/*', globalRateLimiter);
app.use('/api/v1/auth/*', authEndpointRateLimiter);

// Rate limiting pour v2
app.use('/api/v2/*', globalRateLimiter);
app.use('/api/v2/auth/*', authEndpointRateLimiter);

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    apiVersions: ['v1', 'v2'],
  });
});

// Mount v1 routes (existant)
app.route('/api/v1/auth', authRoutesV1);
app.route('/api/v1/vehicles', vehiclesRoutesV1);
app.route('/api/v1/children', childrenRoutesV1);
app.route('/api/v1/families', familiesRoutesV1);
app.route('/api/v1/groups', groupsRoutesV1);
app.route('/api/v1/invitations', invitationsRoutesV1);
app.route('/api/v1/fcm-tokens', fcmTokensRoutesV1);
app.route('/api/v1/dashboard', dashboardRoutesV1);
app.route('/api/v1', scheduleSlotsRoutesV1);

// Mount v2 routes (nouveaux)
app.route('/api/v2/auth', authRoutesV2);
// app.route('/api/v2/families', familiesRoutesV2); // Plus tard

// OpenAPI v1
const openApiConfigV1 = {
  openapi: '3.1.0',
  info: {
    version: '1.0.0',
    title: 'EduLift API v1 (Legacy)',
    description: 'API version 1 - Stable but deprecated',
  },
  servers: [
    {
      url: env === 'production' ? 'https://api.edulift.com/api/v1' : `http://localhost:${port}/api/v1`,
      description: 'API v1 (Legacy)',
    },
  ],
  tags: [
    { name: 'Authentication V1', description: 'JWT authentication v1' },
    // ... autres tags v1
  ],
  components: {
    securitySchemes: {
      Bearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

// OpenAPI v2
const openApiConfigV2 = {
  openapi: '3.1.0',
  info: {
    version: '2.0.0',
    title: 'EduLift API v2 (Current)',
    description: 'API version 2 - Current recommended version',
  },
  servers: [
    {
      url: env === 'production' ? 'https://api.edulift.com/api/v2' : `http://localhost:${port}/api/v2`,
      description: 'API v2 (Current)',
    },
  ],
  tags: [
    { name: 'Authentication V2', description: 'JWT authentication v2 with enhanced responses' },
    // ... autres tags v2
  ],
  components: {
    securitySchemes: {
      Bearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

// Générer OpenAPI pour les deux versions
const appV1 = new OpenAPIHono();
appV1.doc('/openapi/v1.json', openApiConfigV1);

const appV2 = new OpenAPIHono();
appV2.doc('/openapi/v2.json', openApiConfigV2);

// Swagger UI pour les deux versions
app.get('/docs', swaggerUI({ url: '/openapi/v2.json' })); // Par défaut vers v2
app.get('/docs/v1', swaggerUI({ url: '/openapi/v1.json', title: 'API v1 Docs' }));
app.get('/docs/v2', swaggerUI({ url: '/openapi/v2.json', title: 'API v2 Docs' }));

// 404 handler mis à jour
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Endpoint not found',
    available_versions: [
      {
        version: 'v1',
        status: 'deprecated',
        migration_guide: '/docs/v2',
        endpoints: [
          '/api/v1/auth/*',
          '/api/v1/families/*',
          // ...
        ],
      },
      {
        version: 'v2',
        status: 'current',
        documentation: '/docs/v2',
        endpoints: [
          '/api/v2/auth/*',
          // Plus d'endpointsv2 à venir
        ],
      },
    ],
  }, 404);
});
```

## Étape 4 : Ajouter les tests pour v2

```typescript
// src/controllers/v2/__tests__/AuthController.test.ts

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Hono } from 'hono';
import { createAuthControllerRoutesV2 } from '../AuthController';
import { AuthService } from '../../../services/AuthService';
import { UserRepository } from '../../../repositories/UserRepository';
import { TEST_IDS } from '../../../utils/testHelpers';

jest.mock('../../../services/AuthService');
jest.mock('../../../repositories/UserRepository');

describe('AuthController V2 Test Suite', () => {
  let app: Hono;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthService = {
      verifyMagicLink: jest.fn(),
    } as any;

    mockUserRepository = {
      findById: jest.fn(),
    } as any;

    const deps = {
      authService: mockAuthService,
      userRepository: mockUserRepository,
    };

    app = new Hono();
    app.route('/', createAuthControllerRoutesV2(deps));
  });

  it('should verify magic link and return user with createdAt (V2 format)', async () => {
    const mockUserId = TEST_IDS.USER;

    mockAuthService.verifyMagicLink.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      isNewUser: false,
      userId: mockUserId,
    });

    mockUserRepository.findById.mockResolvedValue({
      id: mockUserId,
      email: 'test@example.com',
      name: 'Test User',
      timezone: 'Europe/Paris',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    const response = await app.request('/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: 'valid-token',
        code_verifier: 'a'.repeat(43),
        deviceId: 'device-123', // NOUVEAU paramètre V2
      }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();

    // Vérifier le format V2 (avec user object)
    expect(data.success).toBe(true);
    expect(data.data.user).toBeDefined();
    expect(data.data.user.id).toBe(mockUserId);
    expect(data.data.user.email).toBe('test@example.com');
    expect(data.data.user.createdAt).toBe('2024-01-01T00:00:00.000Z'); // NOUVEAU en V2
    expect(data.data.accessToken).toBe('access-token');
    expect(data.data.refreshToken).toBe('refresh-token');
    expect(data.data.isNewUser).toBe(false);
  });

  it('should handle verification failure in V2', async () => {
    mockAuthService.verifyMagicLink.mockRejectedValue(
      new Error('Invalid or expired token')
    );

    const response = await app.request('/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: 'invalid-token',
        code_verifier: 'a'.repeat(43),
      }),
    });

    expect(response.status).toBe(500);
  });
});
```

## Étape 5 : Mettre à jour les tests E2E

```typescript
// e2e/tests/api/v2/auth.spec.ts

import { test, expect } from '@playwright/test';

test.describe('API V2 Authentication', () => {
  const API_BASE = 'http://localhost:3000/api/v2';

  test('should verify magic link and return user data (V2 format)', async ({ request }) => {
    // 1. Request magic link
    const magicLinkResponse = await request.post(`${API_BASE}/auth/magic-link`, {
      data: {
        email: 'test@example.com',
        code_challenge: 'challenge',
      },
    });

    expect(magicLinkResponse.ok()).toBeTruthy();

    // 2. Verify magic link (V2 format avec user object)
    const verifyResponse = await request.post(`${API_BASE}/auth/verify`, {
      data: {
        token: 'valid-token',
        code_verifier: 'verifier',
      },
    });

    expect(verifyResponse.ok()).toBeTruthy();

    const data = await verifyResponse.json();

    // Vérifier le format V2
    expect(data.success).toBe(true);
    expect(data.data.user).toBeDefined(); // NOUVEAU en V2
    expect(data.data.user.email).toBeDefined();
    expect(data.data.user.createdAt).toBeDefined(); // NOUVEAU en V2
    expect(data.data.accessToken).toBeDefined();
    expect(data.data.refreshToken).toBeDefined();
  });
});
```

## Étape 6 : Ajouter des headers de dépréciation pour v1 (Optionnel)

```typescript
// src/controllers/v1/AuthController.ts

app.openapi(verifyMagicLinkRoute, async (c) => {
  // ... logique existante ...

  const response = c.json({
    success: true,
    data: result,
  }, 200);

  // Ajouter des headers de déprécation
  response.headers.set('Deprecation', 'true');
  response.headers.set('Sunset', 'Fri, 31 Dec 2025 23:59:59 GMT');
  response.headers.set('Link', '</api/v2/auth/verify>; rel="successor-version"');

  return response;
});
```

## Comparaison v1 vs v2

### API v1 (Format actuel)

```bash
POST /api/v1/auth/verify
{
  "token": "abc",
  "code_verifier": "xyz"
}

Response 200:
{
  "success": true,
  "data": {
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token",
    "isNewUser": false
  }
}
```

### API v2 (Format enrichi)

```bash
POST /api/v2/auth/verify
{
  "token": "abc",
  "code_verifier": "xyz",
  "deviceId": "device-123"  // NOUVEAU
}

Response 200:
{
  "success": true,
  "data": {
    "user": {                    // NOUVEAU
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "timezone": "Europe/Paris",
      "createdAt": "2024-01-01T00:00:00.000Z"  // NOUVEAU
    },
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token",
    "isNewUser": false
  }
}
```

## Checklist de Migration

### Préparation

- [ ] Créer les dossiers v1/ et v2/
- [ ] Déplacer les contrôleurs existants vers v1/
- [ ] Mettre à jour les imports dans les routes v1
- [ ] Créer AuthController v2 (commencer par 1 endpoint)
- [ ] Créer la route v2 pour auth
- [ ] Mettre à jour server.ts pour monter v2

### Tests

- [ ] Créer les tests unitaires pour v2
- [ ] Créer les tests E2E pour v2
- [ ] Exécuter tous les tests (v1 et v2)
- [ ] Vérifier que les tests v1 passent toujours

### Déploiement

- [ ] Déployer en staging
- [ ] Tester v1 et v2 manuellement
- [ ] Vérifier la documentation OpenAPI v2
- [ ] Mettre à jour le frontend pour utiliser v2
- [ ] Déployer en production

### Post-Déploiement

- [ ] Surveiller les métriques v1 vs v2
- [ ] Ajouter des headers de déprécation à v1
- [ ] Communiquer la migration aux clients
- [ ] Planifier le sunset de v1

## Commandes Utiles

```bash
# Lancer les tests v1 uniquement
npm test -- src/controllers/v1/__tests__

# Lancer les tests v2 uniquement
npm test -- src/controllers/v2/__tests__

# Tester l'API v1
curl -X POST http://localhost:3000/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"abc","code_verifier":"xyz"}'

# Tester l'API v2
curl -X POST http://localhost:3000/api/v2/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"abc","code_verifier":"xyz","deviceId":"device-123"}'

# Voir la documentation OpenAPI v1
open http://localhost:3000/docs/v1

# Voir la documentation OpenAPI v2
open http://localhost:3000/docs/v2

# Télécharger les specs OpenAPI
curl http://localhost:3000/openapi/v1.json -o openapi-v1.json
curl http://localhost:3000/openapi/v2.json -o openapi-v2.json
```

## Prochaines Étapes

1. **Implémenter v2 pour d'autres endpoints** :
   - Families
   - Groups
   - Vehicles
   - Children

2. **Ajouter des fonctionnalités V2 spécifiques** :
   - Pagination
   - Filtrage avancé
   - Tri
   - Champs de réponse supplémentaires

3. **Créer un guide de migration v1 → v2** pour les clients

4. **Planifier le sunset de v1** (6-12 mois après le lancement de v2)

## Références

- Documentation complète : `backend/docs/API_VERSIONING_STRATEGY.md`
- Hono OpenAPI : https://hono.dev/docs/plugins/zod-openapi
- OpenAPI Spec : https://swagger.io/specification/
