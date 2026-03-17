# Shared Types

This directory contains type definitions shared between the backend and frontend to eliminate code duplication.

## Structure

```
shared-types/
├── asyncapi/          # WebSocket event types and constants
│   ├── index.ts       # Main export for all AsyncAPI types
│   ├── events.ts      # Shared SOCKET_EVENTS constants
│   └── *.ts           # Individual type files (auto-generated)
└── openapi/           # (Future) REST API types
```

## AsyncAPI WebSocket Events

### What's Shared

- **All AsyncAPI generated types** - Complete type definitions for all WebSocket events
- **Event name constants** (`SOCKET_EVENTS`)
- **Event name type** (`SocketEventName`)

### How It Works

1. **Backend** (Source of Truth):
   - Defines AsyncAPI specification in `docs/asyncapi/asyncapi.yaml`
   - Generates types directly to `shared-types/asyncapi/` using Modelina
   - Post-processes for `verbatimModuleSyntax` compatibility
   - Creates event constants from YAML channels

2. **Generation Pipeline**:
   ```bash
   cd backend
   npm run asyncapi:build  # Validates + generates types to shared-types/
   ```

   This one command:
   - Validates `asyncapi.yaml`
   - Generates 72+ TypeScript types to `shared-types/asyncapi/`
   - Post-processes for strict TypeScript compatibility
   - Creates event constants (`events.ts`) and index (`index.ts`)

3. **Both Projects Import**:
   - Backend: `import { GroupData } from '@shared-types/asyncapi'`
   - Frontend: `import type { GroupData } from '@shared-types/asyncapi'`
   - Single source of truth, zero duplication

## Updating Shared Types

When you modify WebSocket events in the AsyncAPI specification:

1. Edit `/workspace/backend/docs/asyncapi/asyncapi.yaml`
2. Regenerate all types:
   ```bash
   cd backend && npm run asyncapi:build
   ```
3. Both backend and frontend automatically use updated types ✅

## TypeScript Path Aliases

Both projects use path aliases to reference shared types:

### Backend (`tsconfig.json`)
```json
{
  "paths": {
    "@shared-types/*": ["../shared-types/*"]
  }
}
```

### Frontend (`tsconfig.app.json`)
```json
{
  "paths": {
    "@shared-types/*": ["../shared-types/*"]
  }
}
```

## How We Solved the TypeScript Strictness Problem

**The Challenge**: The frontend uses Vite with strict TypeScript settings:
- `verbatimModuleSyntax: true` - Requires explicit type-only imports
- `erasableSyntaxOnly: true` - Disallows const enums

Modelina's generated types don't comply with these strict settings out of the box.

**The Solution**: Post-processing pipeline
1. **Generate**: AsyncAPI CLI generates types using Modelina
2. **Fix**: Custom script converts exports to `export type` and imports to `import type`
3. **Sync**: Fixed types are copied to shared-types directory

This ensures full type compatibility while maintaining the frontend's strict standards.

## Benefits

✅ **Single Source of Truth**: All AsyncAPI types defined from backend's AsyncAPI spec
✅ **No Duplication**: Frontend imports complete type definitions
✅ **Full Type Safety**: Both projects use identical type definitions
✅ **Strict Mode Compatible**: Post-processing ensures frontend compatibility
✅ **Easy Updates**: One command (`npm run asyncapi:generate-types && npm run sync:types`) syncs everything

## Future: OpenAPI Types

The same approach can be used for REST API types:

1. Backend generates OpenAPI types (already done)
2. Create sync script for OpenAPI types
3. Frontend imports shared OpenAPI type definitions
4. Eliminate duplicate OpenAPI type definitions
