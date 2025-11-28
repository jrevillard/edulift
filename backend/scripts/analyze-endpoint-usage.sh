#!/bin/bash

# Script d'analyse d'utilisation des endpoints API
# Utilisé pour identifier les endpoints internes à masquer de la documentation OpenAPI

set -e

echo "======================================"
echo "Analyse d'utilisation des endpoints"
echo "======================================"
echo ""

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour chercher l'utilisation d'un endpoint
analyze_endpoint() {
    local endpoint=$1
    local endpoint_name=$2

    echo "----------------------------------------"
    echo -e "${YELLOW}Analyse: ${endpoint_name}${NC}"
    echo "Endpoint: ${endpoint}"
    echo ""

    # Recherche dans le frontend
    echo "📱 Frontend (src):"
    frontend_count=$(grep -r "$endpoint" ../frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "test" | grep -v ".test." | wc -l)
    if [ "$frontend_count" -gt 0 ]; then
        echo -e "${GREEN}✓ Utilisé ($frontend_count occurrences)${NC}"
        grep -r "$endpoint" ../frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "test" | grep -v ".test." | head -3
    else
        echo -e "${RED}✗ Non utilisé${NC}"
    fi
    echo ""

    # Recherche dans le backend (hors définition)
    echo "⚙️  Backend (services/controllers):"
    backend_count=$(grep -r "$endpoint" ../backend/src --include="*.ts" 2>/dev/null | grep -v "routes/" | grep -v "test" | wc -l)
    if [ "$backend_count" -gt 0 ]; then
        echo -e "${GREEN}✓ Utilisé ($backend_count occurrences)${NC}"
        grep -r "$endpoint" ../backend/src --include="*.ts" 2>/dev/null | grep -v "routes/" | grep -v "test" | head -3
    else
        echo -e "${RED}✗ Non utilisé${NC}"
    fi
    echo ""

    # Recherche dans les tests
    echo "🧪 Tests:"
    test_count=$(grep -r "$endpoint" ../backend/src ../backend/tests --include="*.test.ts" 2>/dev/null | wc -l)
    if [ "$test_count" -gt 0 ]; then
        echo -e "${YELLOW}⚠ Utilisé dans les tests ($test_count occurrences)${NC}"
    else
        echo -e "${RED}✗ Non utilisé${NC}"
    fi
    echo ""
}

# Endpoints à analyser
echo "Analyse des endpoints suspects..."
echo ""

# 1. Endpoint de test de config
analyze_endpoint "/auth/test-config" "GET /api/v1/auth/test-config"

# 2. Endpoint de test FCM
analyze_endpoint "/fcm-tokens/test" "POST /api/v1/fcm-tokens/test"

# 3. Endpoint d'initialisation
analyze_endpoint "schedule-config/initialize" "POST /api/v1/groups/schedule-config/initialize"

echo "======================================"
echo "Analyse terminée"
echo "======================================"
echo ""
echo "Recommandations:"
echo "- Masquer en production: endpoints NON utilisés hors tests"
echo "- Documenter avec tag Admin: endpoints utilisés mais sensibles"
echo "- Documenter normalement: endpoints utilisés dans le frontend"
echo ""
