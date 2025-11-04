# EduLift Deep Link Troubleshooting Guide

## Overview

This comprehensive guide helps diagnose and resolve common issues with the EduLift deep link system, covering URL generation, mobile app integration, email notifications, and configuration problems.

## Quick Diagnostic Checklist

### Step 1: Environment Verification
```bash
# Check current environment
echo "Node Environment: $NODE_ENV"
echo "Deep Link Base URL: $DEEP_LINK_BASE_URL"
echo "Frontend URL: $FRONTEND_URL"

# Verify configuration file
cat .env | grep -E "(DEEP_LINK|FRONTEND|NODE_ENV)"
```

### Step 2: URL Generation Test
```bash
# Test URL generation logic
node -e "
const { BaseEmailService } = require('./dist/services/base/BaseEmailService');
class TestService extends BaseEmailService {
  _send() { return Promise.resolve(); }
  verifyConnection() { return Promise.resolve(true); }
}
const service = new TestService();
const params = new URLSearchParams({ code: 'TEST123' });
console.log('Generated URL:', service.generateUrl('groups/join', params));
"
```

### Step 3: Security Validation
```bash
# Test URL validation
curl -I "$DEEP_LINK_BASE_URL" 2>/dev/null | head -1 || echo "URL validation failed"
```

## Common Issues and Solutions

### 1. Deep Links Not Opening on Mobile

#### Symptoms
- Tapping email links doesn't open the mobile app
- Links open in web browser instead of app
- "Cannot open URL" error on mobile devices

#### Diagnostic Steps

**A. Check URL Format**
```bash
# Verify URL format for current environment
case "$NODE_ENV" in
  "development"|"e2e")
    EXPECTED_PROTOCOL="edulift://"
    ;;
  "staging")
    EXPECTED_PROTOCOL="https://"
    ;;
  "production")
    EXPECTED_PROTOCOL="https://"
    ;;
esac

echo "Expected protocol: $EXPECTED_PROTOCOL"
echo "Current DEEP_LINK_BASE_URL: $DEEP_LINK_BASE_URL"

if [[ "$DEEP_LINK_BASE_URL" != "$EXPECTED_PROTOCOL"* ]]; then
  echo "❌ URL protocol mismatch for environment $NODE_ENV"
else
  echo "✅ URL protocol correct for environment $NODE_ENV"
fi
```

**B. Test Mobile App Association**
```bash
# Create test deep link
TEST_LINK="${DEEP_LINK_BASE_URL}groups/join?code=TEST123"
echo "Test deep link: $TEST_LINK"

# For Android (requires ADB)
if command -v adb &> /dev/null; then
  echo "Testing Android deep link..."
  adb shell am start -W -a android.intent.action.VIEW -d "$TEST_LINK"
fi

# For iOS (requires iOS Simulator or physical device)
echo "Test this link on iOS device: $TEST_LINK"
```

**C. Check Universal Links (HTTPS URLs)**
```bash
# Test Apple App Site Association
if [[ "$DEEP_LINK_BASE_URL" =~ ^https:// ]]; then
  DOMAIN=$(echo "$DEEP_LINK_BASE_URL" | sed -E 's|https://([^/]+).*|\1|')
  echo "Testing Apple App Site Association for: $DOMAIN"
  curl -s "https://$DOMAIN/.well-known/apple-app-site-association" | jq . 2>/dev/null || echo "AASA file not accessible"
fi

# Test Asset Links (Android)
if [[ "$DEEP_LINK_BASE_URL" =~ ^https:// ]]; then
  DOMAIN=$(echo "$DEEP_LINK_BASE_URL" | sed -E 's|https://([^/]+).*|\1|')
  echo "Testing Asset Links for: $DOMAIN"
  curl -s "https://$DOMAIN/.well-known/assetlinks.json" | jq . 2>/dev/null || echo "Asset links file not accessible"
fi
```

#### Solutions

**Mobile App Configuration**
```xml
<!-- Android Manifest (AndroidManifest.xml) -->
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="edulift" />
  <data android:scheme="https" />
  <data android:host="transport.tanjama.fr" />
</intent-filter>
```

