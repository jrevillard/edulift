# EduLift Deep Link Development Guide

## Overview

This comprehensive guide helps developers work with the EduLift deep link system, including local development setup, testing procedures, debugging techniques, and extension patterns.

## Local Development Setup

### Prerequisites

```bash
# Required tools
node --version  # >= 18.x
npm --version   # >= 9.x
docker --version
docker-compose --version

# Optional for mobile testing
adb --version        # Android Studio
xcrun simctl version # Xcode (macOS)
```

### Environment Configuration

**1. Clone and Setup**
```bash
git clone https://github.com/your-org/edulift.git
cd edulift

# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
```

**2. Configure Development Environment**
```bash
# backend/.env.development
NODE_ENV=development
DEEP_LINK_BASE_URL=edulift://
FRONTEND_URL=http://localhost:3000
PORT=3001
DATABASE_URL=postgresql://dev:dev@localhost:5432/edulift_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-jwt-secret
LOG_LEVEL=debug
```

**3. Database Setup**
```bash
# Start services
docker-compose -f docker-compose.dev.yml up -d postgres redis

# Run migrations
cd backend
npm run db:migrate

# Seed development data
npm run db:seed
```

**4. Start Development Servers**
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Email Testing (optional)
npm run test:email -- --watch
```

## Development Workflow

### 1. Feature Development

**Create Feature Branch**
```bash
git checkout -b feature/deep-link-enhancement
```

**Make Changes**
```typescript
// backend/src/services/base/BaseEmailService.ts
protected generateUrl(path: string, params?: URLSearchParams): string {
  // Your enhancement here
  const candidateUrls = [
    process.env.DEEP_LINK_BASE_URL,
    process.env.FRONTEND_URL,
    'http://localhost:3000'
  ];

  // Enhanced logic
  for (const [index, candidateUrl] of candidateUrls.entries()) {
    if (this.validateDeepLinkUrl(candidateUrl)) {
      const urlSource = this.getUrlSourceLabel(index);
      console.debug(`[URL] Using ${urlSource}: ${candidateUrl}`);
      return this.buildUrl(candidateUrl, path, params);
    }
  }

  // Enhanced fallback
  return this.buildEmergencyUrl(path, params);
}
```

**Add Tests**
```typescript
// backend/src/services/__tests__/BaseEmailService.enhancement.test.ts
describe('Enhanced URL Generation', () => {
  test('handles custom URL schemes', () => {
    process.env.DEEP_LINK_BASE_URL = 'customapp://';
    const url = emailService.generateUrl('test', new URLSearchParams({ a: '1' }));
    expect(url).toBe('customapp://test?a=1');
  });

  test('provides detailed URL source logging', () => {
    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
    process.env.DEEP_LINK_BASE_URL = 'https://test.example.com/';

    emailService.generateUrl('test');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[URL] Using DEEP_LINK_BASE_URL')
    );
    consoleSpy.mockRestore();
  });
});
```

### 2. Testing Strategy

**Unit Tests**
```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- BaseEmailService.test.ts

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

**Integration Tests**
```bash
# Run all integration tests
npm run test:integration

# Run specific integration test
npm run test:integration -- --testNamePattern="Deep Link"

# Run tests against test database
NODE_ENV=test npm run test:integration
```

**End-to-End Tests**
```bash
# Start full environment
npm run start:e2e

# Run E2E tests
npm run test:e2e

# Run specific E2E scenario
npm run test:e2e -- --spec="deep-link-invitation.spec.ts"
```

### 3. Code Quality

**Linting**
```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Check TypeScript types
npm run type-check
```

**Code Formatting**
```bash
# Format code
npm run format

# Check formatting
npm run format:check
```

## Deep Link Development Patterns

### 1. Adding New Deep Link Types

**Step 1: Define Path Constants**
```typescript
// backend/src/constants/paths.ts
export const DEEP_LINK_PATHS = {
  GROUP_JOIN: 'groups/join',
  FAMILY_JOIN: 'families/join',
  DRIVER_ASSIGN: 'drivers/assign',
  SCHEDULE_VIEW: 'schedule/view',
  PROFILE_EDIT: 'profile/edit',
  NOTIFICATION_SETTINGS: 'settings/notifications',
  // Add new path
  VEHICLE_MANAGE: 'vehicles/manage'
} as const;
```

