# EduLift - AI Agent Instructions

This file provides specific instructions for AI coding agents working on the EduLift project, a collaborative school transportation management application.

## 🏗️ Project Structure

EduLift is a monorepo containing two main components:

- `frontend/` - Web frontend application (React/TypeScript/Vite)
- `backend/` - Backend services (Node.js/Express/TypeScript)

## 🎯 Project Overview

EduLift simplifies and centralizes the organization of home-to-school trips for groups of parents with a dual-system architecture:

- **Family System**: Manages resource ownership (children, vehicles) within family units
- **Group System**: Coordinates scheduling and trip planning across multiple families

## 🛠️ Development Environment

- Use the appropriate component-specific AGENTS.md files for detailed instructions
- Always run tests before submitting changes
- Follow the existing code style and architecture patterns
- Respect the monorepo structure and dependencies between components

Always use context7 when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.

## 📁 Component-Specific Instructions

Each component has its own AGENTS.md file with detailed instructions:

- [Frontend AGENTS.md](./frontend/AGENTS.md)
- [Backend AGENTS.md](./backend/AGENTS.md)

## 🔄 Common Workflows

1. **Development Setup**:
   - Each component has its own setup process
   - Check component-specific AGENTS.md for details

2. **Testing**:
   - Unit tests: `npm test` or `flutter test`
   - Integration tests: Component-specific commands
   - E2E tests: Component-specific commands

3. **Building**:
   - Each component has its own build process
   - Check component-specific AGENTS.md for commands

## ⚠️ Important Notes

- **ALL documentation MUST be in English only** - No French content in documentation files,, code etc...
- Do not modify files outside your assigned component without coordination
- Always check for cross-component dependencies before making changes
- Refer to the documentation in `/docs/` for functional and technical specifications
- Preserve existing functionality when refactoring or adding features

## 🎭 Playwright E2E Testing - X11 Configuration

For Playwright to work in headed mode (visible browser for debugging), X11 forwarding must be enabled on the host.

### ⚠️ IMPORTANT: User Action Required

The AI assistant **CANNOT** run this command - it must be executed by the user on their host machine.

**Before running Playwright in headed mode**, execute this command in your terminal **on the host** (outside the container):

```bash
xhost +local:docker
```

This allows Docker containers to connect to the host's X server. The permission persists until the host reboot.

### Why the AI Cannot Do This

- The `xhost` command must run on the **host machine**, not inside the devcontainer
- The AI assistant only has access to the **container environment**
- This is a security feature - X11 authorization requires explicit user consent

### Using Playwright Headed Mode

Once X11 access is enabled (by you, on the host):

```bash
cd e2e
npx playwright test --headed
```

### If "Missing X server" Error

If you see "Missing X server or $DISPLAY" after a host reboot:

**Solution:** Re-run `xhost +local:docker` on the host (you must do this).

### DevContainer Configuration

The devcontainer is configured with:
- X11 socket mount: `/tmp/.X11-unix`
- `DISPLAY` environment variable passed from host
- `xauth` package installed (for compatibility)

See `e2e/PLAYWRIGHT_HEADED.md` for details.

## 🐛 Debugging Production Errors with Playwright

### ⚠️ CRITICAL: Capture to File First, Then Analyze

**NEVER try to analyze errors in real-time from the console.** Always capture everything to a file FIRST, then analyze AFTER the session is complete.

### Why This Matters

1. **Errors may not appear immediately** - Some errors only occur after specific user actions or state changes
2. **Console output is limited** - You lose context when errors scroll off screen
3. **Complete object inspection** - File capture preserves full error objects and stack traces
4. **Reproducible analysis** - You can share the exact error data with others or analyze it multiple times

### Step-by-Step Debugging Workflow

#### Step 1: Create Debug Script

Create `/workspace/e2e/debug-production.cjs`:

