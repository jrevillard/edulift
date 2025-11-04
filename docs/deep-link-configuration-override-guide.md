# EduLift Deep Link Configuration Override Guide

## Overview

This guide explains how to manually override the default deep link configuration in EduLift for custom deployments, testing scenarios, or special requirements.

## Override Methods

### 1. Ansible Inventory Override (Production)

**Use Case**: Production deployments requiring custom URLs

**File**: `inventory/group_vars/all.yml` or environment-specific files

#### Basic Override

```yaml
edulift_deployment:
  urls:
    deep_link_base: "https://custom.edulift.example.com/"
    frontend: "https://custom.edulift.example.com"
    backend: "https://api.custom.edulift.example.com"
    traefik_dashboard: "https://traefik.custom.edulift.example.com"
```

#### Environment-Specific Override

**File**: `inventory/group_vars/staging.yml`

```yaml
edulift_deployment:
  urls:
    deep_link_base: "https://staging.edulift.example.com:50443/"
    frontend: "https://staging.edulift.example.com:50443"
  domain: "staging.edulift.example.com"
  protocol: "https"
```

**File**: `inventory/group_vars/production.yml`

```yaml
edulift_deployment:
  urls:
    deep_link_base: "https://app.edulift.example.com/"
    frontend: "https://app.edulift.example.com"
    backend: "https://api.edulift.example.com"
  domain: "edulift.example.com"
  protocol: "https"
```

#### Advanced Override with Multiple Domains

```yaml
edulift_deployment:
  domain: "primary.edulift.example.com"
  protocol: "https"
  urls:
    deep_link_base: "https://app.edulift.example.com/"
    frontend: "https://www.edulift.example.com"
    backend: "https://api.edulift.example.com"
    traefik_dashboard: "https://admin.edulift.example.com/traefik"
  cors_origins:
    - "https://www.edulift.example.com"
    - "https://app.edulift.example.com"
    - "https://admin.edulift.example.com"
```

### 2. Environment Variable Override (Development/Testing)

**Use Case**: Local development, testing, or temporary overrides

**File**: `.env.local` or `.env.override`

```bash
# Override deep link URL for local testing
DEEP_LINK_BASE_URL=https://dev.local.example.com/
FRONTEND_URL=https://dev.local.example.com
NODE_ENV=development

# Override for testing with mobile app
DEEP_LINK_BASE_URL=myapp://
FRONTEND_URL=http://localhost:3000

# Override for specific testing scenario
DEEP_LINK_BASE_URL=https://test-scenario.example.com/
FRONTEND_URL=https://test-scenario.example.com
```

### 3. Runtime Override (Docker/Container)

**Use Case**: Container-based deployments with dynamic configuration

**Docker Compose Override**:

```yaml
version: '3.8'
services:
  backend:
    environment:
      - DEEP_LINK_BASE_URL=https://container.edulift.example.com/
      - FRONTEND_URL=https://container.edulift.example.com
      - NODE_ENV=production
    env_file:
      - .env.override
```

**Kubernetes ConfigMap**:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: edulift-config
data:
  DEEP_LINK_BASE_URL: "https://k8s.edulift.example.com/"
  FRONTEND_URL: "https://k8s.edulift.example.com"
  NODE_ENV: "production"
```

## Override Scenarios

### Scenario 1: Multi-Tenant Deployment

**Requirement**: Different deep link URLs per tenant

**Configuration**:

```yaml
# inventory/group_vars/tenant-a.yml
edulift_deployment:
  urls:
    deep_link_base: "https://tenant-a.edulift.example.com/"
    frontend: "https://tenant-a.edulift.example.com"

# inventory/group_vars/tenant-b.yml
edulift_deployment:
  urls:
    deep_link_base: "https://tenant-b.edulift.example.com/"
    frontend: "https://tenant-b.edulift.example.com"
```

**Deployment**:

```bash
# Deploy Tenant A
ansible-playbook -i inventory/tenant-a playbooks/deploy.yml

# Deploy Tenant B
ansible-playbook -i inventory/tenant-b playbooks/deploy.yml
```

### Scenario 2: Blue-Green Deployment

**Requirement**: Different URLs for blue and green deployments

**Configuration**:

```yaml
# inventory/group_vars/blue.yml
edulift_deployment:
  urls:
    deep_link_base: "https://blue.edulift.example.com/"
    frontend: "https://blue.edulift.example.com"
  deployment_color: "blue"

# inventory/group_vars/green.yml
edulift_deployment:
  urls:
    deep_link_base: "https://green.edulift.example.com/"
    frontend: "https://green.edulift.example.com"
  deployment_color: "green"
```

### Scenario 3: Mobile App Testing

**Requirement**: Test with custom mobile app protocol

**Configuration**:

```bash
# .env.mobile-testing
DEEP_LINK_BASE_URL=myeduliftapp://
FRONTEND_URL=http://localhost:3000
NODE_ENV=development

# Enable debug logging
LOG_LEVEL=debug
```

**Testing Script**:

```bash
#!/bin/bash
# test-mobile-deep-links.sh

