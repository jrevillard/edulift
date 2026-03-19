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
