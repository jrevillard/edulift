# Plan : Fusionner /children dans /vehicles avec PATCH

## 🎯 Objectif

Simplifier l'API en fusionnant l'endpoint `/children` dans `/vehicles` avec une approche RESTful.

## 📋 Changements API

### Avant (2 endpoints)
```typescript
// 1. Créer VehicleAssignment (avec ou sans enfants)
POST /schedule-slots/{id}/vehicles
Body: { vehicleId, driverId?, seatOverride? }
Response: VehicleAssignment

// 2. Ajouter un enfant à une VehicleAssignment existante
POST /schedule-slots/{id}/children
Body: { childId, vehicleAssignmentId }
Response: ScheduleSlot
```

### Après (2 endpoints, mais cohérents)
```typescript
// 1. Créer VehicleAssignment (optionnellement avec enfants)
POST /schedule-slots/{id}/vehicles
Body: {
  vehicleId,
  driverId?,
  seatOverride?,
  childIds?: string[]  // NOUVEAU : optionnel, assignation initiale
}
Response: ScheduleSlot  // CHANGÉ : retourne le slot complet

// 2. Modifier une VehicleAssignment existante
PATCH /schedule-slots/{id}/vehicles/{vehicleAssignmentId}
Body: {
  driverId?,              // Optionnel : modifier le conducteur
  seatOverride?,          // Optionnel : modifier la capacité
  addChildIds?: string[], // Optionnel : ajouter des enfants
  removeChildIds?: string[] // Optionnel : retirer des enfants
}
Response: ScheduleSlot
```

## 🔧 Implémentation

### Phase 1 : Backend - Modifié POST /vehicles

**Fichier** : `src/controllers/v1/ScheduleSlotController.ts`

#### 1.1 Modifier le schéma de requête
```typescript
// Fichier : src/schemas/scheduleSlots.ts
export const AssignVehicleSchema = z.object({
  vehicleId: z.cuid(),
  driverId: z.cuid().optional(),
  seatOverride: z.number().int().min(0).max(10).optional(),
  childIds: z.array(z.cuid()).optional(), // NOUVEAU
}).openapi({
  title: 'Assign Vehicle to Schedule Slot',
  description: 'Assign a vehicle to an existing schedule slot, optionally with initial children',
});
```

#### 1.2 Modifier le contrôleur POST /vehicles
```typescript
// Ligne ~1039-1104 dans ScheduleSlotController.ts
app.openapi(assignVehicleRoute, async (c) => {
  const userId = c.get('userId');
  const { scheduleSlotId } = c.req.valid('param');
  const input = c.req.valid('json');

  if (!input.vehicleId) {
    return c.json({
      success: false,
      error: 'Vehicle ID is required',
    }, 400);
  }

  try {
    const scheduleSlot = await scheduleSlotServiceInstance.getScheduleSlotDetails(scheduleSlotId);
    if (!scheduleSlot) {
      return c.json({
        success: false,
        error: 'Schedule slot not found',
      }, 404);
    }

    const accessError = await verifyGroupAccess(prismaInstance, userId, scheduleSlot.groupId);
    if (!accessError.hasAccess) {
      return c.json({ success: false, error: accessError.error }, accessError.statusCode);
    }

    const vehicleAccessError = await verifyVehicleOwnership(prismaInstance, userId, input.vehicleId);
    if (!vehicleAccessError.hasAccess) {
      return c.json({ success: false, error: vehicleAccessError.error }, vehicleAccessError.statusCode);
    }

    // Create vehicle assignment
    const assignmentData: AssignVehicleToSlotData = {
      scheduleSlotId,
      vehicleId: input.vehicleId,
    };
    if (input.driverId !== undefined) {
      assignmentData.driverId = input.driverId;
    }
    if (input.seatOverride !== undefined) {
      assignmentData.seatOverride = input.seatOverride;
    }

    const vehicleAssignment = await scheduleSlotServiceInstance.assignVehicleToSlot(assignmentData);

    // NOUVEAU : Assign children if provided
    if (input.childIds && input.childIds.length > 0) {
      for (const childId of input.childIds) {
        await childAssignmentServiceInstance.assignChildToScheduleSlot(
          scheduleSlotId,
          childId,
          vehicleAssignment.id,
          userId,
        );
      }
    }

    // CHANGÉ : Fetch complete ScheduleSlot (pas juste VehicleAssignment)
    const updatedSlot = await scheduleSlotServiceInstance.getScheduleSlotDetails(scheduleSlotId);
    if (!updatedSlot) {
      return c.json({
        success: false,
        error: 'Schedule slot was deleted during update',
      }, 404);
    }

    SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, updatedSlot);
    SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);

    return c.json({
      success: true,
      data: updatedSlot, // CHANGÉ : ScheduleSlot complet
    }, 201);
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to assign vehicle',
      code: 'ASSIGN_FAILED' as const,
    }, 500);
  }
});
```

