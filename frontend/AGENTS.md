# EduLift Frontend - AI Agent Instructions

This file provides specific instructions for AI coding agents working on the EduLift web frontend application.

## 🛠️ Technology Stack

- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **State Management**: Custom stores/context providers
- **Styling**: Tailwind CSS
- **Testing**: Vitest (unit), Playwright (E2E)
- **HTTP Client**: Axios or fetch API

## 📁 Project Structure

```
src/
├── components/     - Reusable UI components
├── pages/          - Page components and routing
├── services/       - API service layer
├── contexts/       - React context providers
├── hooks/          - Custom React hooks
├── stores/         - State management stores
├── utils/          - Utility functions
├── constants/      - Application constants
├── types/          - TypeScript types and interfaces
├── test/           - Test utilities and mocks
├── assets/         - Static assets
├── shared/         - Shared components and utilities
└── lib/            - External library integrations
```

## ▶️ Development Commands

- **Development Server**: `npm run dev`
- **Build**: `npm run build`
- **Preview Build**: `npm run preview`

## 🧪 Testing Commands

- **Unit Tests**: `npm test` or `npm run test:watch`
- **Unit Test Coverage**: `npm run test:coverage`
- **E2E Tests**: `npm run e2e`
- **E2E Tests (UI)**: `npm run e2e:ui`
- **E2E Tests (Headed)**: `npm run e2e:headed`

## 📝 Code Style Guidelines

- Follow existing TypeScript and React patterns
- Use functional components with hooks
- Implement proper error handling
- Write unit tests for new components and functions
- Use Tailwind CSS for styling
- Follow existing component structure and naming conventions

## 🔄 Common Workflows

1. **Creating New Components**:
   - Place in appropriate directory under `src/components/`
   - Follow existing component patterns
   - Include TypeScript interfaces for props
   - Add unit tests in `src/test/`

2. **Adding New Pages**:
   - Create in `src/pages/`
   - Update routing in `App.tsx` if needed
   - Include proper error boundaries

3. **API Integration**:
   - Add new services in `src/services/`
   - Use existing HTTP client patterns
   - Handle loading and error states

4. **State Management**:
   - Use existing store patterns in `src/stores/`
   - Create new stores only when necessary
   - Prefer React context for component-specific state

## ⚠️ Important Notes

- Always check for existing patterns before implementing new solutions
- Maintain consistency with existing code style
- Ensure mobile responsiveness for all UI components
- Follow accessibility guidelines (WCAG 2.1 AA)
- Update tests when modifying existing functionality