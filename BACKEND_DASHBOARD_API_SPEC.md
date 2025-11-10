# Backend Dashboard API - Spécification Complète

## ✅ STATUT: IMPLÉMENTÉ ET ALIGNÉ

Endpoint implémenté: `GET /api/v1/dashboard/weekly`

**⚠️ DOCUMENTATION MISE À JOUR POUR CORRESPONDRE À L'API RÉELLE:**
- Tous les types et structures ont été vérifiés contre l'implémentation backend
- Les champs optionnels et logiques réelles sont documentés
- Les comportements de calcul sont expliqués (type) et l'identification de groupe est documentée

---

## ❌ Problème Actuel

L'app mobile appelle `/api/v1/groups/{groupId}/schedule` avec `family.id` au lieu de `group.id`, causant une erreur 500 "Group not found".

## ✅ Solution Requise

Créer/modifier l'endpoint `/api/dashboard/weekly` pour qu'il agrège automatiquement les données de tous les groupes de la famille authentifiée.

---

## 📋 Spécification de l'Endpoint

### Endpoint
```
GET /api/dashboard/weekly
```

### Authentification
- Requiert un token JWT valide
- Extrait automatiquement `user.id` et `family.id` du token

### Query Parameters
```typescript
{
  startDate?: string; // ISO date, défaut: aujourd'hui
  // Pas besoin de groupId - détecté automatiquement depuis la famille
}
```

### Response Format
```typescript
{
  success: true,
  data: {
    days: DayTransportSummary[] // 7 jours glissants
  }
}

interface DayTransportSummary {
  date: string; // ISO date (YYYY-MM-DD)
  transports: TransportSlotSummary[];
  totalChildrenInVehicles: number;
  totalVehiclesWithAssignments: number;
  hasScheduledTransports: boolean;
}

interface TransportSlotSummary {
  time: string; // Format HH:mm
  groupId: string; // ID du groupe pour ce transport
  groupName: string; // Nom du groupe pour identification
  scheduleSlotId: string; // ID unique du slot de transport
  vehicleAssignmentSummaries: VehicleAssignmentSummary[];
  totalChildrenAssigned: number;
  totalCapacity: number;
  overallCapacityStatus: 'available' | 'limited' | 'full' | 'overcapacity';
}

interface VehicleAssignmentSummary {
  vehicleId: string;
  vehicleName: string;
  vehicleCapacity: number;
  assignedChildrenCount: number;
  availableSeats: number;
  capacityStatus: 'available' | 'limited' | 'full' | 'overcapacity';
  vehicleFamilyId: string; // Pour savoir si c'est un véhicule de la famille
  isFamilyVehicle: boolean; // true si vehicleFamilyId === authenticatedFamily.id
  driver?: {
    id: string;
    name: string;
  };
  // OPTIONAL: Info conducteur si assigné
  // OPTIONAL: Details des enfants assignés à ce véhicule
  children?: {
    childId: string;
    childName: string;
    childFamilyId: string;
    isFamilyChild: boolean;
  }[];
}
```

---

## 🎯 Règles Métier - TRÈS IMPORTANT

### 🆕 **Logiques de Calcul Backend** (Implémentation réelle)

#### Group Identification
Chaque transport inclut maintenant des informations de groupe pour une identification claire:
- **groupId**: ID unique du groupe associé au transport
- **groupName**: Nom lisible du groupe pour l'interface utilisateur
- **scheduleSlotId**: ID unique du slot de transport pour référence

**Important**: Ces champs remplacent le champ "destination" précédemment utilisé

#### Calcul de Type (NON INCLUS DANS LA RÉPONSE API)
```typescript
private determineType(time: string): 'pickup' | 'dropoff' {
  const hour = parseInt(time.split(':')[0]);
  return hour < 12 ? 'pickup' : 'dropoff';
}
```
- **Matin (< 12h)** : `pickup`
- **Après-midi (≥ 12h)** : `dropoff`
- **Note** : Ce champ est calculé par le backend mais **N'EST PAS inclus** dans la réponse API

