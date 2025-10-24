[![CI Pipeline](https://github.com/jrevillard/edulift/actions/workflows/ci.yml/badge.svg)](https://github.com/jrevillard/edulift/actions/workflows/ci.yml) [![CD Pipeline](https://github.com/jrevillard/edulift/actions/workflows/cd-simple.yml/badge.svg)](https://github.com/jrevillard/edulift/actions/workflows/cd-simple.yml)

# EduLift Documentation

## 📋 Main Documentation

### Core Documents
These documents contain the complete, up-to-date information about EduLift:

1. **[Technical Documentation](./Technical-Documentation.md)** - Complete technical architecture, implementation details, and development guidelines
2. **[API Documentation](./API-Documentation.md)** - Comprehensive API reference with endpoints, authentication, and examples  
3. **[Functional Documentation](./Functional-Documentation.md)** - Business logic, user workflows, and feature specifications
4. **[Deployment Documentation](./Deployment-Documentation.md)** - Setup, deployment, and production management guides

## 🏗️ Architecture Overview

EduLift implements a **dual-system architecture**:

- **Family System**: Resource ownership (children, vehicles) within family units
- **Group System**: Scheduling coordination across multiple families for transportation planning

## 🚀 Quick Start

1. **Development Setup**: See [Deployment Documentation](./Deployment-Documentation.md#development-environment)
2. **API Integration**: Start with [API Documentation](./API-Documentation.md#authentication)
3. **Business Logic**: Understand workflows in [Functional Documentation](./Functional-Documentation.md#user-workflows)
4. **Technical Details**: Deep dive into [Technical Documentation](./Technical-Documentation.md#architecture-overview)

## 📊 Current Implementation Status

- ✅ **Backend Coverage**: 100% test coverage achieved
- ✅ **Frontend Coverage**: 83%+ with ongoing data-testid selector conversion (62% complete)
- ✅ **Family System**: Fully implemented with family-based group ownership
- ✅ **Real-time Features**: Socket.IO implementation with conflict detection
- 🔄 **Role System**: ADMIN/MEMBER roles (PARENT role deprecated)
- 🔄 **Caching**: Redis infrastructure ready, application integration pending

## 🛠️ Development Guidelines

### Testing Strategy
- **TDD Approach**: Red-Green-Refactor cycle for all new features
- **Test Pyramid**: Unit tests (Jest/Vitest) → Integration tests → E2E tests (Playwright)
- **Selector Strategy**: Use `data-testid` attributes for reliable test selectors

### Code Standards
- **TypeScript**: Strict type checking throughout
- **API Design**: RESTful endpoints with Zod validation
- **Real-time**: Socket.IO for collaborative features
- **Database**: PostgreSQL with Prisma ORM

## 📁 Documentation Structure

```
docs/
├── README.md                           # This overview document
├── Technical-Documentation.md          # Complete technical guide
├── API-Documentation.md               # API reference  
├── Functional-Documentation.md        # Business logic & workflows
├── Deployment-Documentation.md        # Setup & deployment
├── references/                        # Supplementary reference materials
│   ├── README.md
│   ├── Architecture-Family-vs-Groups.md
│   ├── Access-Control-and-Permissions.md
│   ├── Testing-Strategy.md
│   └── Family-Management-Accessibility-Guide.md
└── archive/                           # Historical documentation
    ├── README.md
    ├── specifications/
    └── outdated/
```

## 📞 Support

- **Issues**: Report bugs and feature requests via GitHub issues
- **Development**: Follow the contribution guidelines in Technical Documentation
- **API Questions**: Refer to API Documentation examples and troubleshooting sections
- **Deep Dives**: Check [references/](./references/) for detailed implementation guides

---

*This documentation is maintained to reflect the current implementation and is updated with each release.*