**Step 2: Create URL Generation Helper**
```typescript
// backend/src/utils/deepLinkHelpers.ts
import { DEEP_LINK_PATHS } from '../constants/paths';
import { BaseEmailService } from '../services/base/BaseEmailService';

export class DeepLinkGenerator extends BaseEmailService {
  generateGroupJoinLink(inviteCode: string): string {
    const params = new URLSearchParams({ code: inviteCode });
    return this.generateUrl(DEEP_LINK_PATHS.GROUP_JOIN, params);
  }

  generateFamilyJoinLink(inviteCode: string): string {
    const params = new URLSearchParams({ code: inviteCode });
    return this.generateUrl(DEEP_LINK_PATHS.FAMILY_JOIN, params);
  }

  generateVehicleManageLink(vehicleId: string, action?: string): string {
    const params = new URLSearchParams({ id: vehicleId });
    if (action) params.set('action', action);
    return this.generateUrl(DEEP_LINK_PATHS.VEHICLE_MANAGE, params);
  }

  protected _send(): Promise<void> {
    // Implementation not needed for URL generation
    return Promise.resolve();
  }

  verifyConnection(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
```

**Step 3: Update Service Layer**
```typescript
// backend/src/services/VehicleService.ts
import { DeepLinkGenerator } from '../utils/deepLinkHelpers';

export class VehicleService {
  private deepLinkGenerator = new DeepLinkGenerator();

  async sendVehicleAssignmentNotification(email: string, vehicleId: string): Promise<void> {
    const manageLink = this.deepLinkGenerator.generateVehicleManageLink(vehicleId, 'assign');

    await this.emailService.sendVehicleAssignment({
      to: email,
      manageLink,
      vehicleName: 'Citroën Berlingo'
    });
  }
}
```

### 2. Adding New Template Types

**Step 1: Create Template Method**
```typescript
// backend/src/services/base/BaseEmailService.ts
export abstract class BaseEmailService implements EmailServiceInterface {
  // Existing methods...

  async sendVehicleAssignment(data: VehicleAssignmentData): Promise<void> {
    const params = new URLSearchParams({ id: data.vehicleId });
    if (data.action) params.set('action', data.action);
    const manageUrl = this.generateUrl('vehicles/manage', params);

    const subject = `EduLift - Vehicle Assignment (${data.vehicleName})`;
    const html = await this.generateVehicleAssignmentEmail(data, manageUrl);
    await this._send(data.to, subject, html);
  }

  private async generateVehicleAssignmentEmail(
    data: VehicleAssignmentData,
    manageUrl: string
  ): Promise<string> {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>EduLift - Vehicle Assignment</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${await this.generateEmailHeader()}
        <p>Hello,</p>
        <p>You have been assigned to manage the vehicle <strong>${data.vehicleName}</strong>.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${manageUrl}"
             style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px;">
            Manage Vehicle
          </a>
        </div>

        <div style="background: #f1f5f9; padding: 20px; border-radius: 6px;">
          <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">
            📱 If the button doesn't work:
          </p>
          <p style="margin: 0; font-size: 12px; word-break: break-all;">
            <strong>Copy and paste this link:</strong><br>
            <span style="background: white; padding: 8px; font-family: monospace;">
              ${manageUrl}
            </span>
          </p>
        </div>

        ${await this.generateEmailFooter()}
      </body>
      </html>
    `;
  }
}
```

**Step 2: Add TypeScript Interfaces**
```typescript
// backend/src/types/EmailServiceInterface.ts
export interface VehicleAssignmentData {
  to: string;
  vehicleId: string;
  vehicleName: string;
  action?: 'assign' | 'remove' | 'update';
  assigneeName?: string;
}

// Extend the main interface
export interface EmailServiceInterface {
  // Existing methods...
  sendVehicleAssignment(data: VehicleAssignmentData): Promise<void>;
}
```

### 3. Custom URL Validation

**Extend Validation Logic**
```typescript
// backend/src/services/base/BaseEmailService.ts
private validateDeepLinkUrl(baseUrl: string): boolean {
  // Existing validation...

  // Add custom validation for specific environments
  if (process.env.NODE_ENV === 'development') {
    return this.validateDevelopmentUrl(baseUrl);
  }

  if (process.env.NODE_ENV === 'production') {
    return this.validateProductionUrl(baseUrl);
  }

  return this.validateStandardUrl(baseUrl);
}