export DEEP_LINK_BASE_URL=myeduliftapp://
export FRONTEND_URL=http://localhost:3000
export NODE_ENV=development

# Test group invitation
curl -X POST http://localhost:3001/api/invitations/group \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "groupName": "Test Group"}'

# Test family invitation
curl -X POST http://localhost:3001/api/invitations/family \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "familyName": "Test Family"}'
```

### Scenario 4: Custom Domain Migration

**Requirement**: Migrate from old domain to new domain

**Configuration**:

```yaml
# Phase 1: Both domains active
edulift_deployment:
  urls:
    deep_link_base: "https://new-edulift.example.com/"
    frontend: "https://new-edulift.example.com"
  cors_origins:
    - "https://old-edulift.example.com"
    - "https://new-edulift.example.com"

# Phase 2: New domain only
edulift_deployment:
  urls:
    deep_link_base: "https://edulift.example.com/"
    frontend: "https://edulift.example.com"
  cors_origins:
    - "https://edulift.example.com"
```

### Scenario 5: Development with External Services

**Requirement**: Local development with external API endpoints

**Configuration**:

```bash
# .env.external-services
NODE_ENV=development
DEEP_LINK_BASE_URL=edulift://
FRONTEND_URL=http://localhost:3000

# External service URLs
DATABASE_URL=postgresql://user:pass@external.db.example.com:5432/edulift
REDIS_URL=redis://:password@external.redis.example.com:6379
EMAIL_HOST=smtp.external.example.com
```

## Validation and Testing

### Override Validation

**Ansible Validation Task**:

```yaml
# tasks/validate-overrides.yml
- name: Validate custom URLs
  uri:
    url: "{{ edulift_deployment.urls.deep_link_base }}"
    method: HEAD
    timeout: 10
  register: url_validation
  failed_when: url_validation.status not in [200, 404, 405]
  when: edulift_deployment.urls is defined

- name: Test URL generation
  command: "{{ project_dir }}/scripts/test-url-generation.sh"
  environment:
    DEEP_LINK_BASE_URL: "{{ edulift_deployment.urls.deep_link_base }}"
    FRONTEND_URL: "{{ edulift_deployment.urls.frontend }}"
  register: url_generation_test
```

**Validation Script**:

```bash
#!/bin/bash
# scripts/validate-overrides.sh

set -e

echo "Validating deep link configuration..."

# Check required environment variables
required_vars=("DEEP_LINK_BASE_URL" "FRONTEND_URL")
for var in "${required_vars[@]}"; do
  if [[ -z "${!var}" ]]; then
    echo "ERROR: $var is not set"
    exit 1
  fi
done