#### 1.3 Modifier le schéma de réponse
```typescript
// Fichier : src/controllers/v1/ScheduleSlotController.ts
// Ligne ~1037 (assignVehicleRoute)

responses: {
  201: {
    content: {
      'application/json': {
        schema: createSuccessSchema(ScheduleSlotSchema), // CHANGÉ : était ScheduleVehicleAssignmentSchema
      },
    },
    description: 'Vehicle assigned successfully',
  },
  // ... rest inchangé
}
```

### Phase 2 : Backend - Ajouter PATCH /vehicles/{id}

**Fichier** : `src/controllers/v1/ScheduleSlotController.ts`

#### 2.1 Créer le schéma de requête PATCH
```typescript
// Fichier : src/schemas/scheduleSlots.ts

export const PatchVehicleAssignmentSchema = z.object({
  driverId: z.cuid().optional(),
  seatOverride: z.number().int().min(0).max(10).optional(),
  addChildIds: z.array(z.cuid()).optional(),
  removeChildIds: z.array(z.cuid()).optional(),
}).openapi({
  title: 'Update Vehicle Assignment',
  description: 'Update driver, seat override, or add/remove children in a vehicle assignment',
});
```

#### 2.2 Créer la route PATCH
```typescript
// Fichier : src/controllers/v1/ScheduleSlotController.ts
// Ajouter après la route DELETE /vehicles (~ligne 1150)

/**
 * PATCH /schedule-slots/:scheduleSlotId/vehicles/:vehicleAssignmentId - Update vehicle assignment
 */
const patchVehicleAssignmentRoute = createRoute({
  method: 'patch',
  path: '/schedule-slots/{scheduleSlotId}/vehicles/{vehicleAssignmentId}',
  tags: ['Schedule Slots'],
  summary: 'Update vehicle assignment',
  description: 'Update driver, seat capacity, or add/remove children in an existing vehicle assignment',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      scheduleSlotId: z.cuid(),
      vehicleAssignmentId: z.cuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: PatchVehicleAssignmentSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: createSuccessSchema(ScheduleSlotSchema),
        },
      },
      description: 'Vehicle assignment updated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Bad request - Invalid input',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Schedule slot or vehicle assignment not found',
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Access denied',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

app.openapi(patchVehicleAssignmentRoute, async (c) => {
  const userId = c.get('userId');
  const { scheduleSlotId, vehicleAssignmentId } = c.req.valid('param');
  const input = c.req.valid('json');

  try {
    // Get schedule slot for access check
    const scheduleSlot = await scheduleSlotServiceInstance.getScheduleSlotDetails(scheduleSlotId);
    if (!scheduleSlot) {
      return c.json({
        success: false,
        error: 'Schedule slot not found',
      }, 404);
    }

    // Verify user has access to the group
    const accessError = await verifyGroupAccess(prismaInstance, userId, scheduleSlot.groupId);
    if (!accessError.hasAccess) {
      return c.json({ success: false, error: accessError.error }, accessError.statusCode);
    }

    // Verify vehicle assignment exists in this slot
    const vehicleAssignment = scheduleSlot.vehicleAssignments?.find(va => va.id === vehicleAssignmentId);
    if (!vehicleAssignment) {
      return c.json({
        success: false,
        error: 'Vehicle assignment not found in this schedule slot',
      }, 404);
    }

    // Update driver if provided
    if (input.driverId !== undefined) {
      await scheduleSlotServiceInstance.updateVehicleDriver(scheduleSlotId, vehicleAssignmentId, input.driverId, userId);
    }

    // Update seat override if provided
    if (input.seatOverride !== undefined) {
      await scheduleSlotServiceInstance.updateSeatOverrideByVehicle(scheduleSlotId, vehicleAssignmentId, input.seatOverride, userId);
    }

    // Add children if provided
    if (input.addChildIds && input.addChildIds.length > 0) {
      for (const childId of input.addChildIds) {
        await childAssignmentServiceInstance.assignChildToScheduleSlot(
          scheduleSlotId,
          childId,
          vehicleAssignmentId,
          userId,
        );
      }
    }

    // Remove children if provided
    if (input.removeChildIds && input.removeChildIds.length > 0) {
      for (const childId of input.removeChildIds) {
        await childAssignmentServiceInstance.removeChildFromScheduleSlot(
          scheduleSlotId,
          childId,
          vehicleAssignmentId,
          userId,
        );
      }
    }

    // Fetch complete updated ScheduleSlot
    const updatedSlot = await scheduleSlotServiceInstance.getScheduleSlotDetails(scheduleSlotId);
    if (!updatedSlot) {
      return c.json({
        success: false,
        error: 'Schedule slot was deleted during update',
      }, 404);
    }

    SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, updatedSlot);
    SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);

    return c.json({
      success: true,
      data: updatedSlot,
    }, 200);
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to update vehicle assignment',
      code: 'UPDATE_FAILED' as const,
    }, 500);
  }
});
```

