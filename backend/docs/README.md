# EduLift Backend - Documentation

Bienvenue dans la documentation du backend EduLift.

## 📚 Table des Matières

### Documentation API REST (HTTP)

- **[Migration OpenAPI - Résumé](./OPENAPI_SUMMARY.md)** - Vue d'ensemble de la migration vers OpenAPI 3.1
- **[Plan de Migration OpenAPI](./OPENAPI_MIGRATION_PLAN.md)** - Plan complet détaillé en 7 phases avec stratégie de non-régression
- **[Analyse des Endpoints](./OPENAPI_ENDPOINTS_ANALYSIS.md)** - Résultats de l'analyse d'utilisation des endpoints

### Documentation API WebSocket (Real-time)

- **[AsyncAPI Documentation](./asyncapi/README.md)** - Documentation complète de l'API WebSocket
- **[AsyncAPI Specification](./asyncapi/asyncapi.yaml)** - Spécification AsyncAPI formelle
- **[Examples](./asyncapi/examples/)** - Flows d'exemple pour les événements WebSocket

### Documentation Technique

- **[Instructions pour les Agents AI](../AGENTS.md)** - Guide pour les assistants de code IA
- **[Documentation API](./API_DOCUMENTATION.md)** - Documentation de l'API (à créer après migration)

---

## 🌐 API Documentation

### API REST (HTTP)

- **Spécification:** `/backend/docs/openapi/swagger.json`
- **UI Interactive:** `http://localhost:3000/api-docs` (dev only)
- **Génération:** `npm run swagger:generate`
- **Version:** OpenAPI 3.1.0
- **Endpoints:** 93+ endpoints documentés

### API WebSocket (Real-time)

- **Spécification:** `/backend/docs/asyncapi/asyncapi.yaml`
- **Documentation:** `/backend/docs/asyncapi/README.md`
- **Validation:** `npm run asyncapi:validate`
- **Génération HTML:** `npm run asyncapi:generate`
- **Version:** AsyncAPI 2.6.0
- **Événements:** 40+ événements documentés

**Événements WebSocket par catégorie:**

| Catégorie | Événements | Description |
|-----------|------------|-------------|
| Connection | 2 | Connexion, déconnexion |
| Groups | 9 | Création, suppression, gestion membres |
| Schedules | 7 | Mises à jour créneaux horaires |
| Children | 3 | Gestion des enfants |
| Vehicles | 3 | Gestion des véhicules |
| Families | 3 | Gestion des familles |
| Presence | 4 | Statut utilisateurs |
| System | 3 | Notifications, erreurs, heartbeat |

---

## 🚀 Migration OpenAPI - État d'Avancement

### Statut Actuel : Phase d'Analyse Complétée ✅

```
Phase 1 : Analyse et Préparation
├─ [x] 1.1 Inventaire API (70+ endpoints)
├─ [x] 1.2 Analyse endpoints internes (2 à masquer)
└─ [ ] 1.3 Capture baseline

Phase 2-7 : Implémentation
└─ [ ] En attente
```

### Documents Créés

| Document | Statut | Description |
|----------|--------|-------------|
| [OPENAPI_SUMMARY.md](./OPENAPI_SUMMARY.md) | ✅ | Résumé exécutif de la migration |
| [OPENAPI_MIGRATION_PLAN.md](./OPENAPI_MIGRATION_PLAN.md) | ✅ | Plan détaillé en 7 phases |
| [OPENAPI_ENDPOINTS_ANALYSIS.md](./OPENAPI_ENDPOINTS_ANALYSIS.md) | ✅ | Analyse détaillée des endpoints |
| [../scripts/analyze-endpoint-usage.sh](../scripts/analyze-endpoint-usage.sh) | ✅ | Script d'analyse automatique |

---

## 🔍 Résultats Clés de l'Analyse

### Endpoints à Masquer en Production

Sur **70+ endpoints analysés**, seulement **3 endpoints** (~4%) nécessitent un masquage :

- `GET /api/v1/auth/test-config` - Debug config (non utilisé)
- `POST /api/v1/fcm-tokens/test` - Tests uniquement
- `POST /api/v1/groups/schedule-config/initialize` - Code mort (à supprimer)

### Conclusion

✅ **L'API est propre** - 95.7% des endpoints sont des endpoints métier légitimes à documenter normalement.

---

## 📖 Guide de Lecture

### Pour une Vue d'Ensemble
👉 Commencez par [OPENAPI_SUMMARY.md](./OPENAPI_SUMMARY.md)

### Pour les Détails Techniques
👉 Consultez [OPENAPI_MIGRATION_PLAN.md](./OPENAPI_MIGRATION_PLAN.md)

### Pour l'Analyse Complète
👉 Voir [OPENAPI_ENDPOINTS_ANALYSIS.md](./OPENAPI_ENDPOINTS_ANALYSIS.md)

---

## 🎯 Objectifs de la Migration

1. **Documentation automatique** - Génération OpenAPI 3.1 depuis le code
2. **Transparence totale** - Aucune modification du comportement API
3. **Interface interactive** - Swagger UI pour explorer l'API
4. **Non-régression** - Triple validation (snapshot + contract + tests existants)

---

## 📅 Prochaines Étapes

1. ⏳ Capturer le baseline de l'API actuelle
2. ⏳ Installer `swagger-autogen` + `swagger-ui-express`
3. ⏳ Configurer la génération automatique
4. ⏳ Enrichir avec les schémas Zod
5. ⏳ Tests de non-régression
6. ⏳ Déploiement

**Durée estimée :** 13-20 jours

---

## 🔗 Liens Utiles

- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
- [swagger-autogen](https://github.com/davibaltar/swagger-autogen)
- [swagger-ui-express](https://github.com/scottie1984/swagger-ui-express)

---

**Dernière mise à jour :** 2025-01-26
**Maintenu par :** Équipe Backend EduLift