```swift
// iOS (Info.plist)
<key>com.apple.developer.associated-domains</key>
<array>
  <string>applinks:transport.tanjama.fr</string>
</array>

// Deep Link Handler (AppDelegate.swift)
func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
  if url.scheme == "edulift" {
    handleDeepLink(url)
    return true
  }
  return false
}
```

**Testing Commands**
```bash
# Generate test email with deep link
npm run test:email -- --deep-link-test --email="test@example.com"

# Test deep link generation in isolation
npm run test:unit -- --testNamePattern="generateUrl.*deep link"
```

### 2. Fallback URLs Not Working

#### Symptoms
- Primary deep link fails but fallback URL doesn't work
- Broken links in email notifications
- Users see "localhost" URLs in production

#### Diagnostic Steps

**A. Check URL Fallback Chain**
```bash
#!/bin/bash
# scripts/diagnose-url-fallback.sh

echo "=== URL Fallback Chain Diagnosis ==="

# Check each URL in the fallback chain
urls=(
  "$DEEP_LINK_BASE_URL"
  "$FRONTEND_URL"
  "http://localhost:3000"
)

for i in "${!urls[@]}"; do
  url="${urls[$i]}"
  source_names=("DEEP_LINK_BASE_URL" "FRONTEND_URL" "localhost fallback")
  source="${source_names[$i]}"

  echo -n "Testing $source ($url): "

  if [[ -z "$url" ]]; then
    echo "❌ Not set"
    continue
  fi

  # Test URL accessibility
  if curl -s -I --max-time 5 "$url" >/dev/null 2>&1; then
    echo "✅ Accessible"
  else
    echo "❌ Not accessible"
  fi
done
```

**B. Verify Environment Configuration**
```bash
# Check Ansible-generated configuration
if [[ -f ".env" ]]; then
  echo "=== Generated Configuration ==="
  grep -E "(DEEP_LINK|FRONTEND)" .env | sort
else
  echo "❌ .env file not found"
fi

# Check runtime environment
echo "=== Runtime Environment ==="
printenv | grep -E "(DEEP_LINK|FRONTEND|NODE_ENV)" | sort
```

**C. Test URL Generation with All Fallbacks**
```typescript
// Test URL generation fallback logic
const testUrlGeneration = () => {
  const originalDeepLink = process.env.DEEP_LINK_BASE_URL;
  const originalFrontend = process.env.FRONTEND_URL;

  // Test scenarios
  const scenarios = [
    { deepLink: originalDeepLink, frontend: originalFrontend },
    { deepLink: 'invalid-url', frontend: originalFrontend },
    { deepLink: 'invalid-url', frontend: 'also-invalid' },
    { deepLink: '', frontend: '' }
  ];

  scenarios.forEach((scenario, index) => {
    console.log(`\n--- Scenario ${index + 1} ---`);
    process.env.DEEP_LINK_BASE_URL = scenario.deepLink;
    process.env.FRONTEND_URL = scenario.frontend;

    const url = emailService.generateUrl('test', new URLSearchParams({ a: '1' }));
    console.log(`Generated: ${url}`);
  });

  // Restore original values
  process.env.DEEP_LINK_BASE_URL = originalDeepLink;
  process.env.FRONTEND_URL = originalFrontend;
};
```

#### Solutions

**Configuration Fix**
```bash
# Ensure proper environment variable setting
export DEEP_LINK_BASE_URL="https://correct-domain.example.com/"
export FRONTEND_URL="https://correct-domain.example.com"

# Regenerate environment file
ansible-playbook -i inventory/production playbooks/configure.yml \
  --tags=environment
```

**Ansible Template Fix**
```jinja2
{# deploy/ansible/templates/env.j2 #}
{# Ensure proper URL generation with trailing slashes #}
{% if edulift_deployment.urls.deep_link_base is defined %}
  {% set deep_link_base_url = edulift_deployment.urls.deep_link_base %}
  {% if not deep_link_base_url.endswith('/') %}
    {% set deep_link_base_url = deep_link_base_url + '/' %}
  {% endif %}
{% else %}
  {% set deep_link_base_url = url.deep_link_url(deployment_environment) %}
{% endif %}
```

