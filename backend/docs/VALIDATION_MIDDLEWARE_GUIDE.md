# Guide du Middleware de Validation Amélioré

## 📋 Vue d'ensemble

Le middleware de validation amélioré a été conçu pour éliminer la duplication de code Zod dans les contrôleurs tout en ajoutant un logging contextuel riche et une gestion d'erreurs centralisée.

## 🎯 Objectifs Résolus

- ✅ **Élimination de 26 blocs dupliqués** de code Zod
- ✅ **Logging contextuel automatique** pour toutes les validations
- ✅ **Gestion d'erreurs centralisée** avec format standardisé
- ✅ **Backward compatibility** - aucun code existant cassé
- ✅ **Performance optimisée** - impact minimal sur les temps de réponse

## 🚀 Fonctionnalités

### 1. Validation Enrichie

```typescript
import { validateBody, validateParams, validateQuery, validateRequest } from '../middleware/validation';
import { z } from 'zod';

// Schémas de validation
const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0).optional(),
});

const UserParamsSchema = z.object({
  id: z.string().uuid(),
});

// Middleware de validation basique
router.post('/users', validateBody(CreateUserSchema), createUserController);

// Middleware avec options avancées
router.post('/users',
  validateBody(CreateUserSchema, {
    operationName: 'CreateUser',
    errorMessage: 'Invalid user data provided',
    includeBusinessContext: true,
  }),
  createUserController
);
```

### 2. Validation Combinée

```typescript
// Valider body, params, et query en une seule fois
router.put('/users/:id',
  validateRequest({
    body: UpdateUserSchema,
    params: UserParamsSchema,
    query: IncludeQuerySchema,
  }, {
    operationName: 'UpdateUser',
    includeBusinessContext: true,
  }),
  updateUserController
);
```

### 3. Logging Contextuel Automatique

Le middleware génère automatiquement des logs structurés :

```json
{
  "level": "debug",
  "message": "CreateUser: Validation successful",
  "operation": "CreateUser",
  "endpoint": "POST /users",
  "method": "POST",
  "userId": "user-123",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "dataType": "body",
  "isValid": true,
  "businessContext": {
    "userAgent": "Mozilla/5.0...",
    "ip": "192.168.1.100",
    "contentType": "application/json"
  }
}
```

### 4. Wrapper pour Contrôleurs

Pour les contrôleurs avec validation manuelle existante :

```typescript
import { withZodErrorHandling } from '../middleware/validation';

// Ancien pattern (avec duplication)
export const createChild = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, age } = CreateChildSchema.parse(req.body);
    // ... logique métier
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid input data',
        validationErrors: error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      };
      res.status(400).json(response);
      return;
    }
    throw error;
  }
};

// Nouveau pattern (sans duplication)
export const createChild = withZodErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { name, age } = CreateChildSchema.parse(req.body);
  // ... logique métier
}, {
  operationName: 'CreateChild',
});
```

## 📖 API Reference

### validateBody(schema, options?)

Valide le corps de la requête (`req.body`).

**Paramètres :**
- `schema: z.ZodSchema` - Schéma Zod pour la validation
- `options?: ValidationOptions` - Options de configuration

**Exemple :**
```typescript
validateBody(CreateUserSchema, {
  errorMessage: 'Invalid user data',
  statusCode: 422,
  operationName: 'CreateUser',
  includeBusinessContext: true,
})
```

### validateParams(schema, options?)

Valide les paramètres d'URL (`req.params`).

### validateQuery(schema, options?)

Valide les paramètres de requête (`req.query`).

### validateRequest(schemas, options?)

Valide multiples types en une seule fois.

**Paramètres :**
- `schemas: { body?, params?, query? }` - Schémas par type
- `options?: ValidationOptions` - Options partagées

### withZodErrorHandling(handler, options?)

Wrapper pour contrôleurs avec gestion automatique des erreurs Zod.

**Paramètres :**
- `handler: (req, res) => Promise<void>` - Fonction du contrôleur
- `options?: { operationName?, logger?, includeBusinessContext? }` - Options de logging

## 🔧 Options de Configuration

### ValidationOptions

```typescript
interface ValidationOptions {
  /** Message d'erreur personnalisé */
  errorMessage?: string;

  /** Code HTTP personnalisé (défaut: 400) */
  statusCode?: number;

  /** Logger contextuel personnalisé */
  logger?: any;

  /** Nom de l'opération pour le logging */
  operationName?: string;

  /** Ajouter le contexte métier aux logs */
  includeBusinessContext?: boolean;
}
```

