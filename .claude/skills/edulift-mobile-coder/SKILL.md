---
name: edulift-mobile-coder
description: This skill should be used when working on the EduLift Flutter/Dart mobile application for development tasks including implementing new features, fixing bugs, optimizing performance, or maintaining existing code. Use this skill for any coding work on the school transportation management app including UI components, business logic, API integration, state management, and architecture compliance.
---

# EduLift Mobile Coder - Flutter/Dart Development Expert

## Overview

This skill enables expert-level development on the EduLift Flutter mobile application, implementing features for collaborative school transportation management with deep understanding of Clean Architecture, Riverpod state management, and mobile-first UX patterns.

## Quick Start

For common development scenarios on EduLift:

**Adding New Features:**
1. Analyze existing patterns in the relevant feature directory (`lib/features/[feature_name]/`)
2. Follow Clean Architecture layers: presentation → domain → data
3. Create Riverpod providers for state management
4. Add comprehensive unit and widget tests
5. Update internationalization files if needed

**Fixing Bugs:**
1. Locate the issue using feature organization and symbols
2. Check existing test coverage for context
3. Implement minimal, targeted fix
4. Add regression tests if needed
5. Run `flutter test` to verify

**Performance Optimization:**
1. Use `flutter analyze` to identify issues
2. Check Riverpod provider dependencies
3. Optimize widget rebuilds with const constructors
4. Review API client patterns and caching

## Core Development Patterns

### 1. Feature Organization
EduLift uses feature-first Clean Architecture:

```
lib/features/[feature]/
├── presentation/     # UI components, providers, routing
│   ├── providers/    # Riverpod state management
│   ├── widgets/      # Reusable UI components
│   ├── pages/        # Screen implementations
│   └── routing/      # Navigation logic
├── domain/          # Business logic
│   ├── entities/    # Core business objects
│   ├── repositories/ # Repository interfaces
│   ├── usecases/    # Business operations
│   └── services/    # Domain services
└── data/            # Data layer implementation
    ├── repositories/ # Repository implementations
    ├── datasources/ # API and local data
    └── models/      # Data transfer objects
```

**Key Features:**
- `auth/` - Magic link authentication, biometric auth
- `family/` - Member management, vehicles, children
- `groups/` - Multi-family coordination
- `schedule/` - Time slot management, assignments
- `dashboard/` - Unified overview
- `settings/` - App configuration

### 2. State Management with Riverpod

**Core Pattern - StateNotifier with NetworkErrorHandler:**
```dart
@riverpod
class FamilyNotifier extends _$FamilyNotifier {
  @override
  Future<Family?> build() async {
    return await _networkErrorHandler.executeRepositoryOperation(
      () => _familyRepository.getCurrentFamily(),
      operationName: 'family.getCurrentFamily',
      strategy: CacheStrategy.networkFirst,
      serviceName: 'family',
    );
  }

  Future<void> addMember(Member member) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      await _networkErrorHandler.executeRepositoryOperation(
        () => _familyRepository.addMember(state.value!.id, member),
        operationName: 'family.addMember',
        strategy: CacheStrategy.networkOnly,
      );
      return ref.invalidateSelf(); // Refresh state
    });
  }
}
```

**Provider Composition Pattern:**
```dart
// In providers.dart
export 'presentation/providers/family_provider.dart' show FamilyState, familyNotifierProvider;
export 'data/providers/family_repository_provider.dart' show familyRepositoryProvider;

// Family-specific providers
@riverpod
Family? currentFamily(CurrentFamilyRef ref) {
  return ref.watch(familyNotifierProvider).value;
}
```

### 3. NetworkErrorHandler Pattern

**Unified error handling with caching:**
```dart
// NetworkErrorHandler usage in repositories
Future<T> _executeWithErrorHandling<T>(
  Future<T> Function() operation,
  String operationName, {
  CacheStrategy strategy = CacheStrategy.networkFirst,
}) async {
  return await _networkErrorHandler.executeRepositoryOperation(
    operation,
    operationName: operationName,
    strategy: strategy,
    serviceName: 'feature_name',
    config: RetryConfig.quick,
  );
}
```

**Cache Strategies:**
```dart
enum CacheStrategy {
  networkOnly,      // Always fetch from network
  cacheOnly,        // Only use cached data
  networkFirst,     // Try network, fallback to cache
  staleWhileRevalidate, // Return cache immediately, refresh in background
}
```

### 4. BaseState CRTP Pattern

**State management with BaseState:**
```dart
@immutable
class FamilyState implements BaseState<FamilyState> {
  const FamilyState({
    required this.isLoading,
    required this.family,
    this.error,
  });

  final bool isLoading;
  final Family? family;
  final String? error;

  @override
  FamilyState copyWith({
    bool? isLoading,
    Family? family,
    String? error,
    bool clearError = false,
  }) {
    return FamilyState(
      isLoading: isLoading ?? this.isLoading,
      family: family ?? this.family,
      error: clearError ? null : error ?? this.error,
    );
  }
}
```

### 5. Route Factory Pattern

**Feature-based routing:**
```dart
class FamilyRouteFactory implements AppRouteFactory {
  @override
  List<RouteBase> get routes => [
    GoRoute(
      path: AppRoutes.family,
      name: 'family',
      pageBuilder: (context, state) => const NoTransitionPage(
        child: FamilyPage(),
      ),
      routes: [
        GoRoute(
          path: '/members',
          name: 'family_members',
          pageBuilder: (context, state) => const NoTransitionPage(
            child: FamilyMembersPage(),
          ),
        ),
      ],
    ),
  ];
}
```

