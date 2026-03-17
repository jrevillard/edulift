# Docker Build Guide with Shared Types

## Architecture

EduLift uses a **monorepo with shared types** architecture:
```
/workspace/
├── backend/          # Backend Node.js service
├── frontend/         # Frontend React application
├── shared-types/     # Generated TypeScript types (shared)
└── e2e/             # E2E testing environment
```

## Important: Build Order ⚠️

The shared types must be **generated BEFORE** building Docker images!

### Complete Build Process

```bash
# 1. Generate shared types (DO THIS FIRST)
cd backend
npm run asyncapi:build

# 2. Verify types were generated
ls -la ../shared-types/asyncapi/
# Should show 72+ TypeScript files

# 3. Build Docker images
cd ..
docker-compose -f docker-compose.dev.yml build
# OR for E2E:
docker-compose -f e2e/docker-compose.yml build
```

### Why This Order?

1. **Backend generates types** → `npm run asyncapi:generate-types`
2. Types are written to `../shared-types/asyncapi/`
3. **Dockerfiles copy** `shared-types/` into images
4. Both containers use the same types → type safety! ✅

## Docker Build Contexts

### Backend
```yaml
# docker-compose.dev.yml
backend:
  build:
    context: ./backend        # Build context = /workspace/backend
    dockerfile: Dockerfile.dev
```

In `backend/Dockerfile.dev`:
```dockerfile
COPY ../shared-types/ ../shared-types/  # Copies from /workspace/shared-types/
```

### Frontend
```yaml
# e2e/docker-compose.yml
frontend-e2e:
  build:
    context: ./frontend       # Build context = /workspace/frontend
    dockerfile: Dockerfile.dev
```

In `frontend/Dockerfile.dev`:
```dockerfile
COPY ../shared-types/ ../shared-types/  # Copies from /workspace/shared-types/
```

## CI/CD Pipeline

For production builds, use this order:

```bash
# In CI/CD pipeline:
cd backend
npm run asyncapi:build        # Generate types
npm run typecheck             # Verify backend types
cd ../frontend
npm run typecheck            # Verify frontend types
cd ..
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml push
```

## Troubleshooting

### Error: Cannot find module '@shared-types/asyncapi'

**Cause**: Types weren't generated before Docker build

**Fix**:
```bash
cd backend && npm run asyncapi:build
# Then rebuild Docker images
```

### Error: ENOENT: no such file or directory, open '../shared-types/asyncapi/events.ts'

**Cause**: Docker build context is wrong or shared-types missing

**Fix**:
1. Verify `shared-types/` exists at `/workspace/shared-types/`
2. Verify Dockerfile uses `COPY ../shared-types/ ../shared-types/`
3. Verify docker-compose uses correct `context:`

### Error: TypeScript errors in container

**Cause**: Types generated with wrong settings

**Fix**:
```bash
cd backend
rm -rf ../shared-types/asyncapi
npm run asyncapi:build  # Regenerates with correct settings
```

## Verification

After building, verify types are in containers:

```bash
# Backend container
docker exec edulift-backend-dev ls -la /app/../shared-types/asyncapi/
# Should show 72+ .ts files

# Frontend container
docker exec edulift-frontend-e2e ls -la /app/../shared-types/asyncapi/
# Should show 72+ .ts files
```

## Development Workflow

### Updating AsyncAPI Specification

1. Edit `backend/docs/asyncapi/asyncapi.yaml`
2. Regenerate types: `cd backend && npm run asyncapi:build`
3. Both frontend and backend automatically use new types ✅

### Quick Test

```bash
# Generate types
cd backend && npm run asyncapi:build

# Test locally (no Docker)
npm run typecheck        # Backend
cd ../frontend && npm run typecheck  # Frontend

# Then build Docker
docker-compose -f docker-compose.dev.yml up --build
```
