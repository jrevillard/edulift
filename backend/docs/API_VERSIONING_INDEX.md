# Documentation Multi-Version d'API - Index

## Vue d'Ensemble

Cette documentation explique comment implémenter une stratégie multi-version d'API (v1 et v2 en parallèle) avec Hono dans le projet EduLift.

---

## Guides par Niveau

### 👔 Pour les Décideurs (5 min)

**[API_VERSIONING_EXECUTIVE_SUMMARY.md](./API_VERSIONING_EXECUTIVE_SUMMARY.md)**

- Résumé en 3 points
- Architecture en 1 schéma
- Estimation de l'effort (1-2 jours)
- Plan de migration (12 mois)
- Avantages/inconvénients

**À lire si** : Vous voulez comprendre la stratégie sans rentrer dans les détails techniques.

---

### 🚀 Pour les Développeurs (15 min)

**[API_VERSIONING_QUICK_START.md](./API_VERSIONING_QUICK_START.md)**

- Guide de démarrage rapide
- Commandes copier-coller
- Exemples de code concrets
- Checklist de migration
- Commandes utiles

**À lire si** : Vous voulez commencer à implémenter v1/v2 immédiatement.

---

### 📚 Pour les Architectes (45 min)

**[API_VERSIONING_STRATEGY.md](./API_VERSIONING_STRATEGY.md)**

- Architecture actuelle d'EduLift
- Pattern recommandé avec explications détaillées
- Structure de dossiers proposée
- Implémentation pratique étape par étape
- Partage de code entre versions
- Stratégie de migration progressive
- Impact sur les tests
- Impact sur OpenAPI
- Exemples concrets pour chaque scénario

**À lire si** : Vous voulez comprendre tous les aspects de l'implémentation.

---

### 🏗️ Pour la Vision d'Ensemble (30 min)

**[API_VERSIONING_ARCHITECTURE.md](./API_VERSIONING_ARCHITECTURE.md)**

- Diagrammes C4 (Contexte, Conteneurs)
- Diagrammes de séquence (v1 vs v2)
- Structure de dossiers détaillée
- Flux de requête complet
- Stratégie de migration progressive
- Partage de code : Services
- Tests par couche
- OpenAPI documentation structure
- Monitoring et métriques

**À lire si** : Vous voulez visualiser l'architecture avec des diagrammes.

---

### 🔬 Pour Comparer les Patterns (20 min)

**[API_VERSIONING_PATTERNS.md](./API_VERSIONING_PATTERNS.md)**

- Comparaison de 4 patterns différents
- Tableau comparatif détaillé
- Avantages/inconvénients de chaque pattern
- Pourquoi Pattern 1 est recommandé pour EduLift
- Autres patterns non recommandés

**À lire si** : Vous voulez comprendre pourquoi ce pattern a été choisi.

---

## Résumé des Documents

| Document | Public | Durée | Niveau | Contenu |
|----------|--------|-------|--------|---------|
| Executive Summary | Décideurs | 5 min | ⭐ | Résumé, estimation, plan |
| Quick Start | Développeurs | 15 min | ⭐⭐ | Commandes, exemples, checklist |
| Strategy | Architectes | 45 min | ⭐⭐⭐ | Implémentation complète |
| Architecture | Tous | 30 min | ⭐⭐⭐ | Diagrammes, structure |
| Patterns | Architectes | 20 min | ⭐⭐⭐ | Comparaison patterns |

---

## Parcourir par Sujet

### 1. Comprendre l'Architecture Actuelle

- **[Executive Summary](./API_VERSIONING_EXECUTIVE_SUMMARY.md)** - Section "L'Architecture en 1 Schéma"
- **[Strategy](./API_VERSIONING_STRATEGY.md)** - Section "Architecture Actuelle"
- **[Architecture](./API_VERSIONING_ARCHITECTURE.md)** - Diagrammes C4

### 2. Choisir le Pattern

- **[Executive Summary](./API_VERSIONING_EXECUTIVE_SUMMARY.md)** - Section "L'Architecture en 1 Schéma"
- **[Patterns](./API_VERSIONING_PATTERNS.md)** - Comparaison complète des 4 patterns
- **[Strategy](./API_VERSIONING_STRATEGY.md)** - Section "Pattern Recommandé"

### 3. Implémenter v1/v2

- **[Quick Start](./API_VERSIONING_QUICK_START.md)** - Guide étape par étape
- **[Strategy](./API_VERSIONING_STRATEGY.md)** - Sections "Implémentation Pratique" et "Exemples Concrets"

### 4. Migrer Progressivement

- **[Executive Summary](./API_VERSIONING_EXECUTIVE_SUMMARY.md)** - Plan de migration
- **[Strategy](./API_VERSIONING_STRATEGY.md)** - Section "Stratégie de Migration"
- **[Architecture](./API_VERSIONING_ARCHITECTURE.md)** - Section "Stratégie de Migration Progressive"

### 5. Tester les Deux Versions

- **[Quick Start](./API_VERSIONING_QUICK_START.md)** - Section "Étape 4 : Ajouter les tests pour v2"
- **[Strategy](./API_VERSIONING_STRATEGY.md)** - Section "Impact sur les Tests"
- **[Architecture](./API_VERSIONING_ARCHITECTURE.md)** - Section "Tests par Couche"

### 6. Documenter avec OpenAPI