## 🏗️ Migration Guide

### Étape 1: Remplacer les blocs try/catch existants

**Avant :**
```typescript
try {
  const { name, age } = CreateChildSchema.parse(req.body);
  // ... logique
} catch (error) {
  if (error instanceof z.ZodError) {
    const response: ApiResponse = {
      success: false,
      error: 'Invalid input data',
      validationErrors: error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    };
    res.status(400).json(response);
    return;
  }
  throw error;
}
```

**Après :**
```typescript
// Option 1: Middleware (recommandé)
router.post('/children', validateBody(CreateChildSchema, {
  operationName: 'CreateChild'
}), createChildController);

// Option 2: Wrapper pour logique existante
export const createChild = withZodErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { name, age } = CreateChildSchema.parse(req.body);
  // ... logique
}, { operationName: 'CreateChild' });
```

### Étape 2: Ajouter le logging contextuel (optionnel)

```typescript
import { createControllerLogger } from '../utils/controllerLogging';

const childLogger = createControllerLogger('ChildController');

export const ChildController = class {
  createChild = async (req: Request, res: Response): Promise<void> => {
    childLogger.logStart('createChild', req, { body: req.body });

    try {
      const result = await this.childService.createChild(/* ... */);
      childLogger.logSuccess('createChild', req, { childId: result.id });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      childLogger.logError('createChild', req, error);
      throw error;
    }
  };
};
```

### Étape 3: Combiner les validations

**Avant :**
```typescript
router.post('/groups/:groupId/children/:childId',
  validateParams(GroupParamsSchema),
  validateParams(ChildParamsSchema),  // Conflit !
  validateBody(AssignmentSchema),
  controller
);
```

**Après :**
```typescript
router.post('/groups/:groupId/children/:childId',
  validateRequest({
    params: AssignmentParamsSchema,  // Schéma combiné
    body: AssignmentSchema,
  }, {
    operationName: 'AssignChildToGroup'
  }),
  controller
);
```

## 📊 Avantages

### 1. **Réduction de Code**
- **-26 blocs try/catch** dupliqués
- **-~400 lignes** de code de validation
- **+1 middleware** réutilisable

### 2. **Logging Amélioré**
- **Contexte automatique** (user, endpoint, timestamp)
- **Logs structurés** pour analyse
- **Traçabilité** des erreurs de validation

### 3. **Maintenance Facilitée**
- **Gestion centralisée** des erreurs
- **Format standardisé** des réponses
- **Configuration flexible** par endpoint

### 4. **Performance**
- **Impact minimal** (< 1ms par requête)
- **Validation early-exit**
- **Lazy evaluation** du contexte

## 🧪 Tests

Les tests couvrent :
- ✅ Validation réussie et échec
- ✅ Messages d'erreur personnalisés
- ✅ Codes HTTP personnalisés
- ✅ Logging contextuel
- ✅ Backward compatibility
- ✅ Gestion des erreurs inattendues

```bash
# Exécuter les tests du middleware
npm test -- src/middleware/__tests__/validation.test.ts
```

## 🔍 Exemples d'Usage

### API CRUD Complète

```typescript
// routes/users.ts
import { validateBody, validateParams, validateRequest } from '../middleware/validation';
import { withZodErrorHandling } from '../middleware/validation';
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0).optional(),
});

const UserParamsSchema = z.object({
  id: z.string().uuid(),
});

const UpdateUserSchema = UserSchema.partial();

// POST /users
router.post('/',
  validateBody(UserSchema, {
    operationName: 'CreateUser',
    includeBusinessContext: true
  }),
  userController.create
);

// GET /users/:id
router.get('/:id',
  validateParams(UserParamsSchema, {
    operationName: 'GetUser'
  }),
  userController.getById
);

// PUT /users/:id
router.put('/:id',
  validateRequest({
    params: UserParamsSchema,
    body: UpdateUserSchema,
  }, {
    operationName: 'UpdateUser',
    errorMessage: 'Invalid user update data'
  }),
  userController.update
);

// Contrôleur avec wrapper pour logique complexe
const userController = {
  create: withZodErrorHandling(async (req: Request, res: Response) => {
    const userData = UserSchema.parse(req.body);
    const user = await userService.create(userData);
    res.status(201).json({ success: true, data: user });
  }, { operationName: 'CreateUser' }),
};
```

## 🔮 Évolutions Futures

- **Validation conditionnelle** basée sur les permissions
- **Internationalisation** des messages d'erreur
- **Metrics** de validation par endpoint
- **Intégration** avec des outils de monitoring externes