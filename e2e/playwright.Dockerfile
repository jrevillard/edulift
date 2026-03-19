# Playwright E2E Test Container
# Builds test files into the image to avoid Docker volume mount issues

FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Install dependencies for node-fetch
RUN npm install -g node-fetch@2

# Set working directory
WORKDIR /e2e

# Copy test files and configuration
COPY package*.json ./
COPY tsconfig.json ./
COPY playwright.config.ts ./
COPY tests/ ./tests/

# Install dependencies
RUN npm ci

# Verify Playwright browsers are installed
RUN npx playwright install --with-deps chromium

# Verify installation
RUN npx playwright test --list 2>&1 | head -5

# Set environment variables for container-to-container communication
ENV E2E_BASE_URL=http://frontend-e2e:3000
ENV CI=true

# Command to run tests
CMD ["npx", "playwright", "test"]
