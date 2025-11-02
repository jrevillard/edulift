# CI/CD Architecture Guide

## Overview

EduLift uses a modern, modular CI/CD architecture optimized for monorepo development with intelligent caching strategies and enterprise-grade security scanning.

## Architecture Summary

### 🏗️ Workflow Structure

```
.github/workflows/
├── backend-ci.yml          # Backend tests & validation
├── frontend-ci.yml         # Frontend tests & build validation
├── dependencies-ci.yml     # Security audit & dependency management
├── e2e-tests.yml           # End-to-end testing
└── cd-optimized.yml        # Docker builds & deployment
```

### 📊 Performance Metrics

| Component | Time | Cache Hit Rate | Optimizations |
|-----------|------|----------------|---------------|
| Backend CI | 2-3 min | 90%+ | Project-specific v3 cache |
| Frontend CI | 1-2 min | 90%+ | Vite cache + v3 cache |
| Docker Build | 1-2 min | 95%+ | Registry cache + GHA cache |
| E2E Tests | 3-5 min | 85%+ | Playwright + build cache |
| **Total Parallel** | **3-5 min** | **~90%** | **75% faster than legacy** |

## 🚀 Key Optimizations

### 1. Modular Workflow Architecture
- **Separated concerns**: Each workflow has a single responsibility
- **Path-based triggers**: Workflows only run when relevant files change
- **Independent scaling**: Components can be tested/built independently

### 2. Intelligent Caching Strategy

#### Node.js Dependencies
```yaml
# Project-specific isolation prevents cross-contamination
key: v3-node-${{ runner.os }}-backend-${{ hashFiles('backend/package-lock.json') }}
path: backend/node_modules
```

#### Docker Layers (Registry Cache)
```yaml
# Dual cache strategy for maximum efficiency
cache-from: type=gha                    # Job-specific cache
cache-from: type=registry,ref=ghcr.io/repo:buildcache  # Shared cache
```

#### Playwright Browsers
```yaml
# Version-aware cache with cross-platform paths
key: v3-playwright-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
path: ~/.cache/ms-playwright  # Cross-platform compatible
```

### 3. Security Integration
- **Automated vulnerability scanning** with Trivy
- **Dependency security audits** with npm audit
- **GitHub Security tab integration** with SARIF reports
- **Multi-container security validation**

### 4. Multi-Registry Strategy
- **Primary**: GitHub Container Registry (unlimited cache, better integration)
- **Fallback**: Docker Hub (backward compatibility)
- **Dual tagging**: Same image pushed to both registries

## 🔧 Cache Management

### Cache Versioning
- **v3**: Current optimized cache strategy
- **v2**: Legacy cache (deprecated)
- Increment version when breaking changes are needed

### Cache Keys Strategy
```
Format: v{version}-{component}-{os}-{identifier}
Examples:
- v3-node-Linux-backend-abc123def
- v3-docker-Linux-frontend-xyz789uvw
- v3-playwright-Linux-ghi456jkl
```

### Cache Invalidation
Increment cache version when:
1. Node.js version changes
2. Major dependency updates
3. Cache corruption detected
4. Significant workflow changes

## 📋 Workflow Details

### Backend CI (`backend-ci.yml`)
**Triggers**: `backend/**` changes
**Features**:
- PostgreSQL & Redis services for testing
- Prisma client generation and migrations
- TypeScript validation and ESLint
- Production server startup validation
- Project-specific v3 cache

### Frontend CI (`frontend-ci.yml`)
**Triggers**: `frontend/**` changes
**Features**:
- TypeScript validation and ESLint
- Unit tests execution
- Separate build validation job
- Vite cache for faster compilation
- Project-specific v3 cache

### Dependencies CI (`dependencies-ci.yml`)
**Triggers**: `package*.json` changes
**Features**:
- Security vulnerability scanning
- Dependency version consistency checks
- Outdated package detection
- JSON validation for all package.json files

### E2E Tests (`e2e-tests.yml`)
**Triggers**: `frontend/**` or `e2e/**` changes
**Features**:
- Cross-platform Playwright browser cache
- Version-aware cache invalidation
- Build artifact caching
- Comprehensive test reporting

### CD Optimized (`cd-optimized.yml`)
**Triggers**: Main branch pushes, tags
**Features**:
- Multi-platform builds (AMD64/ARM64)
- Registry cache for shared layers
- GitHub Container Registry integration
- Automated security scanning with Trivy
- Rich deployment summaries

## 🛠️ Development Guidelines

### When Adding New Workflows

1. **Use v3 cache strategy**:
   ```yaml
   key: v3-component-${{ runner.os }}-${{ hashFiles('path/to/package-lock.json') }}
   ```

2. **Implement path-based triggers**:
   ```yaml
   paths:
     - 'your-component/**'
     - '.github/workflows/your-workflow.yml'
   ```

3. **Add debug logging**:
   ```yaml
   - name: Debug cache contents
     if: failure()
     run: du -sh your-component/node_modules
   ```

4. **Include security scanning** when building containers

### Cache Best Practices

- **Project-specific isolation**: Never use global caches in monorepo
- **Hash-based keys**: Base cache invalidation on actual content changes
- **Limited fallbacks**: Avoid overly broad restore-keys
- **Registry cache**: Use for Docker builds when possible

### Performance Optimization

- **Parallel execution**: Design workflows to run independently
- **Minimal triggers**: Use path filters to avoid unnecessary runs
- **Efficient caching**: Cache expensive operations (npm install, Docker builds)
- **Build artifacts**: Reuse build outputs when possible

## 🔍 Troubleshooting

### Cache Issues
```bash
# Check cache hit rates in workflow logs
grep "Cache restored from key" workflow.log

# Clear corrupted registry cache
docker buildx imagetools inspect ghcr.io/repo:buildcache
docker buildx prune -f
```

### Performance Issues
- Monitor cache hit rates
- Check workflow execution times
- Verify path-based triggers are working
- Ensure proper cache invalidation

### Security Scan Failures
- Review SARIF reports in Security tab
- Check for false positives
- Update dependencies to fix vulnerabilities
- Use `continue-on-error: true` for non-critical issues

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Buildx Cache](https://docs.docker.com/buildx/cache/)
- [Playwright Testing](https://playwright.dev/)
- [Trivy Security Scanner](https://github.com/aquasecurity/trivy)

## 🚀 Future Improvements

Potential enhancements:
- Self-hosted runners for faster cache locality
- Incremental builds based on file change analysis
- Advanced artifact sharing between workflows
- Custom cache storage backends
- Test matrix optimization for parallel execution