## EduLift-Specific Patterns

### Magic Link Authentication
```dart
@riverpod
class MagicLinkNotifier extends _$MagicLinkNotifier {
  Future<void> sendMagicLink(String email) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      await _authService.sendMagicLink(email);
      return true;
    });
  }

  Future<void> verifyMagicLink(String token) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      await _authService.verifyMagicLink(token);
      return ref.invalidateSelf();
    });
  }
}
```

### Family Invitation Flow
```dart
@riverpod
class FamilyInvitationNotifier extends _$FamilyInvitationNotifier {
  Future<String> generateInvitationCode() async {
    return await _networkErrorHandler.executeRepositoryOperation(
      () => _invitationRepository.generateCode(),
      operationName: 'invitation.generateCode',
      strategy: CacheStrategy.networkOnly,
    );
  }
}
```

## Common Development Workflows

### Adding New Screen/Feature

1. **Create feature structure:**
   ```bash
   mkdir -p lib/features/new_feature/{presentation/{providers,widgets,pages,routing},domain/{entities,repositories,usecases,services},data/{repositories,datasources,models}}
   ```

2. **Implement domain layer first:**
   - Define entities in `domain/entities/`
   - Create repository interfaces in `domain/repositories/`
   - Implement use cases in `domain/usecases/`

3. **Implement data layer:**
   - Create DTOs in `data/models/`
   - Implement repositories in `data/repositories/`
   - Create datasources in `data/datasources/`

4. **Implement presentation layer:**
   - Create Riverpod providers in `presentation/providers/`
   - Build reusable widgets in `presentation/widgets/`
   - Implement screens in `presentation/pages/`
   - Add routing in `presentation/routing/`

5. **Add comprehensive tests**

6. **Update dependency injection in `lib/core/di/`**

### Internationalization

Always add strings to localization files:

```dart
// In widget
Text(AppLocalizations.of(context).welcomeMessage)
```

```json
// lib/l10n/app_en.arb
{
  "welcomeMessage": "Welcome to EduLift"
}

// lib/l10n/app_fr.arb
{
  "welcomeMessage": "Bienvenue sur EduLift"
}
```

### Accessibility Standards

Follow WCAG 2.1 AA guidelines:

- Touch targets minimum 48dp
- Semantic labels for screen readers
- Proper contrast ratios (4.5:1 minimum)
- Support for reduced motion
- Keyboard navigation support

```dart
Semantics(
  button: true,
  label: AppLocalizations.of(context).addFamilyMember,
  child: ElevatedButton(
    key: Key('add_family_member_button'),
    onPressed: () => _showAddMemberDialog(),
    child: Icon(Icons.add),
  ),
)
```

## Performance Guidelines

### Riverpod Optimization

```dart
// Use .autoDispose for providers that aren't needed forever
@riverpod
Future<User> currentUser(CurrentUserRef ref) async {
  ref.onDispose(() => /* cleanup */);
  return repository.getCurrentUser();
}

// Use select for watching specific values
final userNameProvider = Provider<String>((ref) {
  return ref.watch(userProvider.select((user) => user.name));
});
```

### Widget Optimization

```dart
// Use const constructors where possible
const MyAppBar extends StatelessWidget {
  final String title;

  const MyAppBar({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    return AppBar(title: Text(title));
  }
}

// Use memoization for expensive computations
class ExpensiveWidget extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final expensiveValue = useMemoized(() => computeExpensiveValue());
    return Text(expensiveValue);
  }
}
```

## Development Commands

**Essential commands for EduLift development:**

```bash
# Run app
flutter run

# Run with specific device
flutter run -d <device_name>

# Analyze code
flutter analyze

# Run tests
flutter test
flutter test test/unit/
flutter test test/presentation/

# Run tests with coverage
flutter test --coverage

# Generate code (freezed, json_serializable, riverpod)
flutter packages pub run build_runner build --delete-conflicting-outputs

# E2E tests with Patrol
patrol test integration_test/

# Build for release
flutter build apk --release
flutter build ios --release
```

## Error Handling Patterns

Use consistent error handling:

```dart
// Domain failures
abstract class Failure {
  const Failure();
}

class FamilyFailure extends Failure {
  final String message;
  final FamilyErrorType type;

  const FamilyFailure(this.message, this.type);
}

// Repository implementation
@override
Future<Family> getFamily(String id) async {
  try {
    final familyDto = await remoteDatasource.getFamily(id);
    await localDatasource.cacheFamily(familyDto);
    return FamilyMapper.dtoToDomain(familyDto);
  } on DioException catch (e) {
    throw FamilyFailure.fromDioException(e);
  } catch (e) {
    throw const FamilyFailure('Unknown error occurred', FamilyErrorType.unknown);
  }
}
```

## Resources

### scripts/
Utility scripts for common development tasks:

- `scripts/generate_feature.sh` - Scaffolds new feature structure
- `scripts/run_tests.sh` - Runs tests with proper configuration
- `scripts/analyze_coverage.sh` - Analyzes test coverage reports

### references/
Essential documentation:

- `references/architecture_patterns.md` - Clean Architecture implementation details
- `references/riverpod_patterns.md` - State management best practices
- `references/api_specifications.md` - Backend API contracts
- `references/accessibility_guidelines.md` - WCAG compliance requirements
- `references/testing_strategies.md` - Testing approaches and standards

### assets/
Reusable templates and resources:

- `assets/feature_template/` - Boilerplate code structure for new features
- `assets/widget_templates/` - Common UI component patterns
- `assets/test_templates/` - Standard test file structures