### 3. Security Validation Failures

#### Symptoms
- URLs rejected by security validation
- Console warnings about invalid URLs
- All links falling back to localhost

#### Diagnostic Steps

**A. Check URL Validation Rules**
```bash
#!/bin/bash
# scripts/validate-url-security.sh

URL=${1:-$DEEP_LINK_BASE_URL}

echo "=== Security Validation for: $URL ==="

# Protocol validation
if [[ "$URL" =~ ^(https?://|edulift://) ]]; then
  echo "✅ Valid protocol"
else
  echo "❌ Invalid protocol: $(echo "$URL" | sed 's|://.*||')"
  exit 1
fi

# Hostname validation
HOST=$(echo "$URL" | sed -E 's|^[a-zA-Z0-9]+://([^:/]+).*|\1|')
echo "Hostname: $HOST"

# Check for suspicious patterns
SUSPICIOUS_PATTERNS=('<script' 'javascript:' 'data:' 'vbscript:' 'file:')
for pattern in "${SUSPICIOUS_PATTERNS[@]}"; do
  if [[ "$URL" =~ $pattern ]]; then
    echo "❌ Suspicious pattern detected: $pattern"
    exit 1
  fi
done
echo "✅ No suspicious patterns"

# Production-specific checks
if [[ "$NODE_ENV" == "production" ]]; then
  # Check for private IPs
  if [[ "$HOST" =~ ^(localhost|127\.|192\.168\.|10\.|172\.) ]]; then
    echo "❌ Private IP not allowed in production: $HOST"
    exit 1
  fi
  echo "✅ Production-safe hostname"
fi

# Hostname format validation
if [[ "$HOST" =~ ^[a-zA-Z0-9.-]+$ ]]; then
  echo "✅ Valid hostname format"
else
  echo "❌ Invalid hostname format: $HOST"
  exit 1
fi

echo "✅ Security validation passed"
```

**B. Test Validation Logging**
```typescript
// Enable debug logging for URL validation
process.env.NODE_ENV = 'development';
process.env.LOG_LEVEL = 'debug';

// Test with various URLs
const testUrls = [
  'https://valid.example.com/',
  'edulift://test',
  'http://localhost:3000',
  'invalid-url',
  'javascript:alert("xss")',
  'https://192.168.1.1/'
];

testUrls.forEach(url => {
  console.log(`\nTesting: ${url}`);
  try {
    const result = emailService.generateUrl('test', undefined, url);
    console.log(`Result: ${result}`);
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
});
```

#### Solutions

**Update Security Rules**
```typescript
// backend/src/services/base/BaseEmailService.ts
private validateDeepLinkUrl(baseUrl: string): boolean {
  // Custom validation rules
  const allowedHosts = [
    'transport.tanjama.fr',
    'staging.tanjama.fr',
    'localhost',
    // Add your custom domains here
  ];

  const parsedUrl = new URL(baseUrl);
  const hostname = parsedUrl.hostname.toLowerCase();

  // Allow custom hosts
  if (allowedHosts.includes(hostname)) {
    return true;
  }

  // Existing validation logic...
}
```

**Environment-Specific Security**
```typescript
// Adjust security validation by environment
private isPrivateIpAllowed(): boolean {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return ['development', 'staging'].includes(nodeEnv);
}
```

### 4. Email Link Issues

#### Symptoms
- Links in emails are broken or malformed
- Email clients don't render links correctly
- Copy-paste links don't work

#### Diagnostic Steps

**A. Test Email Generation**
```bash
# Generate test email with current configuration
npm run test:email -- \
  --template=group-invitation \
  --to="test@example.com" \
  --data='{"groupName":"Test Group","inviteCode":"TEST123"}' \
  --output=/tmp/test-email.html

# Inspect generated email
cat /tmp/test-email.html | grep -A 5 -B 5 "href="
```

