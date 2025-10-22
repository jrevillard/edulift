# Guide de Migration - Refresh Tokens

**Date** : 2025-10-16
**Version** : 1.0

---

## ⚠️ IMPORTANT - Migration Non-Destructive

Cette implémentation est **BACKWARD COMPATIBLE** :
- Les anciens tokens 24h continuent de fonctionner
- Les nouveaux logins génèrent des refresh tokens
- Migration progressive des utilisateurs
- **AUCUN BREAKING CHANGE**

---

## 🔄 Étapes de Migration Production

### 1. Prérequis

```bash
# Vérifier Node.js version
node --version  # >= 18.x

# Vérifier PostgreSQL accessible
psql $DATABASE_URL -c "SELECT version();"

# Vérifier backup DB récent
# IMPORTANT : Faire backup AVANT migration
```

### 2. Générer Secrets Production

```bash
# Sur le serveur de production
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Copier les secrets dans .env production
# NE JAMAIS commiter ces secrets dans Git
```

### 3. Mettre à Jour .env Production

```bash
# Ajouter dans .env production
JWT_ACCESS_SECRET=<secret-généré-étape-2>
JWT_REFRESH_SECRET=<secret-généré-différent>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY_DAYS=60
REFRESH_GRACE_PERIOD_MINUTES=5
```

### 4. Exécuter Migration Prisma

```bash
cd /workspace/backend

# Vérifier le schéma
npx prisma validate

# Dry-run pour voir les changements
npx prisma migrate deploy --help

# Exécuter la migration (crée table refresh_tokens)
npx prisma migrate deploy

# Vérifier que la table est créée
psql $DATABASE_URL -c "\d refresh_tokens"
```

**Note** : Si `migrate deploy` échoue avec erreurs sur migrations existantes, utiliser :
```bash
# Reset migrations (ATTENTION : destructif en dev, pas en prod!)
npx prisma migrate resolve --applied "20240627_remove_permanent_invite_codes"

# Puis retry
npx prisma migrate deploy
```

### 5. Build et Déploiement

```bash
# Installer dépendances
npm ci --production

# Build TypeScript
npm run build

# Vérifier que RefreshTokenService est compilé
ls dist/services/RefreshTokenService.js

# Restart application (pm2, docker, etc.)
pm2 restart edulift-backend
# OU
docker-compose restart backend
# OU
systemctl restart edulift-backend
```

### 6. Vérification Post-Déploiement

```bash
# Test endpoint health
curl https://api.edulift.com/health

# Test login avec refresh token
curl -X POST https://api.edulift.com/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "code_challenge": "<pkce-challenge>"
  }'

# Vérifier logs pour erreurs
pm2 logs edulift-backend --lines 100
```

### 7. Monitoring

```bash
# Vérifier table refresh_tokens
psql $DATABASE_URL -c "SELECT COUNT(*), COUNT(CASE WHEN is_revoked THEN 1 END) as revoked FROM refresh_tokens;"

# Surveiller logs refresh
tail -f /var/log/edulift/backend.log | grep -i refresh

# Alertes à configurer
# - Taux d'échec refresh > 5%
# - Reuse detection > 0 (tentative vol)
# - Tokens expirés non cleanup
```

---

## 🧪 Tests Post-Migration

### Test 1 : Login Standard

```bash
# 1. Demander magic link
curl -X POST http://localhost:3001/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "code_challenge": "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    "platform": "native"
  }'

# 2. Vérifier magic link (utiliser token reçu par email)
curl -X POST http://localhost:3001/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<magic-link-token>",
    "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
  }'

# ATTENDU :
# {
#   "success": true,
#   "data": {
#     "accessToken": "eyJhbGciOi...",
#     "refreshToken": "a1b2c3d4e5...",  ← NOUVEAU
#     "expiresIn": 900,                  ← NOUVEAU (15 min)
#     "tokenType": "Bearer",
#     "user": { ... }
#   }
# }
```

### Test 2 : Refresh Token Flow

```bash
# Utiliser refreshToken obtenu au Test 1
REFRESH_TOKEN="<refresh-token-from-test-1>"

curl -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"

# ATTENDU :
# {
#   "success": true,
#   "data": {
#     "accessToken": "new-access-token",
#     "refreshToken": "new-refresh-token",  ← DIFFÉRENT (rotation)
#     "expiresIn": 900,
#     "tokenType": "Bearer"
#   }
# }
```

### Test 3 : Reuse Detection

```bash
# Réutiliser l'ANCIEN refresh token du Test 2
curl -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"

# ATTENDU :
# {
#   "success": false,
#   "error": "Token reuse detected - all tokens revoked for security"
# }
```

### Test 4 : Logout + Révocation

```bash
ACCESS_TOKEN="<access-token>"

curl -X POST http://localhost:3001/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# ATTENDU :
# {
#   "success": true,
#   "data": { "message": "Logged out successfully" }
# }

# Tenter refresh après logout → DOIT ÉCHOUER
curl -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"

# ATTENDU :
# {
#   "success": false,
#   "error": "Refresh token has been revoked"
# }
```

### Test 5 : Grace Period (5 minutes)