- **[Quick Start](./API_VERSIONING_QUICK_START.md)** - Section "Étape 3 : Monter v1 et v2 dans server.ts"
- **[Strategy](./API_VERSIONING_STRATEGY.md)** - Section "Impact sur OpenAPI"
- **[Architecture](./API_VERSIONING_ARCHITECTURE.md)** - Section "OpenAPI Documentation Structure"

---

## Questions Fréquentes

### Q : Combien de temps pour implémenter v1/v2 ?

**R** : 1-2 jours pour l'implémentation initiale (restructuration + 1-2 endpoints v2).

Voir [Executive Summary](./API_VERSIONING_EXECUTIVE_SUMMARY.md) - Section "Estimation de l'Effort".

### Q : Est-ce que je dois dupliquer ma logique métier ?

**R** : Non. Les Services sont partagés entre v1 et v2. Seuls les contrôleurs sont séparés.

Voir [Strategy](./API_VERSIONING_STRATEGY.md) - Section "Partage de Code entre Versions".

### Q : Comment éviter la duplication de code ?

**R** : Les Services et Repositories sont utilisés par v1 ET v2. Seule la couche HTTP (Controllers) change.

Voir [Patterns](./API_VERSIONING_PATTERNS.md) - Section "Pourquoi Pattern 1 est le Meilleur Choix".

### Q : Comment gérer la déprécation de v1 ?

**R** : Ajouter des headers de déprécation aux réponses v1, communiquer activement la migration, puis supprimer v1 après 12 mois.

Voir [Architecture](./API_VERSIONING_ARCHITECTURE.md) - Section "Stratégie de Migration Progressive".

### Q : Est-ce que mes tests v1 existants vont casser ?

**R** : Non. Les tests v1 continuent de fonctionner. Vous ajoutez de nouveaux tests v2.

Voir [Strategy](./API_VERSIONING_STRATEGY.md) - Section "Impact sur les Tests".

### Q : Comment documenter v1 et v2 avec OpenAPI ?

**R** : Deux documentations séparées : `/docs/v1` et `/docs/v2` avec des specs `/openapi/v1.json` et `/openapi/v2.json`.

Voir [Quick Start](./API_VERSIONING_QUICK_START.md) - Section "Étape 3".

---

## Parcours Recommandé

### Pour un Nouveau Projet

1. Lire [Executive Summary](./API_VERSIONING_EXECUTIVE_SUMMARY.md) (5 min)
2. Lire [Patterns](./API_VERSIONING_PATTERNS.md) (20 min)
3. Suivre [Quick Start](./API_VERSIONING_QUICK_START.md) (15 min)

### Pour EduLift (Projet Existant)

1. Lire [Executive Summary](./API_VERSIONING_EXECUTIVE_SUMMARY.md) (5 min)
2. Lire [Architecture](./API_VERSIONING_ARCHITECTURE.md) (30 min)
3. Suivre [Quick Start](./API_VERSIONING_QUICK_START.md) (15 min)
4. Consulter [Strategy](./API_VERSIONING_STRATEGY.md) au besoin (45 min)

---

## Commandes Rapides

### Démarrer l'Implémentation

```bash
# 1. Créer les dossiers v1/
mkdir -p backend/src/controllers/v1
mkdir -p backend/src/routes/v1
mkdir -p backend/src/schemas/v1

# 2. Déplacer les fichiers existants
git mv backend/src/controllers/AuthController.ts backend/src/controllers/v1/
git mv backend/src/routes/auth.ts backend/src/routes/v1/
git mv backend/src/schemas/auth.ts backend/src/schemas/v1/

# 3. Voir le guide complet
cat backend/docs/API_VERSIONING_QUICK_START.md
```

### Tester les APIs

```bash
# Tester v1
curl -X POST http://localhost:3000/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"abc","code_verifier":"xyz"}'

# Tester v2
curl -X POST http://localhost:3000/api/v2/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"abc","code_verifier":"xyz","deviceId":"device-123"}'

# Voir les documentations
open http://localhost:3000/docs/v1
open http://localhost:3000/docs/v2
```

---

## Ressources Externes

- [Hono Documentation](https://hono.dev/)
- [Hono OpenAPI Plugin](https://hono.dev/docs/plugins/zod-openapi)
- [OpenAPI Specification](https://swagger.io/specification/)
- [API Versioning Best Practices](https://github.com/Microsoft/api-guidelines/blob/master/Guidelines.md#12-versioning)

---

## Contribution

Cette documentation a été créée pour le projet EduLift. Pour des questions ou suggestions :

1. Vérifier d'abord si la réponse est dans l'un des documents
2. Consulter les exemples de code dans [Quick Start](./API_VERSIONING_QUICK_START.md)
3. Référer aux diagrammes dans [Architecture](./API_VERSIONING_ARCHITECTURE.md)

---

## Résumé en 3 Points

1. **Architecture Actuelle PARFAITE** : Controllers ↔ Services ↔ Repositories = Idéal pour v1/v2
2. **Pattern Recommandé** : Contrôleurs séparés + Services partagés = Zéro duplication
3. **Implémentation** : 1-2 jours de travail, puis itération endpoint par endpoint

**Pour commencer** : Lire [Quick Start](./API_VERSIONING_QUICK_START.md) et exécuter les commandes copier-coller.

---

**Version** : 1.0.0
**Dernière mise à jour** : 2025-01-04
**Auteur** : Claude (System Architecture Designer)
**Projet** : EduLift Backend