**B. Test Email Rendering**
```typescript
// Test email template rendering
const testEmailRendering = async () => {
  const testData = {
    groupName: 'Test Group',
    inviteCode: 'TEST123'
  };

  const emailService = new TestEmailService();
  const html = await emailService.generateGroupInvitationEmail(
    testData.groupName,
    'https://test.example.com/groups/join?code=TEST123'
  );

  // Validate HTML structure
  const hasValidLinks = html.includes('href="https://test.example.com');
  const hasButton = html.includes('Join Group');
  const hasFallback = html.includes('Copy and paste this link');

  console.log('Email validation:');
  console.log(`- Valid links: ${hasValidLinks ? '✅' : '❌'}`);
  console.log(`- Button present: ${hasButton ? '✅' : '❌'}`);
  console.log(`- Fallback link: ${hasFallback ? '✅' : '❌'}`);

  return html;
};
```

**C. Test Email Client Compatibility**
```bash
# Send test email to multiple clients
npm run test:email -- \
  --send-real-email \
  --to="test@example.com" \
  --subject="EduLift Link Test" \
  --template=group-invitation
```

#### Solutions

**Email Template Fix**
```html
<!-- Ensure proper link encoding -->
<a href="{{ inviteUrl }}"
   style="background: #10b981; color: white; padding: 15px 30px;
          text-decoration: none; border-radius: 6px; display: inline-block;">
  Join Group
</a>

<!-- Add copyable fallback -->
<div style="background: #f1f5f9; padding: 20px; border-radius: 6px;">
  <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">
    📱 If the button doesn't work:
  </p>
  <p style="margin: 0; font-size: 12px; word-break: break-all;">
    <strong>Copy and paste this link:</strong><br>
    <span style="background: white; padding: 8px; font-family: monospace;">
      {{ inviteUrl }}
    </span>
  </p>
</div>
```

### 5. Ansible Template Issues

#### Symptoms
- Generated configuration has incorrect URLs
- Template variables not being substituted
- Port configuration problems

#### Diagnostic Steps

**A. Check Template Rendering**
```bash
# Test template rendering without deployment
ansible-playbook -i inventory/production playbooks/debug.yml \
  --template="deploy/ansible/templates/env.j2" \
  --extra-vars="deployment_environment=production"

# Compare expected vs actual
echo "Expected DEEP_LINK_BASE_URL for production:"
echo "https://transport.tanjama.fr/"
echo ""
echo "Actual DEEP_LINK_BASE_URL:"
grep "DEEP_LINK_BASE_URL" .env
```

**B. Validate Template Syntax**
```bash
# Check Jinja2 template syntax
ansible-playbook -i inventory/production playbooks/validate.yml \
  --syntax-check

# Test macro functions
ansible-playbook -i inventory/production playbooks/debug.yml \
  --template="deploy/ansible/templates/_url_macros.j2" \
  --extra-vars="deployment_environment=staging"
```

**C. Check Variable Precedence**
```bash
# Show variable hierarchy
ansible-playbook -i inventory/production playbooks/debug.yml \
  -m debug -a "var=edulift_deployment" \
  --extra-vars="deployment_environment=production"

# Check which variables are being used
ansible-playbook -i inventory/production playbooks/debug.yml \
  -m debug -a "var=vars" | grep -E "(deep_link|frontend)"
```

#### Solutions

**Template Fix**
```jinja2
{# deploy/ansible/templates/_url_macros.j2 #}
{% macro deep_link_url(environment) -%}
{% if environment in ['development', 'e2e'] %}
edulift://
{% elif environment == 'staging' %}
{{ protocol }}://{{ base_domain }}:50443/
{% elif environment == 'production' %}
{{ protocol }}://{{ base_domain }}{% if https_port != 443 %}:{{ https_port }}{% endif %}/
{% else %}
# Default fallback for unknown environments
{{ protocol }}://{{ base_domain }}{% if https_port != 443 %}:{{ https_port }}{% endif %}/
{% endif %}
{%- endmacro %}
```

**Variable Precedence Fix**
```yaml
# inventory/group_vars/production.yml
edulift_deployment:
  # Ensure URLs are explicitly set for production
  urls:
    deep_link_base: "{{ protocol }}://{{ base_domain }}/"
    frontend: "{{ protocol }}://{{ base_domain }}"
```

## Advanced Troubleshooting

### 1. Performance Issues