private validateDevelopmentUrl(baseUrl: string): boolean {
  // Allow custom schemes in development
  const allowedSchemes = ['http:', 'https:', 'edulift:', 'myapp:', 'devapp:'];
  const url = new URL(baseUrl);

  if (!allowedSchemes.includes(url.protocol)) {
    this.logInvalidUrl(`Disallowed development protocol: ${url.protocol}`, baseUrl);
    return false;
  }

  // Allow localhost and private IPs in development
  return true;
}

private validateProductionUrl(baseUrl: string): boolean {
  // Strict production validation
  const allowedSchemes = ['https:', 'edulift://'];
  const url = new URL(baseUrl);

  if (!allowedSchemes.includes(url.protocol)) {
    this.logInvalidUrl(`Disallowed production protocol: ${url.protocol}`, baseUrl);
    return false;
  }

  // Block private IPs in production
  const hostname = url.hostname.toLowerCase();
  if (this.isPrivateIp(hostname)) {
    this.logInvalidUrl('Private IP not allowed in production', baseUrl);
    return false;
  }

  // Additional production-specific checks
  return this.validateProductionHostname(hostname);
}
```

## Debugging Deep Links

### 1. Local Debugging Tools

**URL Generation Debugger**
```typescript
// scripts/debug-url-generation.ts
import { DeepLinkGenerator } from '../src/utils/deepLinkHelpers';

async function debugUrlGeneration() {
  const generator = new DeepLinkGenerator();

  const scenarios = [
    { path: 'groups/join', params: { code: 'TEST123' } },
    { path: 'families/join', params: { code: 'FAM456' } },
    { path: 'schedule/view', params: { id: 'SCHED789' } },
    { path: 'profile/edit', params: { section: 'notifications' } }
  ];

  console.log('=== Deep Link Generation Debug ===');
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`DEEP_LINK_BASE_URL: ${process.env.DEEP_LINK_BASE_URL}`);
  console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL}`);
  console.log('');

  for (const scenario of scenarios) {
    const params = new URLSearchParams(scenario.params);
    const url = generator.generateUrl(scenario.path, params);

    console.log(`Path: ${scenario.path}`);
    console.log(`Params: ${scenario.params}`);
    console.log(`Generated URL: ${url}`);
    console.log('---');
  }
}

if (require.main === module) {
  debugUrlGeneration().catch(console.error);
}
```

**Email Template Debugger**
```typescript
// scripts/debug-email-templates.ts
import { TestEmailService } from '../src/services/__tests__/TestEmailService';

async function debugEmailTemplates() {
  const emailService = new TestEmailService();

  const testCases = [
    {
      type: 'groupInvitation',
      data: {
        groupName: 'Test Group',
        inviteCode: 'TEST123',
        to: 'test@example.com'
      }
    },
    {
      type: 'familyInvitation',
      data: {
        familyName: 'Test Family',
        inviteCode: 'FAM456',
        personalMessage: 'Welcome!',
        to: 'family@example.com'
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n=== Debugging ${testCase.type} ===`);

    let html: string;
    switch (testCase.type) {
      case 'groupInvitation':
        html = await emailService.generateGroupInvitationEmail(
          testCase.data.groupName,
          'https://test.example.com/groups/join?code=TEST123'
        );
        break;
      case 'familyInvitation':
        html = await emailService.generateFamilyInvitationEmail(
          testCase.data.familyName,
          'https://test.example.com/families/join?code=FAM456',
          testCase.data.personalMessage
        );
        break;
    }

    // Extract URLs from HTML
    const urlRegex = /href="([^"]+)"/g;
    const urls = [];
    let match;
    while ((match = urlRegex.exec(html)) !== null) {
      urls.push(match[1]);
    }

    console.log('Generated URLs:');
    urls.forEach(url => console.log(`  - ${url}`));

    // Save HTML for inspection
    const fs = await import('fs');
    await fs.promises.writeFile(
      `./debug-${testCase.type}.html`,
      html
    );
    console.log(`HTML saved to debug-${testCase.type}.html`);
  }
}

