# 🧪 EduLift E2E Testing Suite

## 🚀 Quick Start

### ⚡ Quick Start (2 steps)
```bash
# 1. Run all E2E tests
npm run e2e:test

# 2. Run tests without cleanup of Docker containers
npm run e2e:test:no-cleanup
```

### 📋 Prerequisites
- **Docker and Docker Compose** installed and running
- **Node.js 18+**
- **npm** or yarn
- **Available ports**: 8002, 8001, 5435, 6382

### 🔧 Detailed Installation and Configuration

#### Step 1: Navigate and Install
```bash
# Navigate to E2E directory
cd e2e/

# Install E2E dependencies and Playwright browsers
npm run e2e:install
```

#### Step 2: Start Docker Environment
```bash
# Start isolated test environment (Docker)
npm run e2e:setup
```
**What this command does:**
- 🐳 Starts PostgreSQL test (port 5435)
- 🐳 Starts Redis test (port 6382)
- 🐳 Starts Backend test (port 8002)
- 🐳 Starts Frontend test (port 8001)
- 📊 Initializes database with test data

#### Step 3: Run Tests
```bash
# Run all E2E tests
npm run e2e:test

# OR with visual interface
npm run e2e:test:headed

# OR in debug mode
npm run e2e:test:debug
```

#### Step 4: View Results
```bash
# Open HTML test report
npm run e2e:report
```

#### Step 5: Cleanup
```bash
# Stop and cleanup Docker environment
npm run e2e:teardown
```

## 🏗️ Architecture Overview

### Isolated Test Environment
E2E tests run in complete isolation from development:

```
Development Environment      E2E Test Environment
Backend: localhost:3000  →   Backend: localhost:8002
Frontend: localhost:5173 →   Frontend: localhost:8001
Database: localhost:5432 →   Database: localhost:5435
Redis: localhost:6379    →   Redis: localhost:6382
```

**✅ Benefits:**
- No impact on your development environment
- Reproducible and reliable tests
- Isolated test data
- No port conflicts

### Directory Structure
```
e2e/
├── package.json              # E2E dependencies & scripts
├── playwright.config.ts      # Playwright configuration
├── docker-compose.yml        # Isolated test environment
├── tests/
│   ├── auth/                 # Authentication tests
│   ├── family/               # Family onboarding tests
│   ├── group/                # Group coordination tests
│   ├── schedule/             # Real-time assignment tests
│   ├── fixtures/             # Test data & helpers
│   │   ├── file-specific-test-data.ts  # Data isolation fixture
│   │   ├── universal-auth-helper.ts    # Authentication helper
│   │   └── e2e-email-helper.ts         # Email testing helper
│   ├── global-setup.ts       # Environment setup
│   └── global-teardown.ts    # Environment cleanup
└── README.md                 # This file
```

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

## 🛠️ Running Tests

### Local Development
```bash
# Navigate to e2e directory first
cd e2e/

# Run specific test file
npx playwright test auth/login-flow.spec.ts

# Run with browser UI visible
npm run e2e:test:headed

# Debug mode (step through tests)
npm run e2e:test:debug

# Run on specific browser
npx playwright test --project=firefox

# Run mobile tests only
npx playwright test --project="Mobile Chrome"
```

### Available Scripts
```bash
npm run e2e:install         # Install dependencies & browsers
npm run e2e:setup           # Start test environment
npm run e2e:test            # Run all E2E tests
npm run e2e:test:no-cleanup # Run tests without cleanup (for report inspection)
npm run e2e:test:headed     # Run with visible browser
npm run e2e:test:debug      # Debug mode
npm run e2e:test:ui         # Interactive UI mode
npm run e2e:report          # View HTML report
npm run e2e:teardown        # Cleanup environment
npm run e2e:clean           # Clean Docker resources

# Unit tests (from e2e directory)
npm run test:unit:backend    # Backend unit tests
npm run test:unit:frontend   # Frontend unit tests
npm run test:all            # All tests (unit + E2E)
```

### Main Commands Reference

| Command | Description | Usage |
|---------|-------------|-------|
| `npm run e2e:install` | Install Playwright and browsers | ⚡ Once only |
| `npm run e2e:setup` | Start Docker environment | 🚀 Before each session |
| `npm run e2e:test` | Run all tests | 🧪 Main execution |
| `npm run e2e:test:headed` | Tests with visual interface | 👀 To watch tests |
| `npm run e2e:test:debug` | Interactive debug mode | 🐛 For debugging |
| `npm run e2e:report` | Open HTML report | 📊 View results |
| `npm run e2e:teardown` | Clean environment | 🧹 After each session |