```javascript
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();

  // Storage for ALL errors
  const capture = {
    timestamp: new Date().toISOString(),
    consoleErrors: [],
    pageErrors: [],
    apiResponses: []
  };

  // Capture console errors WITH object details
  page.on('console', async msg => {
    if (msg.type() === 'error') {
      const errorData = {
        text: msg.text(),
        location: msg.location(),
        timestamp: new Date().toISOString(),
        args: []
      };

      // Try to capture object arguments
      try {
        const args = msg.args();
        for (const arg of args) {
          const json = await arg.jsonValue();
          errorData.args.push(json);
        }
      } catch {
        // Ignore serialization errors
      }

      capture.consoleErrors.push(errorData);
      console.log('❌ CAPTURED:', msg.text());
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    capture.pageErrors.push({
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  });

  // Capture API responses (to see what data backend returns)
  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      try {
        const body = await response.json();
        capture.apiResponses.push({
          url: response.url(),
          status: response.status(),
          body: body,
          timestamp: new Date().toISOString()
        });
      } catch {
        // Ignore non-JSON responses
      }
    }
  });

  // Navigate to production site
  await page.goto('https://transport.tanjama.fr:50443/');

  console.log('🔐 BROWSER OPEN - Login and trigger errors');
  console.log('⏳ Capturing to file for 5 minutes...');
  console.log('⏳ All errors saved to: /workspace/e2e/captured-errors.json');

  // Wait for manual interaction
  await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));

  // SAVE TO FILE - This is the critical step
  fs.writeFileSync('captured-errors.json', JSON.stringify(capture, null, 2));

  console.log('✅ Capture complete! Analyzing...');

  await browser.close();
})();
```

#### Step 2: Run Capture Session

```bash
cd /workspace/e2e
node debug-production.cjs
```

**While script runs:**
1. Login with magic link
2. Navigate to pages where errors occur
3. Trigger the errors (delete vehicle, refresh family, etc.)
4. Wait 5 minutes for automatic completion

**⚠️ DO NOT stop the script early** - Let it complete to save the file!

#### Step 3: Analyze Captured Data

```bash
# View the captured data
cat captured-errors.json

# Or format it for better readability
jq . captured-errors.json

# Check specific error types
jq '.consoleErrors[] | .text' captured-errors.json

# See API responses structure
jq '.apiResponses[] | select(.url | contains("family"))' captured-errors.json
```

#### Step 4: Identify Root Cause

Look for patterns in the captured data:

```bash
# Find TypeError: X.map is not a function
jq '.consoleErrors[] | select(.text | contains("map is not a function"))' captured-errors.json

# Check what family API returns
jq '.apiResponses[] | select(.url | contains("family")) | .body.data' captured-errors.json

# Verify types of properties
jq '.apiResponses[] | select(.url | contains("family")) | .body.data | {
  members: (.members | type),
  vehicles: (.vehicles | type),
  children: (.children | type)
}' captured-errors.json
```

### Common Error Patterns

**TypeError: X.map is not a function**
- **Cause**: Property is undefined instead of array
- **Solution**: Add optional chaining: `family.members?.map()`
- **Location**: Usually in React components rendering family data

**TypeError: Failed to fetch**
- **Cause**: Network error or API not responding
- **Action**: Check backend is running and CORS is configured

### Custom Debug Script

Create a custom debug script in `/workspace/e2e/`:

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,  // Set to true for invisible mode
    args: ['--disable-web-security']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true  // For self-signed certificates
  });

  const page = await context.newPage();

  // Capture console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({
        text: msg.text(),
        location: msg.location(),
        timestamp: new Date().toISOString()
      });
      console.log('❌ ERROR:', msg.text());
    }
  });

  // Capture page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push({
      message: error.message,
      stack: error.stack
    });
    console.log('💥 PAGE ERROR:', error.message);
  });

  // Navigate and wait
  await page.goto('https://transport.tanjama.fr:50443/');

  // Wait for manual interaction
  await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));

  // Generate report
  console.log('Total errors:', consoleErrors.length);

  await browser.close();
})();
```

### playwright-cli Tool

For interactive browser control:

```bash
# Open browser session
playwright-cli -s=debug-session open https://transport.tanjama.fr:50443/ -- --headed

# Take snapshots
playwright-cli -s=debug-session snapshot

# Check console
playwright-cli -s=debug-session console

# Close session
playwright-cli -s=debug-session close
```

### Error Capture Locations

Errors are captured and reported with:
- **Error message**: Full console error text
- **File location**: URL and line number
- **Timestamp**: When the error occurred
- **Stack trace**: For unhandled errors

Common error locations to check:
- `/workspace/e2e/capture-erreurs.txt` - Live error log
- `debug-final-screenshot.png` - Final state screenshot
- Console output during execution

### Troubleshooting

**Browser not visible:**
- Ensure X11 is enabled: Run `xhost +local:docker` on host
- Check `DISPLAY` environment variable is set
- Verify browser is not blocked by window manager

**No errors captured:**
- Verify you're using the browser opened by the script (not your regular browser)
- Check browser console manually (F12) to confirm errors exist
- Ensure script is still running (check with `ps aux | grep debug-simple`)

**Script terminated early:**
- Check for errors in script output
- Verify Playwright is installed: `npx playwright install chromium`
- Ensure sufficient permissions for temporary files

