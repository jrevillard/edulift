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

### Quick Start for Live Debugging

To capture console errors from the live production site:

```bash
# Navigate to E2E directory
cd /workspace/e2e

# Run the debug script (opens browser in headed mode)
node debug-simple.cjs
```

**What this does:**
1. Opens a visible Chromium browser
2. Navigates to `https://transport.tanjama.fr:50443/`
3. Captures ALL console errors and page errors for 5 minutes
4. Generates a detailed report with error locations and timestamps
5. Takes a final screenshot

### How to Use

1. **Run the script**: `node debug-simple.cjs`
2. **Login manually** using magic link (check your email)
3. **Navigate to pages** where errors occur
4. **Trigger the errors** (VEHICLE_DELETED, family refresh, etc.)
5. **Wait 5 minutes** for automatic report generation

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