**Diagnose URL Generation Performance**
```bash
# Benchmark URL generation
time npm run test:performance -- --test-name="URL Generation"

# Profile memory usage
node --prof ./dist/test/performance/url-generation.test.js
node --prof-process isolate-* > performance-analysis.txt
```

### 2. Race Conditions

**Test Concurrent URL Generation**
```typescript
// Test for race conditions in URL generation
const testConcurrentGeneration = async () => {
  const promises = Array.from({ length: 100 }, () =>
    emailService.generateUrl('test', new URLSearchParams({ id: Math.random() }))
  );

  const results = await Promise.all(promises);
  const uniqueUrls = new Set(results);

  console.log(`Generated ${results.length} URLs`);
  console.log(`Unique URLs: ${uniqueUrls.size}`);
  console.log(`Duplicates: ${results.length - uniqueUrls.size}`);
};
```

### 3. Network Issues

**Test Network Connectivity**
```bash
# Test DNS resolution
nslookup transport.tanjama.fr
dig transport.tanjama.fr

# Test SSL certificate
openssl s_client -connect transport.tanjama.fr:443 -servername transport.tanjama.fr

# Test HTTP/HTTPS connectivity
curl -I https://transport.tanjama.fr
curl -I https://transport.tanjama.fr:50443
```

## Monitoring and Alerting

### 1. URL Generation Monitoring

```typescript
// Add monitoring to BaseEmailService
protected generateUrl(path: string, params?: URLSearchParams): string {
  const startTime = Date.now();

  try {
    const url = this.originalGenerateUrl(path, params);

    // Log successful generation
    this.metrics.timing('url.generation.time', Date.now() - startTime);
    this.metrics.increment('url.generation.success');

    // Log URL source for debugging
    console.debug(`[URL] Generated: ${url} (source: ${this.urlSource})`);

    return url;
  } catch (error) {
    this.metrics.increment('url.generation.error');
    this.metrics.increment(`url.generation.error.${error.code}`);
    throw error;
  }
}
```

### 2. Alert Configuration

```yaml
# monitoring/alerts.yml
groups:
  - name: deep_link_alerts
    rules:
      - alert: DeepLinkURLGenerationFailure
        expr: rate(url_generation_error_total[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Deep link URL generation failing"
          description: "URL generation error rate is {{ $value }} per second"

      - alert: DeepLinkFallbackUsed
        expr: increase(url_generation_fallback_total[5m]) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Deep link fallback URLs being used"
          description: "Fallback URLs used {{ $value }} times in 5 minutes"
```

## Emergency Procedures

### 1. Rapid Rollback

```bash
# Rollback to previous configuration
git checkout HEAD~1 -- deploy/ansible/templates/
ansible-playbook -i inventory/production playbooks/deploy.yml --tags=configuration

# Force URL regeneration
docker-compose restart backend
```

### 2. Emergency Override

```bash
# Set emergency URLs
export DEEP_LINK_BASE_URL="https://emergency.example.com/"
export FRONTEND_URL="https://emergency.example.com"

# Update running containers
docker-compose exec backend env | grep DEEP_LINK
docker-compose restart backend
```

### 3. Service Recovery

```bash
# Check service health
curl -f https://api.edulift.example.com/health || echo "Backend unhealthy"

# Restart services if needed
ansible-playbook -i inventory/production playbooks/restart.yml
```

## Reference

### Diagnostic Scripts Location
- URL validation: `scripts/validate-url-security.sh`
- Fallback testing: `scripts/diagnose-url-fallback.sh`
- Template testing: `scripts/test-ansible-templates.sh`

### Log Locations
- Application logs: `/var/log/edulift/backend.log`
- Ansible deployment: `/var/log/ansible/deploy.log`
- Email service: `/var/log/edulift/email.log`

### Configuration Files
- Environment template: `deploy/ansible/templates/env.j2`
- URL macros: `deploy/ansible/templates/_url_macros.j2`
- Base email service: `backend/src/services/base/BaseEmailService.ts`

### Testing Commands
```bash
# Run full diagnostic suite
npm run diagnose:deep-links

# Test specific environment
npm run test:env -- environment=production

# Validate configuration
npm run validate:config
```