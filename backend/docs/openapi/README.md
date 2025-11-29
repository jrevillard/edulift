# OpenAPI Documentation - EduLift Backend

This directory contains the OpenAPI 3.1 specification for the EduLift Backend API.

## 📋 Implementation Status

**Phase 1.3 & Phase 2 COMPLETED** ✅

The initial OpenAPI infrastructure has been successfully implemented as per the [OPENAPI_MIGRATION_PLAN.md](../OPENAPI_MIGRATION_PLAN.md).

## 📄 Files

- **`swagger.json`** - Auto-generated OpenAPI 3.1 specification
- **`README.md`** - This file

## 🚀 Quick Start

### Viewing the Documentation

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Access Swagger UI:**
   - Open your browser to: http://localhost:3000/api-docs

### Generating/Updating Documentation

The OpenAPI specification is automatically generated when you:
- Run `npm run dev` (development)
- Run `npm run build` (production build)

To manually regenerate:
```bash
npm run swagger:generate
```

## 📊 API Baseline

A snapshot of the current API state has been captured in `/workspace/backend/tests/snapshots/api-baseline.json`:

- **Total Routes:** 93
- **GET:** 35
- **POST:** 33
- **PUT:** 5
- **PATCH:** 7
- **DELETE:** 13
- **Auth Protected:** 11
- **Public:** 82

### Capturing a New Baseline

To capture the current API state:
```bash
npm run swagger:capture-baseline
```

## 🔧 Configuration

### Swagger UI Settings

Swagger UI is configured in `/workspace/backend/src/app.ts`:

- **Enabled by default in:** Development (`NODE_ENV !== 'production'`)
- **Can be enabled in production:** Set `SWAGGER_ENABLED=true`
- **Endpoint:** `/api-docs`

### OpenAPI Configuration

The OpenAPI specification is configured in `/workspace/backend/src/config/swagger.ts`:

- **OpenAPI Version:** 3.1.0
- **Server URL:** `process.env.API_BASE_URL` (default: `http://localhost:3000`)
- **Authentication:** Bearer JWT tokens

### Excluded Endpoints (Production)

The following endpoints are hidden in production (as per Phase 6.2):
- `GET /api/v1/auth/test-config` - Debug endpoint
- `POST /api/v1/fcm-tokens/test` - Testing endpoint
- `POST /api/v1/groups/schedule-config/initialize` - Dead code (already removed)

## 📚 API Tags

The API is organized into the following categories:

- **Auth** - Authentication & authorization
- **Children** - Child resource management
- **Vehicles** - Vehicle resource management
- **Groups** - Group management & coordination
- **Families** - Family management
- **Schedule** - Schedule & time slots management
- **Dashboard** - Dashboard & statistics
- **Invitations** - Family & group invitations
- **FCM** - Push notifications (Firebase Cloud Messaging)
- **Monitoring** - Health checks & system status
- **Testing** - Testing & debugging (dev only)

## 🔒 Security

### Authentication

Most endpoints require JWT Bearer authentication:

```http
Authorization: Bearer <your-jwt-token>
```

Obtain tokens via:
- `POST /api/v1/auth/magic-link` - Request magic link
- `POST /api/v1/auth/verify` - Verify magic link and get token
- `POST /api/v1/auth/refresh` - Refresh expired token

### Swagger UI in Production

For security, Swagger UI is disabled by default in production. To enable:

```bash
SWAGGER_ENABLED=true
```

**Note:** Consider adding authentication to `/api-docs` in production if enabled.

## 📖 Next Steps (Future Phases)

This implementation completes **Phase 1.3** (API Baseline) and **Phase 2** (Infrastructure Setup).

Future phases will include:
- **Phase 3:** Enriching schemas with Zod conversions
- **Phase 4:** Non-regression testing
- **Phase 5:** Validation and deployment
- **Phase 6:** Security hardening
- **Phase 7:** Documentation and training

See [OPENAPI_MIGRATION_PLAN.md](../OPENAPI_MIGRATION_PLAN.md) for details.

## 🧪 Testing

### Non-Regression Tests

All existing tests continue to pass:
```bash
npm test
```

Results: **62 test suites, 1025 tests passed** ✅

### Validating the OpenAPI Spec

The generated `swagger.json` is a valid OpenAPI 3.1 document. To validate:

```bash
npx @redocly/cli lint docs/openapi/swagger.json
```

## 📝 Important Notes

### No API Behavior Changes

This implementation:
- ✅ Adds OpenAPI documentation infrastructure
- ✅ Does NOT modify any endpoint behavior
- ✅ Does NOT change request/response formats
- ✅ Does NOT affect authentication or authorization
- ✅ All existing tests pass without modification

### Generation is Automatic

The `swagger.json` file is **auto-generated** - do not edit manually!

Changes to the API documentation should be made by:
1. Updating route definitions in `/workspace/backend/src/routes/*.ts`
2. Updating configuration in `/workspace/backend/src/config/swagger.ts`
3. Running `npm run swagger:generate`

## 🛠️ Troubleshooting

### Swagger UI shows "Failed to load"

Run the generation script:
```bash
npm run swagger:generate
```

### Routes not appearing in Swagger UI

1. Check that routes are properly registered in `/workspace/backend/src/app.ts`
2. Regenerate the specification: `npm run swagger:generate`
3. Restart the dev server

### Need to update API server URL

Set the environment variable:
```bash
API_BASE_URL=https://api.edulift.com npm run swagger:generate
```

## 📞 Support

For questions or issues:
- Check the [OPENAPI_MIGRATION_PLAN.md](../OPENAPI_MIGRATION_PLAN.md)
- Review the generated `swagger.json`
- Consult the [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)

---

**Last Updated:** 2025-11-26
**Phase Completed:** 1.3 & 2 (Infrastructure Setup)
**Status:** ✅ Ready for Phase 3
