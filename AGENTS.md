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

- Do not modify files outside your assigned component without coordination
- Always check for cross-component dependencies before making changes
- Refer to the documentation in `/docs/` for functional and technical specifications
- Preserve existing functionality when refactoring or adding features