if (require.main === module) {
  debugEmailTemplates().catch(console.error);
}
```

### 2. Mobile Testing

**Android Testing Setup**
```bash
# Install Android Studio and setup emulator
# Enable USB debugging on physical device

# Test deep link with ADB
adb shell am start -W -a android.intent.action.VIEW \
  -d "edulift://groups/join?code=TEST123"

# Test with Chrome custom tabs
adb shell am start -a android.intent.action.VIEW \
  -d "https://transport.tanjama.fr/groups/join?code=TEST123"

# Monitor logs
adb logcat | grep -E "(edulift|DeepLink|ActivityManager)"
```

**iOS Testing Setup**
```bash
# Install Xcode and simulator
# Configure associated domains in Xcode project

# Test deep link with simulator
xcrun simctl openurl booted "edulift://groups/join?code=TEST123"

# Test with Safari
xcrun simctl openurl booted "https://transport.tanjama.fr/groups/join?code=TEST123"

# Monitor simulator logs
xcrun simctl spawn booted log stream --predicate 'process == "EduLift"'
```

### 3. Network Debugging

**URL Accessibility Testing**
```bash
#!/bin/bash
# scripts/test-url-accessibility.sh

URLS=(
  "$DEEP_LINK_BASE_URL"
  "$FRONTEND_URL"
  "https://transport.tanjama.fr/"
  "https://transport.tanjama.fr:50443/"
)

echo "=== URL Accessibility Test ==="

for url in "${URLS[@]}"; do
  if [[ -z "$url" ]]; then
    echo "❌ Empty URL"
    continue
  fi

  echo -n "Testing $url: "

  # Test with curl
  if curl -s -I --max-time 5 "$url" >/dev/null 2>&1; then
    echo "✅ Accessible"

    # Get additional info
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    echo "  HTTP Status: $http_code"

    # Test SSL if HTTPS
    if [[ "$url" =~ ^https:// ]]; then
      domain=$(echo "$url" | sed -E 's|https://([^/]+).*|\1|')
      echo "  SSL Cert: $(openssl s_client -connect "$domain:443" -servername "$domain" </dev/null 2>/dev/null | grep -E "(subject|issuer)" | head -2 | sed 's/.*= //' | tr '\n' ' ')"
    fi
  else
    echo "❌ Not accessible"
  fi

  echo ""
done
```

## Performance Optimization

### 1. URL Generation Caching

```typescript
// backend/src/utils/urlCache.ts
export class UrlCache {
  private cache = new Map<string, string>();
  private readonly maxSize = 1000;
  private readonly ttl = 5 * 60 * 1000; // 5 minutes

  set(key: string, value: string): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  clear(): void {
    this.cache.clear();
  }
}

// Integrate with BaseEmailService
protected generateUrl(path: string, params?: URLSearchParams): string {
  const cacheKey = `${path}:${params?.toString() || ''}`;

  // Check cache first
  const cached = this.urlCache.get(cacheKey);
  if (cached) {
    console.debug(`[URL] Cache hit: ${cached}`);
    return cached;
  }

  // Generate URL
  const url = this.originalGenerateUrl(path, params);

  // Cache result
  this.urlCache.set(cacheKey, url);

  return url;
}
```

### 2. Template Optimization

```typescript
// backend/src/services/base/OptimizedEmailService.ts
export abstract class OptimizedEmailService extends BaseEmailService {
  private templateCache = new Map<string, string>();

  protected async generateEmailHeader(): Promise<string> {
    const cacheKey = 'email-header';

    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    const header = await this.generateEmailHeaderInternal();
    this.templateCache.set(cacheKey, header);

    return header;
  }

  protected async generateEmailFooter(): Promise<string> {
    const cacheKey = 'email-footer';

    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    const footer = await this.generateEmailFooterInternal();
    this.templateCache.set(cacheKey, footer);

    return footer;
  }
}
```

## Testing Mobile Integration

### 1. Android Integration Test

```kotlin
// android/app/src/test/java/DeepLinkTest.kt
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.rule.ActivityTestRule
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DeepLinkTest {

    @get:Rule
    val activityRule = ActivityTestRule(MainActivity::class.java)

    @Test
    fun testGroupInvitationDeepLink() {
        val deepLink = "edulift://groups/join?code=TEST123"

        // Create intent with deep link
        val intent = Intent().apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse(deepLink)
        }

        // Start activity with intent
        activityRule.activity.startActivity(intent)

        // Verify navigation to group join screen
        onView(withId(R.id.group_join_fragment))
            .check(matches(isDisplayed()))

        onView(withId(R.id.invite_code_input))
            .check(matches(withText("TEST123")))
    }

    @Test
    fun testFamilyInvitationDeepLink() {
        val deepLink = "edulift://families/join?code=FAM456"

        val intent = Intent().apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse(deepLink)
        }

        activityRule.activity.startActivity(intent)

        onView(withId(R.id.family_join_fragment))
            .check(matches(isDisplayed()))

        onView(withId(R.id.invite_code_input))
            .check(matches(withText("FAM456")))
    }
}
```

### 2. iOS Integration Test

```swift
// ios/EduLiftTests/DeepLinkTests.swift
import XCTest
@testable import EduLift

