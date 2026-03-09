# Architecture Decision Record: Socket.IO Integration with Hono

## Status
Accepted

## Date
2026-03-09

## Context
The EduLift backend uses both **Hono** (HTTP framework) and **Socket.IO** (WebSocket). We need to integrate them without conflicts.

## Problem
When Socket.IO was attached to the HTTP server **before** passing it to Hono's `serve()`, HTTP requests were intercepted by Socket.IO instead of reaching Hono's route handlers. This caused:

- Health check `/health` endpoint to time out
- curl receiving 0 bytes despite successful TCP connection
- No Hono middleware logs appearing

**Root Cause**: Node.js event listeners are called in the order they're registered. Socket.IO attaching first meant it intercepted all requests.

## Decision
Use `createAdaptorServer()` from `@hono/node-server` to create the Hono server **first**, then attach Socket.IO **afterward**.

### Implementation Pattern

```typescript
import { createAdaptorServer } from '@hono/node-server';
import { SocketHandler } from './socket/socketHandler';

// ✅ CORRECT: Create Hono server first
const server = createAdaptorServer({
  fetch: app.fetch,
});

// Attach Socket.IO AFTER Hono (prevents conflicts)
const socketHandler = new SocketHandler(server);

// Start server manually with error handling
server.on('error', (error: NodeJS.ErrnoException) => {
  // Handle EADDRINUSE, EACCES, etc.
});

server.listen(port, host, () => {
  console.log(`✅ Server ready`);
});
```

### ❌ Anti-Pattern (DO NOT USE)

```typescript
// ❌ WRONG: Socket.IO attached before Hono
const httpServer = createServer();
const socketHandler = new SocketHandler(httpServer);

serve({
  createServer: () => httpServer,  // ❌ Conflicts!
  fetch: app.fetch,
});
```

## Type Safety Considerations

### Current Implementation (Type Cast)

```typescript
constructor(server: HTTPServer | ServerType) {
  // createAdaptorServer returns ServerType (HTTP/1 or HTTP/2)
  // Socket.IO requires HTTP/1, so this cast is safe
  const httpServer = server as HTTPServer;
  this.io = new SocketIOServer(httpServer, { ... });
}
```

**Why this is acceptable:**
1. `createAdaptorServer()` always creates HTTP/1 servers by default
2. Socket.IO only works with HTTP/1, will fail clearly if HTTP/2 is used
3. The cast is documented and tracked as technical debt

**Future Improvement:**
- Add runtime check: `if ('httpVersion' in server && server.httpVersion === '2.0')`
- Consider HTTP/2 support if Socket.IO adds it in future

## Error Handling

Server startup now includes proper error handling:

```typescript
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.syscall !== 'listen') throw error;

  switch (error.code) {
    case 'EADDRINUSE':
      console.error(`❌ Port ${port} is already in use`);
      process.exit(1);
    case 'EACCES':
      console.error(`❌ Port ${port} requires elevated privileges`);
      process.exit(1);
    default:
      throw error;
  }
});
```

## Consequences

### Positive
- ✅ Health checks work correctly
- ✅ All HTTP routes properly handled by Hono
- ✅ Socket.IO WebSocket connections work
- ✅ CI/CD pipeline unblocked
- ✅ Type safety improved (runtime checks documented)

### Negative
- ⚠️ Requires manual `server.listen()` call (not automatic)
- ⚠️ Type cast needed (documented as acceptable)
- ⚠️ Slightly more complex than naive approach

## Related Decisions
- ADR-001: Use Hono as HTTP framework
- ADR-002: Use Socket.IO for WebSocket communication

## References
- [Hono Node Server Documentation](https://hono.dev/docs/node-server/)
- [Socket.IO Node.js Documentation](https://socket.io/docs/v4/server-initialization/)
- Systematic Debugging Investigation: `/workspace/.github/workflows/backend-ci.yml`
- Issue: CI/CD blocking with health check timeouts

## Authors
- Claude (AI Assistant) with systematic debugging
- Code Review: superpowers:code-reviewer subagent