#### Réponse API Complète
```typescript
interface WeeklyDashboardResponse {
  success: boolean;
  data?: {
    days: DayTransportSummary[];
    startDate?: string; // YYYY-MM-DD
    endDate?: string;   // YYYY-MM-DD
    generatedAt?: string; // ISO timestamp
    metadata?: {
      familyId?: string;
      familyName?: string;
      totalGroups?: number;
      totalChildren?: number;
    };
  };
}
```

---

## 🎯 Règles Métier - TRÈS IMPORTANT

### 1. Identification de la Famille
```typescript
// Extraire depuis le JWT
const authenticatedUserId = req.user.id;
const authenticatedFamilyId = req.user.familyId;

// Ou via une jointure User -> Family
const family = await Family.findOne({
  where: { userId: authenticatedUserId }
});
```

### 2. Filtrage des Groupes
**Inclure:** Tous les groupes auxquels la famille appartient
```sql
SELECT g.*
FROM groups g
JOIN group_families gf ON gf.groupId = g.id
WHERE gf.familyId = :authenticatedFamilyId
  AND g.isActive = true
```

### 3. Période de 7 Jours Glissants
```typescript
const startDate = queryParams.startDate
  ? new Date(queryParams.startDate)
  : new Date(); // Aujourd'hui

const endDate = new Date(startDate);
endDate.setDate(endDate.getDate() + 6); // +6 jours = 7 jours total

// Période: [startDate, startDate+1, ..., startDate+6]
```

### 4. Filtrage des Transports (Schedule Slots)
**Inclure:** Seulement les transports où au moins un enfant de la famille est assigné

**✅ NOTE IMPLEMENTATION:** Les enfants sont au niveau `VehicleAssignmentSummary`, pas `ScheduleSlotChild`.
Le filtrage se fait uniquement sur `familyId`, sans filtrage par statut.

```typescript
// Prisma query avec filtrage DB-level pour performance
const scheduleSlots = await prisma.scheduleSlot.findMany({
  where: {
    groupId: { in: groupIds },
    datetime: { gte: startDate, lte: endDate },
    // Filtre DB-level: seulement les slots avec véhicules ayant des enfants de la famille
    vehicleAssignments: {
      some: {
        childAssignments: {
          some: {
            child: {
              familyId: authenticatedFamilyId
            }
          }
        }
      }
    }
  }
});
```

**⚠️ IMPORTANT:** Ne PAS inclure les transports où:
- Aucun enfant de la famille n'est assigné aux véhicules
- Aucun véhicule assigné (slots sans véhicules sont ignorés)

### 5. Filtrage des Véhicules
Pour chaque transport (schedule slot), inclure:

#### A) Véhicules de la famille (toujours affichés)
```sql
SELECT va.*, v.*
FROM vehicle_assignments va
JOIN vehicles v ON v.id = va.vehicleId
WHERE va.scheduleSlotId = :slotId
  AND v.familyId = :authenticatedFamilyId -- Véhicule appartient à la famille
```