class DeepLinkTests: XCTestCase {

    var app: XCUIApplication!

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    func testGroupInvitationDeepLink() {
        let deepLinkURL = URL(string: "edulift://groups/join?code=TEST123")!

        // Open deep link
        app.open(deepLinkURL)

        // Wait for group join screen
        let groupJoinScreen = app.otherElements["GroupJoinScreen"]
        XCTAssertTrue(groupJoinScreen.waitForExistence(timeout: 5))

        // Verify invite code is populated
        let inviteCodeField = app.textFields["inviteCodeField"]
        XCTAssertEqual(inviteCodeField.value as? String, "TEST123")
    }

    func testFamilyInvitationDeepLink() {
        let deepLinkURL = URL(string: "edulift://families/join?code=FAM456")!

        app.open(deepLinkURL)

        let familyJoinScreen = app.otherElements["FamilyJoinScreen"]
        XCTAssertTrue(familyJoinScreen.waitForExistence(timeout: 5))

        let inviteCodeField = app.textFields["inviteCodeField"]
        XCTAssertEqual(inviteCodeField.value as? String, "FAM456")
    }
}
```

## Common Development Tasks

### 1. Adding New Environment

**Step 1: Update URL Macro**
```jinja2
{# deploy/ansible/templates/_url_macros.j2 #}
{% macro deep_link_url(environment) -%}
{% if environment in ['development', 'e2e'] %}
edulift://
{% elif environment == 'staging' %}
{{ protocol }}://{{ base_domain }}:50443/
{% elif environment == 'production' %}
{{ protocol }}://{{ base_domain }}{% if https_port != 443 %}:{{ https_port }}{% endif %}/
{% elif environment == 'qa' %}
{# New QA environment #}
{{ protocol }}://qa.{{ base_domain }}/
{% endif %}
{%- endmacro %}
```

**Step 2: Add Environment Configuration**
```yaml
# inventory/group_vars/qa.yml
edulift_deployment:
  environment: qa
  domain: qa.edulift.example.com
  protocol: https
```

**Step 3: Update Validation Logic**
```typescript
// backend/src/services/base/BaseEmailService.ts
private validateDeepLinkUrl(baseUrl: string): boolean {
  // Existing validation...

  // Add QA environment logic
  if (process.env.NODE_ENV === 'qa') {
    return this.validateQaUrl(baseUrl);
  }

  return this.validateStandardUrl(baseUrl);
}

private validateQaUrl(baseUrl: string): boolean {
  const allowedHosts = ['qa.edulift.example.com', 'localhost'];
  const url = new URL(baseUrl);

  return allowedHosts.includes(url.hostname);
}
```

### 2. Custom URL Schemes

**Define Custom Scheme**
```typescript
// backend/src/types/UrlSchemes.ts
export const URL_SCHEMES = {
  EDULIFT: 'edulift',
  CUSTOM_APP: 'myapp',
  DEV_APP: 'devapp'
} as const;

export type UrlScheme = typeof URL_SCHEMES[keyof typeof URL_SCHEMES];
```

**Add Scheme Validation**
```typescript
private validateCustomScheme(baseUrl: string): boolean {
  const url = new URL(baseUrl);
  const customSchemes = Object.values(URL_SCHEMES);

  if (!customSchemes.some(scheme => baseUrl.startsWith(`${scheme}://`))) {
    this.logInvalidUrl(`Unsupported custom scheme`, baseUrl);
    return false;
  }

  // Validate path for custom schemes
  if (url.pathname && !this.isValidCustomPath(url.pathname)) {
    this.logInvalidUrl(`Invalid custom path`, baseUrl);
    return false;
  }

  return true;
}
```

### 3. Monitoring and Analytics

**URL Generation Metrics**
```typescript
// backend/src/metrics/UrlMetrics.ts
export class UrlMetrics {
  private metrics = new Map<string, {
    count: number;
    averageTime: number;
    errors: number;
  }>();

  recordUrlGeneration(path: string, timeMs: number, success: boolean): void {
    const current = this.metrics.get(path) || { count: 0, averageTime: 0, errors: 0 };

    current.count++;
    current.averageTime = (current.averageTime * (current.count - 1) + timeMs) / current.count;

    if (!success) {
      current.errors++;
    }

    this.metrics.set(path, current);
  }

  getMetrics(): Record<string, any> {
    return Object.fromEntries(this.metrics);
  }

  reset(): void {
    this.metrics.clear();
  }
}
```

**Integration with BaseEmailService**
```typescript
// In BaseEmailService
private metrics = new UrlMetrics();

protected generateUrl(path: string, params?: URLSearchParams): string {
  const startTime = Date.now();

  try {
    const url = this.originalGenerateUrl(path, params);
    const timeMs = Date.now() - startTime;

    this.metrics.recordUrlGeneration(path, timeMs, true);

    return url;
  } catch (error) {
    const timeMs = Date.now() - startTime;
    this.metrics.recordUrlGeneration(path, timeMs, false);

    throw error;
  }
}
```

## Development Best Practices

### 1. Code Organization

```
backend/src/
├── services/
│   ├── base/
│   │   ├── BaseEmailService.ts      # Core URL generation logic
│   │   └── __tests__/
│   │       ├── BaseEmailService.test.ts
│   │       └── BaseEmailService.integration.test.ts
│   ├── AuthService.ts
│   ├── NotificationService.ts
│   └── __tests__/
├── utils/
│   ├── deepLinkHelpers.ts           # URL generation helpers
│   ├── urlCache.ts                  # Caching utilities
│   ├── urlValidation.ts             # Validation logic
│   └── __tests__/
├── constants/
│   ├── paths.ts                     # Deep link path constants
│   └── urlSchemes.ts               # Custom URL schemes
├── types/
│   └── EmailServiceInterface.ts     # TypeScript interfaces
└── metrics/
    └── UrlMetrics.ts               # Monitoring utilities
```

### 2. Testing Strategy

**Unit Tests**: Test individual URL generation scenarios
**Integration Tests**: Test email sending with real URLs
**E2E Tests**: Test complete user flows with mobile apps
**Performance Tests**: Test URL generation under load

### 3. Error Handling

```typescript
// Always provide meaningful error messages
protected generateUrl(path: string, params?: URLSearchParams): string {
  try {
    return this.generateUrlInternal(path, params);
  } catch (error) {
    // Log detailed error information
    console.error(`[URL] Failed to generate URL for path: ${path}`, {
      error: error.message,
      stack: error.stack,
      environment: process.env.NODE_ENV,
      deepLinkBaseUrl: process.env.DEEP_LINK_BASE_URL,
      frontendUrl: process.env.FRONTEND_URL
    });

    // Provide fallback
    return this.generateEmergencyFallback(path, params);
  }
}
```

### 4. Environment Safety

```typescript
// Never use production URLs in development
protected validateEnvironment(): void {
  const nodeEnv = process.env.NODE_ENV;
  const deepLinkUrl = process.env.DEEP_LINK_BASE_URL;

  if (nodeEnv === 'development' && deepLinkUrl?.includes('edulift.fr')) {
    throw new Error('Production URL detected in development environment');
  }
}
```

This comprehensive development guide provides everything developers need to work effectively with the EduLift deep link system, from initial setup to advanced customization and testing.