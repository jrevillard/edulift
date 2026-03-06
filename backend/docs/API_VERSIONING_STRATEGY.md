# Stratégie Multi-Version d'API - EduLift Backend

## Table des Matières

1. [Architecture Actuelle](#architecture-actuelle)
2. [Analyse de Faisabilité](#analyse-de-faisabilité)
3. [Pattern Recommandé](://pattern-recommandé)
4. [Structure de Dossiers Proposée](#structure-de-dossiers-proposée)
5. [Implémentation Pratique](#implémentation-pratique)
6. [Partage de Code entre Versions](#partage-de-code-entre-versions)
7. [Stratégie de Migration](#stratégie-de-migration)
8. [Impact sur les Tests](#impact-sur-les-tests)
9. [Impact sur OpenAPI](#impact-sur-openapi)
10. [Exemples Concrets](#exemples-concrets)

---

## Architecture Actuelle

### Structure Actuelle

```
backend/src/
├── controllers/          # Logique de présentation (couche HTTP)
│   ├── AuthController.ts
│   ├── FamilyController.ts
│   ├── GroupController.ts
│   └── __tests__/
├── routes/              # Configuration de routing Hono
│   ├── auth.ts
│   ├── families.ts
│   └── groups.ts
├── services/            # Logique métier (réutilisation entre v1/v2)
│   ├── AuthService.ts
│   ├── FamilyService.ts
│   └── ...
├── repositories/        # Accès données (réutilisation entre v1/v2)
│   ├── UserRepository.ts
│   └── ...
├── schemas/             # Schémas Zod + OpenAPI
│   ├── auth.ts
│   └── families.ts
└── server.ts           # Point d'entrée + montage des routes
```

### Points Clés de l'Architecture Actuelle

1. **Séparation des préoccupations** : Controllers ↔ Services ↔ Repositories
2. **Factory Pattern** : Les contrôleurs utilisent des factory functions pour l'injection de dépendances
3. **OpenAPI Hono Natif** : Utilisation de `createRoute` + `app.openapi()`
4. **Routes montées avec préfixe** : `app.route('/api/v1/auth', authRoutes)`

### Analyse de Faisabilité

✅ **L'architecture PERMET le multi-versioning** car :

- Les contrôleurs sont déjà découplés de la logique métier (via les Services)
- Les Services peuvent être partagés entre v1 et v2
- Les routes sont déjà préfixées (`/api/v1/*`)
- Les contrôleurs utilisent des factory functions (facile à cloner/v1/v2)

❌ **Problèmes potentiels** :

- Duplication potentielle des schémas Zod
- Complexité accrue des tests
- Maintenance de deux contrôleurs similaires

---

## Pattern Recommandé

### Pattern : Contrôleurs Séparés + Services Partagés

C'est le pattern le plus pragmatique pour EduLift car :

1. **Séparation claire** : v1 et v2 sont complètement isolés
2. **Zéro duplication de logique métier** : Services partagés
3. **Flexibilité totale** : v2 peut changer radicalement les réponses/requests
4. **Facile à maintenir** : On peut déprécier v1 sans toucher v2

### Architecture en Couches

```
┌─────────────────────────────────────────────────┐
│           HTTP Layer (Controllers)              │
│  ┌─────────────┐         ┌─────────────┐       │
│  │ AuthV1      │         │ AuthV2      │       │
│  │ Controller  │         │ Controller  │       │
│  └──────┬──────┘         └──────┬──────┘       │
│         │                       │               │
│         └───────────┬───────────┘               │
│                     │                           │
├─────────────────────┼───────────────────────────┤
│      Business Layer (Services) ← SHARED         │
│                     │                           │
│         ┌───────────┴───────────┐               │
│         │    AuthService        │               │
│         │    FamilyService      │               │
│         └───────────────────────┘               │
├─────────────────────┼───────────────────────────┤
│      Data Layer (Repositories) ← SHARED         │
│                     │                           │
│         ┌───────────┴───────────┐               │
│         │    UserRepository     │               │
│         │    FamilyRepository   │               │
│         └───────────────────────┘               │
└─────────────────────────────────────────────────┘
```

---

## Structure de Dossiers Proposée

### Option 1 : Structure par Version (RECOMMANDÉE)

```
backend/src/
├── controllers/
│   ├── v1/
│   │   ├── AuthController.ts
│   │   ├── FamilyController.ts
│   │   ├── GroupController.ts
│   │   └── __tests__/
│   │       ├── AuthController.test.ts
│   │       └── ...
│   └── v2/
│       ├── AuthController.ts
│       ├── FamilyController.ts
│       ├── GroupController.ts
│       └── __tests__/
│           ├── AuthController.test.ts
│           └── ...
├── routes/
│   ├── v1/
│   │   ├── auth.ts
│   │   ├── families.ts
│   │   └── groups.ts
│   └── v2/
│       ├── auth.ts
│       ├── families.ts
│       └── groups.ts
├── schemas/
│   ├── v1/
│   │   ├── auth.ts
│   │   └── families.ts
│   └── v2/
│       ├── auth.ts
│       └── families.ts
├── services/           # SHARED entre v1 et v2
│   ├── AuthService.ts
│   ├── FamilyService.ts
│   └── ...
└── repositories/       # SHARED entre v1 et v2
    ├── UserRepository.ts
    └── ...
```

**Avantages** :
- ✅ Séparation claire des versions
- ✅ Facile de voir ce qui est v1 vs v2
- ✅ Tests organisés par version
- ✅ Facile de supprimer v1 plus tard

**Inconvénients** :
- ⚠️ Nécessite de restructurer les contrôleurs existants
- ⚠️ Plus de dossiers à naviguer

### Option 2 : Structure par Ressource avec Suffixe

```
backend/src/
├── controllers/
│   ├── AuthController.v1.ts
│   ├── AuthController.v2.ts
│   ├── FamilyController.v1.ts
│   └── FamilyController.v2.ts
├── routes/
│   ├── auth.v1.ts
│   ├── auth.v2.ts
│   └── families.v1.ts
└── schemas/
    ├── auth.v1.ts
    └── auth.v2.ts
```

**Avantages** :
- ✅ Moins de changements structurels
- ✅ facile de comparer v1 vs v2 d'une ressource

**Inconvénients** :
- ⚠️ Plus difficile de naviguer (fichiers mélangés)
- ⚠️ Tests moins organisés

---

## Implémentation Pratique

### Étape 1 : Restructurer les contrôleurs existants en v1

```bash
# Créer les dossiers v1
mkdir -p backend/src/controllers/v1
mkdir -p backend/src/routes/v1
mkdir -p backend/src/schemas/v1

# Déplacer les fichiers existants
git mv backend/src/controllers/AuthController.ts backend/src/controllers/v1/AuthController.ts
git mv backend/src/controllers/FamilyController.ts backend/src/controllers/v1/FamilyController.ts
git mv backend/src/routes/auth.ts backend/src/routes/v1/auth.ts
git mv backend/src/routes/families.ts backend/src/routes/v1/families.ts
git mv backend/src/schemas/auth.ts backend/src/schemas/v1/auth.ts
git mv backend/src/schemas/families.ts backend/src/schemas/v1/families.ts
```

### Étape 2 : Mettre à jour les imports dans server.ts

```typescript
// backend/src/server.ts

// AVANT (structure actuelle)
import authRoutes from './routes/auth';
import familiesRoutes from './routes/families';

// APRÈS (structure v1)
import authRoutesV1 from './routes/v1/auth';
import familiesRoutesV1 from './routes/v1/families';

// Montage des routes v1
app.route('/api/v1/auth', authRoutesV1);
app.route('/api/v1/families', familiesRoutesV1);
```

### Étape 3 : Créer le contrôleur v2

Exemple : Ajouter une nouvelle réponse dans v2

```typescript
// backend/src/controllers/v2/AuthController.ts

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../../services/AuthService'; // SHARED
import { UserRepository } from '../../repositories/UserRepository'; // SHARED
import { createLogger } from '../../utils/logger';

// Schémas V2 (peuvent être différents de v1)
const VerifyMagicLinkSchemaV2 = z.object({
  token: z.string().min(1, "Token is required"),
  code_verifier: z.string().min(43, "PKCE code verifier must be at least 43 characters"),
  inviteCode: z.string().optional(),
  deviceId: z.string().optional(), // NOUVEAU champ V2
});

const UserResponseSchemaV2 = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  timezone: z.string().nullable(),
  createdAt: z.string(), // NOUVEAU champ V2
  familyId: z.string().nullable(), // NOUVEAU champ V2
});

// Factory function pour V2
export function createAuthControllerRoutesV2(dependencies: {
  prisma?: PrismaClient;
  authService?: AuthService;
  userRepository?: UserRepository;
} = {}): OpenAPIHono {

  const prismaInstance = dependencies.prisma ?? new PrismaClient();
  const authServiceInstance = dependencies.authService ?? new AuthService(...);
  const userRepositoryInstance = dependencies.userRepository ?? new UserRepository(prismaInstance);

  const app = new OpenAPIHono();

  // Définir la route V2 avec schéma V2
  const verifyMagicLinkRouteV2 = createRoute({
    method: 'post',
    path: '/verify',
    tags: ['Authentication V2'],
    summary: 'Verify magic link (V2 - Enhanced)',
    description: 'Verify magic link with additional user context',
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
            schema: z.object({
              success: z.literal(true),
              data: z.object({
                user: UserResponseSchemaV2,
                accessToken: z.string(),
                refreshToken: z.string(),
                isNewUser: z.boolean(),
              }),
            }),
          },
        },
        description: 'Authentication successful (V2 format)',
      },
    },
  });

  // Implémentation de la route V2
  app.openapi(verifyMagicLinkRouteV2, async (c) => {
    const { token, code_verifier, inviteCode, deviceId } = c.req.valid('json');

    try {
      // Utiliser le même service que v1 (SHARED)
      const result = await authServiceInstance.verifyMagicLink({
        token,
        code_verifier,
        inviteCode,
      });

      // Réponse enrichie V2
      const user = await userRepositoryInstance.findById(result.userId);

      return c.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            timezone: user.timezone,
            createdAt: user.createdAt.toISOString(), // NOUVEAU
            familyId: user.familyId, // NOUVEAU
          },
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          isNewUser: result.isNewUser,
        },
      }, 200);
    } catch (error) {
      const logger = createLogger('AuthControllerV2');
      logger.error('Magic link verification failed', error);
      throw error;
    }
  });

  return app;
}

// Export par défaut pour compatibilité
export default createAuthControllerRoutesV2();
```

### Étape 4 : Créer la route v2

```typescript
// backend/src/routes/v2/auth.ts

import { OpenAPIHono } from '@hono/zod-openapi';
import createAuthControllerRoutesV2 from '../../controllers/v2/AuthController';

const app = new OpenAPIHono();

// Mount auth controller v2
app.route('/', createAuthControllerRoutesV2());

export default app;
```

### Étape 5 : Monter v2 dans server.ts

```typescript
// backend/src/server.ts

// Imports v1 (existants)
import authRoutesV1 from './routes/v1/auth';
import familiesRoutesV1 from './routes/v1/families';

// Imports v2 (nouveaux)
import authRoutesV2 from './routes/v2/auth';
import familiesRoutesV2 from './routes/v2/families';

// Montage des routes v1
app.route('/api/v1/auth', authRoutesV1);
app.route('/api/v1/families', familiesRoutesV1);

// Montage des routes v2
app.route('/api/v2/auth', authRoutesV2);
app.route('/api/v2/families', familiesRoutesV2);
```

---

## Partage de Code entre Versions

### Services : Partage Total

Les services **NE CHANGENT PAS** entre v1 et v2 :

```typescript
// backend/src/services/AuthService.ts
// CE CODE EST UTILISÉ PAR v1 ET v2

export class AuthService {
  async verifyMagicLink(params: VerifyMagicLinkParams) {
    // Logique métier commune
    // v1 et v2 utilisent exactement la même logique
  }
}
```

### Contrôleurs : Logique Spécifique par Version

Les contrôleurs peuvent avoir une logique différente :

```typescript
// v1/AuthController.ts
const verifyMagicLinkRouteV1 = createRoute({
  responses: {
    200: {
      schema: z.object({
        success: z.literal(true),
        data: z.object({
          accessToken: z.string(),
          refreshToken: z.string(),
          isNewUser: z.boolean(),
          // PAS de user object en v1
        }),
      }),
    },
  },
});

app.openapi(verifyMagicLinkRouteV1, async (c) => {
  // Appeler le service partagé
  const result = await authService.verifyMagicLink(...);

  // Réponse v1 (sans user object)
  return c.json({
    success: true,
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      isNewUser: result.isNewUser,
    },
  }, 200);
});

// v2/AuthController.ts
const verifyMagicLinkRouteV2 = createRoute({
  responses: {
    200: {
      schema: z.object({
        success: z.literal(true),
        data: z.object({
          user: UserResponseSchemaV2, // NOUVEAU en v2
          accessToken: z.string(),
          refreshToken: z.string(),
          isNewUser: z.boolean(),
        }),
      }),
    },
  },
});

app.openapi(verifyMagicLinkRouteV2, async (c) => {
  // Appeler le même service partagé
  const result = await authService.verifyMagicLink(...);

  // Réponse v2 (avec user object enrichi)
  const user = await userRepository.findById(result.userId);
  return c.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(), // Enrichi en v2
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      isNewUser: result.isNewUser,
    },
  }, 200);
});
```

### Helpers de Transformation (Si Duplication Inévitable)

Si v1 et v2 ont des logiques très similaires, créez des helpers :

```typescript
// backend/src/controllers/helpers/authHelpers.ts

export async function verifyMagicLinkCommon(
  authService: AuthService,
  userRepository: UserRepository,
  params: VerifyMagicLinkParams
): Promise<{ result: VerifyResult; user?: User }> {
  const result = await authService.verifyMagicLink(params);

  // Logique commune
  const user = result.userId ? await userRepository.findById(result.userId) : undefined;

  return { result, user };
}

// v1/AuthController.ts
import { verifyMagicLinkCommon } from '../helpers/authHelpers';

app.openapi(verifyMagicLinkRouteV1, async (c) => {
  const { result } = await verifyMagicLinkCommon(authService, userRepository, params);
  return c.json({ success: true, data: result }, 200);
});

// v2/AuthController.ts
import { verifyMagicLinkCommon } from '../helpers/authHelpers';

app.openapi(verifyMagicLinkRouteV2, async (c) => {
  const { result, user } = await verifyMagicLinkCommon(authService, userRepository, params);
  return c.json({
    success: true,
    data: { user: transformUserV2(user), ...result }
  }, 200);
});
```

---

## Stratégie de Migration

### Approche : Sunset Progressif de v1

#### Phase 1 : Coexistence (6-12 mois)

```
┌─────────────────────────────────────────────────┐
│              Clients Frontend                   │
├─────────────────────────────────────────────────┤
│  Frontend v1.0 → /api/v1/*      │
│  Frontend v2.0 → /api/v2/*      │
│  Mobile App    → /api/v1/*      │
└─────────────────────────────────────────────────┘
```

- v1 et v2 actifs en parallèle
- Pas de breaking changes pour les clients existants
- Nouveaux clients utilisent v2

#### Phase 2 : Deprecation Warning (3-6 mois)

Ajouter des headers de déprécation aux réponses v1 :

```typescript
// backend/src/controllers/v1/AuthController.ts

app.openapi(verifyMagicLinkRouteV1, async (c) => {
  const result = await authService.verifyMagicLink(...);

  return c.json({
    success: true,
    data: result,
  }, 200, {
    headers: {
      'Deprecation': 'true',
      'Sunset': new Date('2025-12-31').toUTCString(),
      'Link': '</api/v2/auth/verify>; rel="successor-version"',
    },
  });
});
```

#### Phase 3 : Arrêt de v1

```
┌─────────────────────────────────────────────────┐
│              Clients Frontend                   │
├─────────────────────────────────────────────────┤
│  Frontend v2.0 → /api/v2/*      │
│  Mobile App    → /api/v2/*      │
│  Frontend v1.0 → MIGRATION REQUISE              │
└─────────────────────────────────────────────────┘
```

- Supprimer les routes v1
- Supprimer les contrôleurs v1
- Supprimer les schémas v1

### Monitoring et Métriques

```typescript
// backend/src/middleware/versionTracking.ts

import { createLogger } from '../utils/logger';

const logger = createLogger('APIVersionTracking');

export const versionTrackingMiddleware = async (c: any, next: any) => {
  const path = c.req.path;
  const version = path.match(/\/api\/v(\d+)\//)?.[1];

  if (version) {
    // Logger les appels par version
    logger.info(`API v${version} called`, {
      endpoint: path,
      method: c.req.method,
      version,
    });

    // Stocker dans le contexte pour les métriques
    c.set('apiVersion', version);
  }

  await next();
};

// backend/src/server.ts

import { versionTrackingMiddleware } from './middleware/versionTracking';

app.use('/api/*', versionTrackingMiddleware);
```

---

## Impact sur les Tests

### Tests Unitaires : Isolation par Version

```typescript
// backend/src/controllers/v1/__tests__/AuthController.test.ts

describe('AuthController V1 Test Suite', () => {
  let app: Hono;
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    mockAuthService = { ... };
    const deps = { authService: mockAuthService };

    app = new Hono();
    app.route('/', createAuthControllerRoutesV1(deps));
  });

  it('should verify magic link (V1 response format)', async () => {
    mockAuthService.verifyMagicLink.mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      isNewUser: false,
    });

    const response = await app.request('/verify', {
      method: 'POST',
      body: JSON.stringify({ token: 'abc', code_verifier: 'xyz' }),
    });

    const data = await response.json();

    // Vérifier le format V1 (pas de user object)
    expect(data.success).toBe(true);
    expect(data.data.accessToken).toBe('token');
    expect(data.data.user).toBeUndefined(); // V1 n'a pas user
  });
});
```

```typescript
// backend/src/controllers/v2/__tests__/AuthController.test.ts

describe('AuthController V2 Test Suite', () => {
  let app: Hono;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockAuthService = { ... };
    mockUserRepository = { ... };

    const deps = {
      authService: mockAuthService,
      userRepository: mockUserRepository,
    };

    app = new Hono();
    app.route('/', createAuthControllerRoutesV2(deps));
  });

  it('should verify magic link (V2 response format)', async () => {
    mockAuthService.verifyMagicLink.mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      isNewUser: false,
      userId: 'user_123',
    });

    mockUserRepository.findById.mockResolvedValue({
      id: 'user_123',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date('2024-01-01'),
    });

    const response = await app.request('/verify', {
      method: 'POST',
      body: JSON.stringify({
        token: 'abc',
        code_verifier: 'xyz',
        deviceId: 'device_123', // NOUVEAU paramètre V2
      }),
    });

    const data = await response.json();

    // Vérifier le format V2 (avec user object enrichi)
    expect(data.success).toBe(true);
    expect(data.data.user).toBeDefined();
    expect(data.data.user.id).toBe('user_123');
    expect(data.data.user.createdAt).toBe('2024-01-01T00:00:00.000Z'); // NOUVEAU
  });
});
```

### Tests d'Intégration : Services Partagés

Les tests de services **ne changent pas** car ils sont partagés :

```typescript
// backend/src/services/__tests__/AuthService.test.ts

describe('AuthService', () => {
  it('should verify magic link', async () => {
    // Ce test est utilisé par v1 ET v2
    // Pas besoin de dupliquer
  });
});
```

### Tests E2E : Scénarios par Version

```typescript
// e2e/tests/api/v1/auth.spec.ts

describe('E2E API v1', () => {
  it('should authenticate with V1 format', async () => {
    const response = await fetch('http://localhost:3000/api/v1/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token, code_verifier }),
    });

    const data = await response.json();

    expect(data.data.user).toBeUndefined(); // V1
  });
});

// e2e/tests/api/v2/auth.spec.ts

describe('E2E API v2', () => {
  it('should authenticate with V2 format', async () => {
    const response = await fetch('http://localhost:3000/api/v2/auth/verify', {
      method: 'POST',
      body: JSON.stringify({
        token,
        code_verifier,
        deviceId: 'device_123', // V2
      }),
    });

    const data = await response.json();

    expect(data.data.user).toBeDefined(); // V2
    expect(data.data.user.createdAt).toBeDefined(); // V2
  });
});
```

---

## Impact sur OpenAPI

### Documentation Séparée par Version

```typescript
// backend/src/server.ts

// OpenAPI config pour V1
const openApiConfigV1 = {
  openapi: '3.1.0',
  info: {
    version: '1.0.0',
    title: 'EduLift API v1',
    description: 'Legacy API (deprecated - migrate to v2)',
  },
  servers: [
    {
      url: 'http://localhost:3000/api/v1',
      description: 'API v1 (Legacy)',
    },
  ],
};

// OpenAPI config pour V2
const openApiConfigV2 = {
  openapi: '3.1.0',
  info: {
    version: '2.0.0',
    title: 'EduLift API v2',
    description: 'Current API version',
  },
  servers: [
    {
      url: 'http://localhost:3000/api/v2',
      description: 'API v2 (Current)',
    },
  ],
};

// Générer deux documentations séparées
const appV1 = new OpenAPIHono();
appV1.route('/api/v1/auth', authRoutesV1);
appV1.doc('/openapi/v1.json', openApiConfigV1);

const appV2 = new OpenAPIHono();
appV2.route('/api/v2/auth', authRoutesV2);
appV2.doc('/openapi/v2.json', openApiConfigV2);

// Swagger UI séparé
app.get('/docs/v1', swaggerUI({ url: '/openapi/v1.json' }));
app.get('/docs/v2', swaggerUI({ url: '/openapi/v2.json' }));
```

### Tags par Version

```typescript
// backend/src/controllers/v1/AuthController.ts

const requestMagicLinkRoute = createRoute({
  tags: ['Authentication V1', 'Legacy'],
  summary: 'Request magic link (V1 - Legacy)',
  // ...
});

// backend/src/controllers/v2/AuthController.ts

const requestMagicLinkRoute = createRoute({
  tags: ['Authentication V2', 'Current'],
  summary: 'Request magic link (V2 - Enhanced)',
  // ...
});
```

---

## Exemples Concrets

### Exemple 1 : Ajout d'un champ dans la réponse V2

**Scénario** : V1 retourne seulement l'email, V2 retourne email + createdAt

```typescript
// v1/AuthController.ts
const getUserProfileRouteV1 = createRoute({
  responses: {
    200: {
      schema: z.object({
        success: z.literal(true),
        data: z.object({
          email: z.string(),
          name: z.string().nullable(),
        }),
      }),
    },
  },
});

app.openapi(getUserProfileRouteV1, async (c) => {
  const userId = c.get('userId');
  const user = await userRepository.findById(userId);

  return c.json({
    success: true,
    data: {
      email: user.email,
      name: user.name,
    },
  }, 200);
});

// v2/AuthController.ts
const getUserProfileRouteV2 = createRoute({
  responses: {
    200: {
      schema: z.object({
        success: z.literal(true),
        data: z.object({
          email: z.string(),
          name: z.string().nullable(),
          createdAt: z.string(), // NOUVEAU
        }),
      }),
    },
  },
});

app.openapi(getUserProfileRouteV2, async (c) => {
  const userId = c.get('userId');
  const user = await userRepository.findById(userId);

  return c.json({
    success: true,
    data: {
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(), // NOUVEAU
    },
  }, 200);
});
```

### Exemple 2 : Changement de structure de réponse

**Scénario** : V1 utilise `{ success, data }`, V2 utilise directement `{ id, email }`

```typescript
// v1/FamilyController.ts
const createFamilyRouteV1 = createRoute({
  responses: {
    200: {
      schema: z.object({
        success: z.literal(true),
        data: z.object({
          id: z.string(),
          name: z.string(),
        }),
      }),
    },
  },
});

// v2/FamilyController.ts
const createFamilyRouteV2 = createRoute({
  responses: {
    200: {
      schema: z.object({
        id: z.string(),
        name: z.string(),
        // PLUS de wrapper { success, data }
      }),
    },
  },
});
```

### Exemple 3 : Paramètres de requête différents

**Scénario** : V1 utilise `familyId`, V2 utilise `familySlug`

```typescript
// v1/GroupController.ts
const createGroupRouteV1 = createRoute({
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string(),
            familyId: z.string(), // V1 utilise ID
          }),
        },
      },
    },
  },
});

app.openapi(createGroupRouteV1, async (c) => {
  const { name, familyId } = c.req.valid('json');

  const group = await groupService.createGroup({
    name,
    familyId,
  });

  return c.json({ success: true, data: group }, 200);
});

// v2/GroupController.ts
const createGroupRouteV2 = createRoute({
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string(),
            familySlug: z.string(), // V2 utilise slug
          }),
        },
      },
    },
  },
});

app.openapi(createGroupRouteV2, async (c) => {
  const { name, familySlug } = c.req.valid('json');

  // Convertir slug en ID (logique V2)
  const family = await familyRepository.findBySlug(familySlug);

  const group = await groupService.createGroup({
    name,
    familyId: family.id, // Utiliser l'ID en interne
  });

  return c.json({ success: true, data: group }, 200);
});
```

### Exemple 4 : Endpoint supprimé dans V2

**Scénario** : V1 a `/legacy-endpoint`, V2 ne l'a plus

```typescript
// v1/LegacyController.ts
const legacyRoute = createRoute({
  path: '/legacy-endpoint',
  method: 'get',
  tags: ['Legacy V1'],
  summary: 'Legacy endpoint (removed in V2)',
});

app.openapi(legacyRoute, async (c) => {
  return c.json({
    success: true,
    message: 'This endpoint is removed in V2',
    migration: 'Use /new-endpoint instead',
  }, 200);
});

// v2/LegacyController.ts
// PAS de route legacy - endpoint supprimé
```

---

## Checklist de Migration

### Phase de Préparation

- [ ] Décider de la structure de dossiers (v1/v2 ou suffixe)
- [ ] Identifier les endpoints qui vont changer entre v1 et v2
- [ ] Identifier les endpoints qui vont être supprimés dans v2
- [ ] Identifier les nouveaux endpoints à ajouter dans v2
- [ ] Créer les dossiers `v1/` et `v2/`
- [ ] Déplacer les contrôleurs existants dans `v1/`

### Phase d'Implémentation

- [ ] Mettre à jour les imports dans `server.ts` pour v1
- [ ] Créer les contrôleurs v2 (commencer par 1-2 endpoints)
- [ ] Créer les routes v2
- [ ] Mettre à jour `server.ts` pour monter v2
- [ ] Ajouter les tests pour v2
- [ ] Mettre à jour la documentation OpenAPI pour v2

### Phase de Déploiement

- [ ] Déployer v1 et v2 en parallèle
- [ ] Mettre à jour le frontend pour utiliser v2
- [ ] Ajouter les headers de déprécation aux réponses v1
- [ ] Communiquer la déprécation de v1 aux clients
- [ ] Surveiller les métriques d'utilisation de v1 vs v2

### Phase de Sunset

- [ ] Quand v1 a moins de X% de trafic, planifier la suppression
- [ ] Prévenir les clients restants de la date de suppression
- [ ] Supprimer les routes v1
- [ ] Supprimer les contrôleurs v1
- [ ] Supprimer les schémas v1
- [ ] Supprimer les tests v1
- [ ] Mettre à jour la documentation pour indiquer que v1 est supprimé

---

## Conclusion

### Résumé du Pattern

1. **Contrôleurs séparés** : `v1/AuthController.ts` vs `v2/AuthController.ts`
2. **Services partagés** : `services/AuthService.ts` (utilisé par v1 et v2)
3. **Schémas séparés** : `schemas/v1/auth.ts` vs `schemas/v2/auth.ts`
4. **Routes séparées** : `routes/v1/auth.ts` vs `routes/v2/auth.ts`
5. **Montage dans server.ts** : `app.route('/api/v1/auth', ...)` vs `app.route('/api/v2/auth', ...)`

### Avantages

- ✅ Isolation complète des versions
- ✅ Zéro duplication de logique métier (Services)
- ✅ Flexibilité totale (v2 peut changer radicalement)
- ✅ Migration progressive sans breaking changes
- ✅ Facile de déprécier v1

### Inconvénients

- ⚠️ Plus de fichiers à maintenir
- ⚠️ Nécessite une bonne discipline pour ne pas dupliquer la logique
- ⚠️ Tests à maintenir pour les deux versions

### Recommandations

1. **Commencer petit** : Implémenter v2 pour 1-2 endpoints seulement
2. **Documenter les différences** : Gardez un document qui liste v1 vs v2
3. **Surveiller l'utilisation** : Tracker quelles versions sont utilisées
4. **Communiquer** : Prévenir les clients des changements
5. **Planifier le sunset** : Ne gardez pas v1 indéfiniment

### Exemple de Commande pour Démarrer

```bash
# 1. Créer la structure v1
mkdir -p backend/src/controllers/v1
mkdir -p backend/src/routes/v1
mkdir -p backend/src/schemas/v1

# 2. Déplacer les fichiers existants
git mv backend/src/controllers/AuthController.ts backend/src/controllers/v1/
git mv backend/src/routes/auth.ts backend/src/routes/v1/
git mv backend/src/schemas/auth.ts backend/src/schemas/v1/

# 3. Créer la structure v2
mkdir -p backend/src/controllers/v2
mkdir -p backend/src/routes/v2
mkdir -p backend/src/schemas/v2

# 4. Copier un contrôleur v1 pour créer v2
cp backend/src/controllers/v1/AuthController.ts backend/src/controllers/v2/AuthController.ts

# 5. Modifier v2 pour changer la réponse
# 6. Mettre à jour server.ts
# 7. Tester les deux versions
```

---

**Ressources** :

- [Hono Documentation](https://hono.dev/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [API Versioning Best Practices](https://github.com/Microsoft/api-guidelines/blob/master/Guidelines.md#12-versioning)
