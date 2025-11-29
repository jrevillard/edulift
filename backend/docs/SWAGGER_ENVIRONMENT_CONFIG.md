# Swagger UI Environment Configuration

This document explains how to configure Swagger UI to work correctly across all deployment environments.

## Environment Variables

The Swagger configuration supports the following environment variables in priority order:

### 1. SWAGGER_BASE_URL (Highest Priority)
Explicitly sets the full base URL for the API server.
```bash
# Example
SWAGGER_BASE_URL=https://api.example.com/api/v1
```

### 2. REVERSE_PROXY_URL
Sets the reverse proxy URL, automatically appending `/api/v1`.
```bash
# Example
REVERSE_PROXY_URL=https://staging.edulift.com
# Results in: https://staging.edulift.com/api/v1
```

### 3. FRONTEND_URL (Production Only)
Uses the frontend URL as base in production environments.
```bash
# Example (NODE_ENV=production)
FRONTEND_URL=https://app.edulift.com
# Results in: https://app.edulift.com/api/v1
```

### 4. API_HOST and API_PORT (Default)
Custom host and port configuration.
```bash
# Examples
API_HOST=api.example.com
API_PORT=443

# Or for local development
API_HOST=localhost
API_PORT=3001
```

## Environment Configurations

### Development (docker-compose.dev.yml)
- **Default URL**: `http://localhost:3001/api/v1`
- **Access**: http://localhost:3001/api-docs
- **Configuration**:
  ```yaml
  environment:
    SWAGGER_ENABLED: "true"
    API_HOST: localhost
    API_PORT: 3001
  ```

### Production (docker-compose.prod.yml)
- **Default URL**: `${FRONTEND_URL}/api/v1`
- **Access**: Via reverse proxy at `/api-docs`
- **Configuration**:
  ```yaml
  environment:
    REVERSE_PROXY_URL: ${REVERSE_PROXY_URL:-${FRONTEND_URL}}
    SWAGGER_ENABLED: ${SWAGGER_ENABLED:-false}
  ```

### Ansible Deployments
Environment variables should be set in the `.env` file:
```bash
# Enable Swagger in staging/production
SWAGGER_ENABLED=true

# Set the reverse proxy URL
REVERSE_PROXY_URL=https://your-domain.com

# Or use explicit base URL
SWAGGER_BASE_URL=https://your-domain.com/api/v1
```

## Usage Examples

### Local Development
```bash
# Start with defaults
npm run dev

# Visit: http://localhost:3001/api-docs
```

### Custom Development Server
```bash
API_HOST=192.168.1.100 API_PORT=8080 npm run dev
```

### Staging with Reverse Proxy
```bash
REVERSE_PROXY_URL=https://staging.edulift.com npm run swagger:generate
npm start
```

### Production with Explicit URL
```bash
SWAGGER_BASE_URL=https://api.edulift.com/api/v1 npm run swagger:generate
npm start
```

## How It Works

1. **Environment Detection**: The configuration automatically detects `NODE_ENV` and adjusts URLs accordingly.
2. **Protocol Detection**: Uses HTTPS in production or when port 443 is specified.
3. **Dynamic Server Selection**: Swagger UI pre-selects the correct server URL based on the environment.
4. **Environment Descriptions**: Each server configuration shows environment details for clarity.

## Testing Configurations

Test your configuration before deployment:

```bash
# Test different environments
npm run swagger:generate                    # Development defaults

SWAGGER_BASE_URL=https://api.test.com/api/v1 npm run swagger:generate

REVERSE_PROXY_URL=https://staging.test.com npm run swagger:generate

NODE_ENV=production FRONTEND_URL=https://app.test.com npm run swagger:generate
```

Check the generated `docs/openapi/swagger.json` file to verify the `servers` array contains the correct URL.

## Security Notes

- Swagger UI is **disabled by default in production** unless `SWAGGER_ENABLED=true`
- When enabling in production, ensure proper authentication/authorization
- Consider restricting access to API documentation in production environments
- Use HTTPS URLs in production environments

## Troubleshooting

### "Try it out" doesn't work
1. Check that the server URL in Swagger UI matches your actual API endpoint
2. Verify CORS is configured correctly for your environment
3. Ensure the API server is accessible from the browser

### Wrong server URL displayed
1. Check environment variables are set correctly
2. Regenerate the swagger spec: `npm run swagger:generate`
3. Restart the application

### Can't access Swagger UI
1. Verify `SWAGGER_ENABLED=true` in production
2. Check that `/api-docs` route is not blocked by firewalls or reverse proxy rules
3. Ensure the swagger.json file exists: run `npm run swagger:generate`