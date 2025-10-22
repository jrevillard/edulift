# EduLift CI/CD Setup

This document describes the complete Continuous Integration and Continuous Deployment setup for the EduLift project.

## Overview

The CI/CD pipeline is designed to:
- Run comprehensive tests on every push and pull request
- Build and push Docker images to Docker Hub automatically
- Deploy to staging on main branch pushes
- Deploy to production on version tags

## Pipeline Structure

### CI Pipeline (`.github/workflows/ci.yml`)

Runs on every push to `main`/`develop` branches and all pull requests.

**Jobs:**
1. **Backend Tests**: Unit tests, integration tests, TypeScript checking
2. **Frontend Tests**: Unit tests, TypeScript checking, ESLint
3. **E2E Tests**: End-to-end testing with Playwright
4. **Security & Quality**: Vulnerability scanning, dependency auditing
5. **Coverage Report**: Code coverage analysis

### CD Pipeline (`.github/workflows/cd-simple.yml`)

Runs on pushes to `main` branch and version tags.

**Jobs:**
1. **Build and Push**: Builds Docker images and pushes to Docker Hub
2. **Deploy Info**: Provides deployment information

## Docker Images

The pipeline builds and pushes the following images to Docker Hub:

- `jrevillard/edulift-backend:latest` - Backend API server
- `jrevillard/edulift-frontend:latest` - Frontend application

### Image Tags

- `latest`: Latest version from main branch
- `sha-<commit>`: Specific commit SHA
- `v<version>`: Version tags (e.g., v1.0.0)

## Setup Instructions

### 1. GitHub Repository Secrets

Add the following secrets to your GitHub repository:

```
DOCKER_HUB_TOKEN=<your-docker-hub-access-token>
```

### 2. Docker Hub Setup

1. Create Docker Hub repositories:
   - `jrevillard/edulift-backend`
   - `jrevillard/edulift-frontend`

2. Generate a Docker Hub access token:
   - Go to Docker Hub → Account Settings → Security
   - Create a new access token
   - Add it as `DOCKER_HUB_TOKEN` in GitHub secrets

### 3. Environment Variables (Optional)

For deployment environments, configure these variables in GitHub:

**Repository Variables:**
```
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
STAGING_URL=https://staging.edulift.com
PRODUCTION_URL=https://edulift.com
```

## Local Deployment with Docker Hub Images

### Quick Start

1. **Copy environment file:**
   ```bash
   cp .env.docker-hub.example .env
   ```

2. **Edit environment variables:**
   Edit `.env` file with your configuration

3. **Deploy using script:**
   ```bash
   chmod +x scripts/deploy-docker-hub.sh
   ./scripts/deploy-docker-hub.sh staging
   ```

### Manual Deployment

1. **Pull latest images:**
   ```bash
   docker pull jrevillard/edulift-backend:latest
   docker pull jrevillard/edulift-frontend:latest
   ```

2. **Use existing docker-compose:**
   ```bash
   # For development
   docker-compose -f docker-compose.dev.yml up -d
   
   # For production
   docker-compose -f docker-compose.prod.yml up -d
   ```

## Deployment Environments

### Staging
- **Trigger**: Push to `main` branch
- **Images**: `jrevillard/edulift-*:latest`
- **Environment**: `staging`

### Production
- **Trigger**: Git tags starting with `v` (e.g., `v1.0.0`)
- **Images**: `jrevillard/edulift-*:<version>`
- **Environment**: `production`

### Creating a Production Release

```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

This will trigger the CD pipeline and deploy to production.

## Monitoring and Health Checks

### Service Health Endpoints

- **Backend**: `http://localhost:3001/health`
- **Frontend**: `http://localhost:3000`

### Container Health Checks

All services include health checks that monitor:
- Service availability
- Database connectivity
- Redis connectivity

### Logs

```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs backend
docker-compose logs frontend

# Follow logs in real-time
docker-compose logs -f
```

## Security Features

### Vulnerability Scanning
- **Trivy**: Scans filesystem and Docker images for vulnerabilities
- **npm audit**: Checks for known vulnerabilities in dependencies
- Results uploaded to GitHub Security tab

### Image Security
- Multi-platform builds (AMD64, ARM64)
- Minimal Alpine-based images
- No sensitive data in images
- Health checks for all services

## Troubleshooting

### Common Issues

1. **Docker Hub Push Fails**
   - Verify `DOCKER_HUB_TOKEN` secret is set correctly
   - Check Docker Hub repository exists
   - Verify token has push permissions

2. **Tests Fail**
   - Check database connection in CI
   - Verify test environment variables
   - Review test logs in GitHub Actions

3. **Deployment Issues**
   - Check `.env` file configuration
   - Verify Docker images are available
   - Check service health endpoints

### Getting Help

1. **Check GitHub Actions logs**: 
   - Go to Actions tab in GitHub
   - Click on failed workflow
   - Review step-by-step logs

2. **Local debugging**:
   ```bash
   # Check container status
   docker-compose ps
   
   # Check logs
   docker-compose logs -f service-name
   
   # Test health endpoints
   curl http://localhost:3001/health
   curl http://localhost:3000
   ```

3. **Container inspection**:
   ```bash
   # Enter container for debugging
   docker-compose exec backend /bin/sh
   docker-compose exec frontend /bin/sh
   ```

## Development Workflow

### Feature Development
1. Create feature branch from `main`
2. Develop and commit changes
3. Push branch - triggers CI pipeline
4. Create pull request - triggers full CI suite
5. Merge to `main` - triggers CD pipeline with staging deployment

### Release Process
1. Ensure `main` branch is stable
2. Create version tag: `git tag v1.0.0`
3. Push tag: `git push origin v1.0.0`
4. CD pipeline automatically deploys to production

## Performance Optimization

### Build Caching
- GitHub Actions cache for Docker layers
- Separate cache scopes for backend/frontend
- Node.js dependency caching

### Multi-platform Builds
- Supports AMD64 and ARM64 architectures
- Optimized for both development and production

### Resource Limits
- CI jobs have appropriate resource constraints
- Docker containers include memory limits
- Health checks prevent resource exhaustion

---

**Next Steps:**
1. Set up Docker Hub token in repository secrets
2. Create first version tag to test production deployment
3. Configure monitoring and alerting for production environment
4. Set up domain and SSL certificates for production deployment