### Phase 3 : Déprécier (pas supprimer) POST /children

**Fichier** : `src/controllers/v1/ScheduleSlotController.ts`

```typescript
/**
 * POST /schedule-slots/:scheduleSlotId/children - Assign child to slot
 * @deprecated Use PATCH /schedule-slots/:scheduleSlotId/vehicles/:vehicleAssignmentId with addChildIds instead
 */
app.openapi(assignChildRoute, async (c) => {
  // ... code existant inchangé ...
});
```

**Ajouter dans la description** :
```typescript
description: 'Assign a child to a specific vehicle assignment in a schedule slot. **DEPRECATED**: Use PATCH /schedule-slots/{scheduleSlotId}/vehicles/{vehicleAssignmentId} with addChildIds instead.',
```

### Phase 4 : Tests Backend

**Fichier** : `src/controllers/__tests__/ScheduleSlotController.test.ts`

#### 4.1 Modifier les tests POST /vehicles
- Ajouter tests pour `childIds` optionnel
- Vérifier que la réponse est un ScheduleSlot complet
- Tester la création avec et sans enfants

#### 4.2 Ajouter des tests PATCH /vehicles/{id}
- Tester update driver
- Tester update seatOverride
- Tester add children
- Tester remove children
- Tester update combiné (driver + children)

#### 4.3 Marquer les tests POST /children comme @deprecated
- Garder les tests existants pour compatibilité
- Ajouter commentaire @deprecated

### Phase 5 : Frontend

**Fichier** : `src/components/ChildAssignmentModal.tsx`

#### 5.1 Modifier assignChildMutation
```typescript
// Ancien code (ligne ~189-197)
const assignChildMutation = useMutation({
  mutationFn: async ({ scheduleSlotId, childId, vehicleAssignmentId }) => {
    const { data } = await api.POST('/schedule-slots/{scheduleSlotId}/children', {
      params: { path: { scheduleSlotId } },
      body: { childId, vehicleAssignmentId }
    });
    return data?.data;
  },
  // ...
});

// Nouveau code
const assignChildMutation = useMutation({
  mutationFn: async ({ scheduleSlotId, vehicleAssignmentId, childId }) => {
    const { data } = await api.PATCH('/schedule-slots/{scheduleSlotId}/vehicles/{vehicleAssignmentId}', {
      params: { path: { scheduleSlotId, vehicleAssignmentId } },
      body: { addChildIds: [childId] }
    });
    return data?.data;
  },
  // ...
});
```