#### B) Véhicules d'autres familles (SI enfants de la famille dedans)
**⚠️ NOTE:** Pas de filtrage par `status` (champ n'existe pas dans le schéma)

```typescript
// Logique implémentée en TypeScript
for (const va of vehicleAssignments) {
  const isFamilyVehicle = va.vehicle.family.id === authenticatedFamilyId;

  const hasFamilyChildren = va.childAssignments.some(
    ca => ca.child.family.id === authenticatedFamilyId
  );

  // Inclure si: véhicule de la famille OU a des enfants de la famille
  if (isFamilyVehicle || hasFamilyChildren) {
    // ... créer VehicleAssignmentSummary
  }
}
```

**Logique combinée:**
```typescript
const vehiclesForSlot = [
  ...familyOwnedVehicles, // Tous les véhicules de la famille
  ...otherVehiclesWithFamilyChildren // Autres véhicules SI enfants dedans
];
```

### 6. Calcul des Capacités
Pour chaque véhicule:
```typescript
interface VehicleAssignmentSummary {
  vehicleCapacity: number; // vehicle.capacity OU seatOverride si défini
  assignedChildrenCount: number; // COUNT(child_assignments)
  availableSeats: number; // capacity - assignedChildrenCount
  capacityStatus: CapacityStatus;
}

// Détermination du status (calculé dans le backend)
function getCapacityStatus(available: number, total: number): CapacityStatus {
  const ratio = available / total;
  if (ratio <= 0) return 'overcapacity'; // Surbooké
  if (ratio <= 0.1) return 'full'; // >= 90% plein
  if (ratio <= 0.3) return 'limited'; // >= 70% plein
  return 'available'; // < 70% plein
}
```

**✅ IMPLEMENTATION RÉELLE:** Les enfants sont assignés au niveau véhicule, pas transport
```typescript
const assignedChildrenCount = assignedChildren.length; // childAssignments au niveau véhicule
```

### 7. Agrégation Multi-Groupes
```typescript
// Récupérer les slots de TOUS les groupes de la famille
const allGroupIds = familyGroups.map(g => g.id);

const slots = await ScheduleSlot.findAll({
  where: {
    groupId: { [Op.in]: allGroupIds },
    datetime: { [Op.between]: [startDate, endDate] }
  },
  include: [
    {
      model: VehicleAssignment,
      include: [
        { model: Vehicle },
        {
          model: ChildAssignment,
          where: { status: 'assigned' },
          include: [
            {
              model: Child,
              where: { familyId: authenticatedFamilyId } // FILTRE CRUCIAL
            }
          ]
        }
      ]
    }
  ]
});

// Grouper par jour
const daysSummaries = groupSlotsByDay(slots);
```

---

## 🔧 Implémentation Recommandée

### Fichier: `src/controllers/DashboardController.ts`

```typescript
export async function getWeeklyDashboard(req: Request, res: Response) {
  try {
    // 1. Authentification
    const authenticatedFamilyId = req.user.familyId;
    if (!authenticatedFamilyId) {
      return res.status(401).json({
        success: false,
        error: 'No family associated with user'
      });
    }

    // 2. Paramètres
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    // 3. Récupérer tous les groupes de la famille
    const familyGroups = await Group.findAll({
      include: [{
        model: GroupFamily,
        where: { familyId: authenticatedFamilyId }
      }]
    });

    if (familyGroups.length === 0) {
      return res.json({
        success: true,
        data: { days: [] } // Pas de groupes = pas de transports
      });
    }

    const groupIds = familyGroups.map(g => g.id);

    // 4. Récupérer les slots avec filtrage famille
    const slots = await ScheduleSlot.findAll({
      where: {
        groupId: { [Op.in]: groupIds },
        datetime: { [Op.between]: [startDate, endDate] }
      },
      include: [
        {
          model: VehicleAssignment,
          required: true, // INNER JOIN - seulement si véhicules assignés
          include: [
            {
              model: Vehicle,
              required: true
            },
            {
              model: ChildAssignment,
              required: true, // CRUCIAL: seulement si enfants assignés
              where: { status: 'assigned' },
              include: [
                {
                  model: Child,
                  required: true,
                  where: {
                    familyId: authenticatedFamilyId // FILTRE FAMILLE
                  }
                }
              ]
            }
          ]
        }
      ],
      order: [['datetime', 'ASC']]
    });

    // 5. Pour chaque slot, filtrer les véhicules selon les règles
    const enrichedSlots = await Promise.all(
      slots.map(async (slot) => {
        const vehicleAssignments = await getFilteredVehicles(
          slot,
          authenticatedFamilyId
        );
        return { ...slot.toJSON(), vehicleAssignments };
      })
    );

    // 6. Agréger par jour
    const daysSummaries = groupSlotsByDay(enrichedSlots, startDate);

    // 7. Retour
    return res.json({
      success: true,
      data: { days: daysSummaries }
    });

  } catch (error) {
    console.error('Error in getWeeklyDashboard:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      statusCode: 500
    });
  }
}

// Fonction helper pour filtrer les véhicules
async function getFilteredVehicles(
  slot: ScheduleSlot,
  familyId: string
): Promise<VehicleAssignmentSummary[]> {
  const allVehicles = await VehicleAssignment.findAll({
    where: { scheduleSlotId: slot.id },
    include: [
      { model: Vehicle },
      {
        model: ChildAssignment,
        where: { status: 'assigned' },
        required: false,
        include: [{ model: Child }]
      }
    ]
  });

  // Filtrer selon les règles
  const filteredVehicles = allVehicles.filter(va => {
    const vehicle = va.vehicle;
    const isFamilyVehicle = vehicle.familyId === familyId;

    // Cas 1: Véhicule de la famille -> TOUJOURS inclure
    if (isFamilyVehicle) {
      return true;
    }

    // Cas 2: Véhicule d'une autre famille -> inclure SI enfants de la famille
    const hasFamilyChildren = va.childAssignments.some(
      ca => ca.child.familyId === familyId
    );
    return hasFamilyChildren;
  });

  // Transformer en VehicleAssignmentSummary
  return filteredVehicles.map(va => {
    const capacity = va.seatOverride ?? va.vehicle.capacity;
    const assignedCount = va.childAssignments.filter(
      ca => ca.status === 'assigned'
    ).length;
    const available = capacity - assignedCount;

    return {
      vehicleId: va.vehicleId,
      vehicleName: va.vehicle.name,
      vehicleCapacity: capacity,
      assignedChildrenCount: assignedCount,
      availableSeats: available,
      capacityStatus: getCapacityStatus(available, capacity),
      vehicleFamilyId: va.vehicle.familyId,
      isFamilyVehicle: va.vehicle.familyId === familyId
    };
  });
}

function groupSlotsByDay(
  slots: ScheduleSlot[],
  startDate: Date
): DayTransportSummary[] {
  // Créer un tableau de 7 jours
  const days: DayTransportSummary[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    // Filtrer les slots pour ce jour
    const daySlots = slots.filter(slot => {
      const slotDate = new Date(slot.datetime);
      return slotDate.toDateString() === date.toDateString();
    });

    // Agréger les données
    const transports = daySlots.map(slot => transformToTransportSummary(slot));
    const totalChildren = transports.reduce(
      (sum, t) => sum + t.totalChildrenAssigned, 0
    );
    const totalVehicles = transports.reduce(
      (sum, t) => sum + t.vehicleAssignmentSummaries.length, 0
    );

    days.push({
      date: date.toISOString().split('T')[0],
      transports,
      totalChildrenInVehicles: totalChildren,
      totalVehiclesWithAssignments: totalVehicles,
      hasScheduledTransports: transports.length > 0
    });
  }

  return days;
}
```

---

## 🧪 Tests à Effectuer

### Test 1: Famille avec 1 groupe
- ✅ Vérifie que seuls les transports du groupe sont retournés
- ✅ Vérifie que seuls les enfants de cette famille sont comptés

### Test 2: Famille avec plusieurs groupes
- ✅ Vérifie l'agrégation des transports de tous les groupes
- ✅ Vérifie qu'il n'y a pas de doublons

### Test 3: Véhicules de la famille
- ✅ Vérifie que tous les véhicules de la famille sont affichés
- ✅ Même s'ils sont vides (0 enfant assigné)

### Test 4: Véhicules d'autres familles
- ✅ Vérifie qu'ils apparaissent SI enfants de la famille dedans
- ✅ Vérifie qu'ils n'apparaissent PAS si aucun enfant de la famille

### Test 5: Période de 7 jours
- ✅ Vérifie que exactement 7 jours sont retournés
- ✅ Vérifie que les jours sans transport ont `transports: []`

### Test 6: Calcul des capacités
- ✅ Vérifie `seatOverride` est prioritaire sur `vehicle.capacity`
- ✅ Vérifie que `assignedChildrenCount` compte seulement status='assigned'

---

## 🚀 Priorité d'Implémentation

1. **Phase 1 - Fix critique (maintenant)**
   - Implémenter l'endpoint `/api/dashboard/weekly`
   - Filtrage correct par famille
   - Tests unitaires

2. **Phase 2 - Optimisation (après)**
   - Cache Redis pour les données fréquentes
   - Pagination si > 50 transports
   - Logs de performance

3. **Phase 3 - Features avancées (futur)**
   - Notifications push si transport bientôt
   - Filtres par type de transport
   - Historique des transports passés

---

## 📝 Notes Importantes

- **Ne PAS utiliser `family.id` comme `groupId`** ❌
- **Toujours filtrer par `child.familyId = authenticatedFamilyId`** ✅
- **Respecter les règles de filtrage des véhicules** ✅
- **Retourner 7 jours même si certains sont vides** ✅
- **Gérer les erreurs 401/403/500 proprement** ✅