```bash
# Générer token avec expiration courte (nécessite modification temporaire .env)
# JWT_ACCESS_EXPIRY=5s

# 1. Login pour obtenir token 5s
# 2. Attendre 6 secondes
sleep 6

# 3. Faire requête protégée → DOIT FONCTIONNER (grace period)
curl http://localhost:3001/auth/profile \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# ATTENDU : 200 OK (token expiré mais dans grace period)

# 4. Attendre 5 minutes → DOIT ÉCHOUER
sleep 300

curl http://localhost:3001/auth/profile \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# ATTENDU : 401 Unauthorized (au-delà grace period)
```

---

## 🔍 Troubleshooting

### Erreur : "Migration failed to apply"

**Cause** : Problèmes avec migrations existantes ou schéma DB corrompu

**Solution** :
```bash
# Option 1 : Marquer migrations existantes comme appliquées
npx prisma migrate resolve --applied "<migration-name>"

# Option 2 : Reset complet (DEV ONLY !)
npx prisma migrate reset

# Option 3 : Migration manuelle SQL
psql $DATABASE_URL < manual_migration.sql
```

### Erreur : "JWT_ACCESS_SECRET not set"

**Cause** : Variables d'environnement manquantes

**Solution** :
```bash
# Vérifier .env
cat .env | grep JWT

# Recharger variables d'environnement
source .env  # Linux/Mac
set -a; source .env; set +a  # Bash

# Restart app
pm2 restart edulift-backend
```

### Erreur : "Invalid refresh token"

**Causes possibles** :
1. Token déjà utilisé (rotation)
2. Token révoqué (logout)
3. Token expiré (>60 jours)
4. Format token invalide

**Debug** :
```sql
-- Vérifier token en DB
SELECT * FROM refresh_tokens
WHERE token = '<hashed-token>'
LIMIT 1;

-- Vérifier tokens de l'utilisateur
SELECT is_revoked, used_at, expires_at, created_at
FROM refresh_tokens
WHERE user_id = '<user-id>'
ORDER BY created_at DESC;
```

### Erreur : "Token reuse detected"

**Cause** : Tentative de réutilisation d'un token consommé (vol détecté)

**Action** :
1. ✅ **Normal** : C'est le comportement sécurisé attendu
2. 🚨 **Alerte** : Logger l'événement pour monitoring sécurité
3. 🔒 **Protection** : Tous les tokens de l'utilisateur sont révoqués
4. 👤 **UX** : Utilisateur forcé de se reconnecter

### Performance : Queries lentes

**Optimisation** :
```sql
-- Vérifier index
\d refresh_tokens

-- Index manquants ? Créer manuellement
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_family ON refresh_tokens(token_family);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
```

---

## 🧹 Maintenance

### Cleanup Tokens Expirés

```typescript
// Cron job quotidien (recommandé)
import { RefreshTokenService } from './services/RefreshTokenService';

const refreshTokenService = new RefreshTokenService();

// Supprimer tokens expirés depuis plus de 7 jours
const deleted = await refreshTokenService.cleanupExpiredTokens(7);
console.log(`Cleaned up ${deleted} expired tokens`);
```

### Monitoring Métriques

**Métriques à surveiller** :
- Taux de refresh réussi / échoué
- Nombre de reuse detections (vol)
- Distribution lifetime tokens actifs
- Taille table refresh_tokens

**Dashboard Grafana** :
```sql
-- Tokens actifs
SELECT COUNT(*) FROM refresh_tokens
WHERE expires_at > NOW() AND is_revoked = false;

-- Tokens révoqués aujourd'hui
SELECT COUNT(*) FROM refresh_tokens
WHERE is_revoked = true
  AND DATE(created_at) = CURRENT_DATE;

-- Détections reuse (sécurité)
SELECT COUNT(*) FROM refresh_tokens
WHERE used_at IS NOT NULL
  AND DATE(used_at) = CURRENT_DATE;
```

---

## 📋 Checklist Déploiement

### Pre-Deployment
- [ ] Backup base de données
- [ ] Secrets JWT production générés
- [ ] .env production configuré
- [ ] Tests passent en local
- [ ] Build réussit : `npm run build`

### Deployment
- [ ] Migration Prisma exécutée
- [ ] Table refresh_tokens créée
- [ ] Application redémarrée
- [ ] Logs vérifiés (no errors)

### Post-Deployment
- [ ] Test login avec refresh token
- [ ] Test refresh flow
- [ ] Test logout + révocation
- [ ] Monitoring configuré
- [ ] Alertes configurées
- [ ] Documentation équipe mise à jour

---

## 🆘 Rollback Plan

Si problèmes critiques, rollback possible :

### Option 1 : Rollback Code Uniquement

```bash
# Revenir au commit précédent
git revert HEAD
npm run build
pm2 restart edulift-backend

# Les anciens tokens 24h continuent de fonctionner
# Table refresh_tokens reste en DB (pas utilisée)
```

### Option 2 : Rollback Complet

```bash
# Restaurer backup DB
pg_restore -d edulift_prod backup.sql

# Revenir code
git revert HEAD
npm ci --production
npm run build
pm2 restart edulift-backend
```

**Note** : Rollback code SANS rollback DB est SAFE (backward compatible)

---

**Contact Support** : dev-team@edulift.com
**Documentation** : https://docs.edulift.com/refresh-tokens