#### 5.2 Modifier removeChildMutation
```typescript
// Ancien code
const { data } = await api.DELETE('/schedule-slots/{scheduleSlotId}/children/{childId}', {
  params: { path: { scheduleSlotId, childId } },
  body: { vehicleAssignmentId }
});

// Nouveau code
const { data } = await api.PATCH('/schedule-slots/{scheduleSlotId}/vehicles/{vehicleAssignmentId}', {
  params: { path: { scheduleSlotId, vehicleAssignmentId } },
  body: { removeChildIds: [childId] }
});
```

#### 5.3 Optimiser : Batch assign
```typescript
// Nouveau : Assigner plusieurs enfants en un appel
const assignMultipleChildrenMutation = useMutation({
  mutationFn: async ({ scheduleSlotId, vehicleAssignmentId, childIds }) => {
    const { data } = await api.PATCH('/schedule-slots/{scheduleSlotId}/vehicles/{vehicleAssignmentId}', {
      params: { path: { scheduleSlotId, vehicleAssignmentId } },
      body: { addChildIds: childIds }
    });
    return data?.data;
  },
});
```

### Phase 6 : Tests E2E

**Fichier** : Tests E2E existants

#### 6.1 Corriger le test VA-01B
```typescript
// Ancien (échouait avec childId: null)
POST /schedule-slots/{id}/children
Body: { childId: null, vehicleAssignmentId: "..." }

// Nouveau (crée l'assignation vide)
POST /schedule-slots/{id}/vehicles
Body: { vehicleId: "..." }
```

#### 6.2 Ajouter des tests pour PATCH
```typescript
// Ajouter des enfants plus tard
PATCH /schedule-slots/{id}/vehicles/{vehicleAssignmentId}
Body: { addChildIds: ["child1", "child2"] }

// Retirer des enfants
PATCH /schedule-slots/{id}/vehicles/{vehicleAssignmentId}
Body: { removeChildIds: ["child1"] }

// Update conducteur + enfants
PATCH /schedule-slots/{id}/vehicles/{vehicleAssignmentId}
Body: { driverId: "newDriver", addChildIds: ["child3"] }
```

### Phase 7 : OpenAPI/Swagger

```bash
# Régénérer le Swagger
npm run openapi:generate
```

## ✅ Checklist de validation

- [ ] POST /vehicles retourne ScheduleSlot complet
- [ ] POST /vehicles accepte `childIds` optionnel
- [ ] PATCH /vehicles/{id} créé et fonctionnel
- [ ] POST /children marqué @deprecated
- [ ] Tous les tests backend passent
- [ ] Frontend migré vers PATCH
- [ ] Tests E2E mis à jour
- [ ] Swagger régénéré
- [ ] 100% des tests passent

## 📊 Avantages de cette approche

1. ✅ **Cohérence** : Un seul endpoint (/vehicles) pour tout ce qui concerne les véhicules
2. ✅ **RESTful** : POST = créer, PATCH = modifier
3. ✅ **Optimisation** : Possibilité de batch assign/remove children
4. ✅ **Flexibilité** : PATCH permet de modifier driver, sièges ET enfants en un appel
5. ✅ **Rétrocompatibilité** : POST /children n'est pas supprimé, juste déprécié
6. ✅ **Clarté** : Structure hiérarchique claire (/vehicles/{id}/children)

## 🚨 Breaking Changes

### Pour les clients de l'API
- POST /vehicles retourne maintenant `ScheduleSlot` au lieu de `VehicleAssignment`
- Les clients doivent utiliser PATCH pour modifier une assignation existante

### Migration frontend
- `ChildAssignmentModal` : changer POST /children → PATCH /vehicles/{id}
- Tous les appels à DELETE /children/{childId} → PATCH /vehicles/{id} avec removeChildIds