## 📊 Test Results & Reporting

### HTML Reports
After running tests, view detailed results:
```bash
npm run e2e:report
# Opens http://localhost:9323

# Or run tests without cleanup to keep containers running for report inspection:
npm run e2e:test:no-cleanup
# Report served at http://localhost:9323 (fixed port)
```

### Artifacts Generated
- **Screenshots**: On test failures
- **Videos**: For failing tests
- **Traces**: Detailed execution logs
- **Coverage**: Frontend code coverage

## 🚨 Common Issues & Solutions

### 🐳 Docker Issues

#### ❌ Docker Services Won't Start
```bash
# Check service status
docker compose ps

# View detailed logs
docker compose logs backend-e2e
docker compose logs frontend-e2e
docker compose logs postgres-e2e

# Complete restart
npm run e2e:teardown
npm run e2e:setup
```

#### ❌ Port Conflicts
```bash
# Check which ports are in use
lsof -i :8002  # Backend E2E
lsof -i :8001  # Frontend E2E
lsof -i :5435  # Database E2E
lsof -i :6382  # Redis E2E

# Stop conflicting services
docker stop $(docker ps -q)
npm run e2e:setup
```

#### ❌ Database Issues
```bash
# Complete database reset
docker compose down -v  # Remove volumes
npm run e2e:setup       # Recreate everything

# View database logs
docker compose logs postgres-e2e
```

### 🧪 Test Issues

#### Tests Timing Out
```bash
# Increase timeout in tests
test('slow operation', async ({ page }) => {
  test.setTimeout(120000); // 2 minutes
});

# Or globally in playwright.config.ts
timeout: 120000  # 2 minutes
```

### 🛠️ Diagnostic Commands

#### Quick Checks
```bash
# Status of all containers
docker ps

# Docker disk usage
docker system df

# Clean Docker resources
docker system prune -f
docker volume prune -f
```

#### Complete Reset
```bash
# Complete reset script
cd e2e/
npm run e2e:teardown
docker system prune -f
docker volume prune -f
npm run e2e:setup
npm run e2e:test
```

### 📋 Diagnostic Checklist

**Before reporting a bug, check:**

- [ ] Docker is running: `docker --version`
- [ ] Ports are free: `lsof -i :8002,:8001,:5435,:6382`
- [ ] Sufficient disk space: `df -h`
- [ ] No other instances: `docker ps`
- [ ] Environment variables: `env | grep NODE_ENV`

### Debug Mode
```typescript
// Pause test execution
await page.pause();

// Take screenshot
await page.screenshot({ path: 'debug.png' });

// Debug mode
PWDEBUG=1 npm run e2e:test

// Step through with browser dev tools
npx playwright test auth/login-flow.spec.ts --debug
```

## 🎯 Best Practices

### Test Structure
1. Use `test.describe.configure({ mode: 'serial' })` within files
2. Create file-specific test data with unique prefixes
3. Pre-create only users who need to exist before tests
4. Let invitation flows create recipient users dynamically

### Data Management
1. **Never use hardcoded emails** like `admin@test.com`
2. **Never clear all emails** (breaks parallel tests)
3. **Use FileSpecificTestData** for all user/family data
4. **Mark invitation recipients** with `willReceiveInvitation: true`
5. **Use predefined user objects** from `testData.getUser()`

### Authentication
1. Use `directUserSetup` for users with existing families/groups
2. Use `authenticateUniqueUser` for new user journeys
3. Use `acceptInvitation` for invitation recipients
4. Never use hardcoded global test users

### Test IDs
1. Always follow `[ComponentName]-[ElementType]-[descriptiveName]` pattern
2. Be component-scoped and specific
3. Avoid regex selectors in tests
4. Update all related tests when changing IDs

## 📚 Resources

### Documentation
- [Playwright Documentation](https://playwright.dev/docs)
- [Docker Compose Reference](https://docs.docker.com/compose/)

### Support
- Check existing test patterns in `./tests/`
- Review fixture helpers in `./tests/fixtures/`

## 📝 Key Principles

- ✅ Use proper test ID naming: `[ComponentName]-[ElementType]-[descriptiveName]`
- ✅ Real user flows only (no mocks, API calls, or fake data)
- ✅ Stable selectors with `data-testid` attributes
- ❌ Do not use regex based selectors like `data-testid*=xxxx`!
- ❌ Do not use multiple selectors
- ✅ Meaningful test failures, not silent passes
- ✅ File-specific test data for complete isolation
- ✅ Serial execution within files, parallel execution between files

---

**🎯 The E2E testing suite ensures EduLift delivers reliable, high-quality user experiences across all platforms and scenarios.**