# Validate URL formats
if [[ ! "$DEEP_LINK_BASE_URL" =~ ^https?:// ]] && [[ ! "$DEEP_LINK_BASE_URL" =~ ^[a-zA-Z0-9]+:// ]]; then
  echo "ERROR: Invalid DEEP_LINK_BASE_URL format: $DEEP_LINK_BASE_URL"
  exit 1
fi

if [[ ! "$FRONTEND_URL" =~ ^https?:// ]]; then
  echo "ERROR: Invalid FRONTEND_URL format: $FRONTEND_URL"
  exit 1
fi

echo "✅ Configuration validation passed"
```

### Testing Override Configuration

**Unit Tests**:

```typescript
// tests/deep-link-overrides.test.ts
describe('Deep Link Override Configuration', () => {
  test('uses custom DEEP_LINK_BASE_URL when provided', () => {
    process.env.DEEP_LINK_BASE_URL = 'https://custom.example.com/';
    const url = emailService.generateUrl('groups/join', params);
    expect(url).toBe('https://custom.example.com/groups/join?code=ABC123');
  });

  test('falls back to FRONTEND_URL when DEEP_LINK_BASE_URL is invalid', () => {
    process.env.DEEP_LINK_BASE_URL = 'invalid-url';
    process.env.FRONTEND_URL = 'https://fallback.example.com';
    const url = emailService.generateUrl('groups/join', params);
    expect(url).toBe('https://fallback.example.com/groups/join?code=ABC123');
  });
});
```

**Integration Tests**:

```bash
#!/bin/bash
# scripts/test-override-integration.sh

set -e

ENVIRONMENT=${1:-staging}

echo "Testing override configuration for $ENVIRONMENT..."

# Set test environment
export NODE_ENV=$ENVIRONMENT
export DEEP_LINK_BASE_URL="https://test-$ENVIRONMENT.example.com/"
export FRONTEND_URL="https://test-$ENVIRONMENT.example.com"

# Test URL generation
npm run test:unit -- --testNamePattern="generateUrl"

# Test email sending with custom URLs
npm run test:integration -- --testNamePattern="Email.*deep link"

echo "✅ Integration tests passed for $ENVIRONMENT"
```

## Troubleshooting Override Issues

### Common Override Problems

#### 1. Override Not Applied

**Symptoms**:
- Default URLs still being used despite override configuration
- Ansible template not using custom values

**Solutions**:
1. Check Ansible variable precedence
2. Verify inventory file syntax
3. Ensure correct variable paths

**Debug Commands**:
```bash
# Debug Ansible variables
ansible-playbook -i inventory/production playbooks/debug.yml \
  --extra-vars="deployment_environment=production" \
  -m debug -a "var=edulift_deployment"

# Show rendered template
ansible-playbook -i inventory/production playbooks/debug.yml \
  --template="deploy/ansible/templates/env.j2"
```

#### 2. URL Validation Failures

**Symptoms**:
- Custom URLs rejected by security validation
- Console warnings about invalid URLs

**Solutions**:
1. Verify URL format and protocol
2. Check for suspicious patterns
3. Update validation rules if needed

**Debug Script**:
```bash
#!/bin/bash
# scripts/debug-url-validation.sh

URL=${1:-$DEEP_LINK_BASE_URL}

echo "Debugging URL validation for: $URL"

# Check URL format
if [[ "$URL" =~ ^https?:// ]]; then
  echo "✅ Valid protocol (HTTP/HTTPS)"
elif [[ "$URL" =~ ^[a-zA-Z0-9]+:// ]]; then
  echo "✅ Valid custom protocol"
else
  echo "❌ Invalid protocol"
  exit 1
fi

# Extract hostname
HOST=$(echo "$URL" | sed -E 's|^[a-zA-Z0-9]+://([^:/]+).*|\1|')
echo "Hostname: $HOST"

# Check for private IPs (in production)
if [[ "$NODE_ENV" == "production" ]]; then
  if [[ "$HOST" =~ ^(localhost|127\.|192\.168\.|10\.|172\.) ]]; then
    echo "❌ Private IP not allowed in production"
    exit 1
  else
    echo "✅ Valid hostname for production"
  fi
fi
```

#### 3. Environment Variable Conflicts

**Symptoms**:
- Different URL values in different parts of the system
- Inconsistent behavior between services

**Solutions**:
1. Check environment variable precedence
2. Verify Docker/Kubernetes configuration
3. Ensure consistent variable naming

**Debug Commands**:
```bash
# Show all environment variables
env | grep -E "(DEEP_LINK|FRONTEND|NODE_ENV)"

# Check container environment
docker exec edulift-backend env | grep -E "(DEEP_LINK|FRONTEND)"

# Check Kubernetes ConfigMap
kubectl get configmap edulift-config -o yaml
```

## Best Practices for Overrides

### 1. Use Environment-Specific Files

```
inventory/
├── group_vars/
│   ├── all.yml              # Common configuration
│   ├── development.yml      # Development overrides
│   ├── staging.yml         # Staging overrides
│   ├── production.yml      # Production overrides
│   └── tenant-a.yml        # Tenant-specific overrides
```

### 2. Document Override Reasons

```yaml
# inventory/group_vars/production.yml
edulift_deployment:
  urls:
    # Custom domain for production deployment
    # Reason: SSL certificate configured for edulift.example.com
    deep_link_base: "https://edulift.example.com/"
    frontend: "https://edulift.example.com"
```

### 3. Validate Before Deployment

```yaml
# playbooks/deploy.yml
- hosts: all
  pre_tasks:
    - name: Validate override configuration
      include_tasks: tasks/validate-overrides.yml
      tags: [validation]

  roles:
    - edulift

  post_tasks:
    - name: Test deep link functionality
      include_tasks: tasks/test-deep-links.yml
      tags: [testing]
```

### 4. Use Version Control for Configuration

```bash
# Track configuration changes
git add inventory/group_vars/
git commit -m "Configure custom URLs for production deployment"

# Tag deployment versions
git tag -a "v2.1.0-production" -m "Production deployment with custom URLs"
```

### 5. Monitor Override Impact

```yaml
# Configuration monitoring
monitoring:
  alerts:
    - name: "Deep Link URL Generation"
      condition: "url_generation_errors > 0"
      action: "notify_dev_team"

    - name: "Override Configuration Changes"
      condition: "config_override_changed"
      action: "review_and_approve"
```

## Reference

### Override Priority

1. **Environment Variables** (highest priority)
2. **Ansible Inventory Variables**
3. **Ansible Group Variables**
4. **Template Defaults** (lowest priority)

### Variable Paths

| Configuration | Ansible Path | Environment Variable |
|---------------|--------------|---------------------|
| Deep Link Base | `edulift_deployment.urls.deep_link_base` | `DEEP_LINK_BASE_URL` |
| Frontend URL | `edulift_deployment.urls.frontend` | `FRONTEND_URL` |
| Backend URL | `edulift_deployment.urls.backend` | `BACKEND_URL` |
| CORS Origins | `edulift_deployment.cors_origins` | `CORS_ORIGIN` |

### File Locations

- **Ansible Templates**: `deploy/ansible/templates/`
- **Inventory Variables**: `inventory/group_vars/`
- **Environment Files**: `.env*`
- **Validation Scripts**: `scripts/`
- **Tests**: `tests/`