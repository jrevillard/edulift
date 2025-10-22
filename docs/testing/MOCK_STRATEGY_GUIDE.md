# Flutter Mock Strategy Guide (2025)

This guide outlines our systematic approach to mock generation and repository testing, ensuring 0 compilation errors and maintainable test infrastructure.

## Overview

Our mock strategy provides:
- Centralized mock generation with build_runner
- Repository-specific mock factories
- Type-safe Result pattern integration
- Systematic error handling patterns

## Architecture

### 1. Centralized Mock Generation

All mocks are generated from a single source file:

```dart
// test/test_mocks/generated_mocks.dart
@GenerateNiceMocks([
  MockSpec<FamilyMembersRepository>(),
  MockSpec<GroupRepository>(), 
  MockSpec<InvitationRepository>(),
  // ... all repository interfaces
])
import 'generated_mocks.dart';
```

**Benefits:**
- Single build_runner execution for all mocks
- Consistent mock generation patterns
- Centralized dependency management

### 2. Repository Mock Factories

Each repository has a dedicated mock factory:

```dart
// test/test_mocks/family_members_repository_mock_factory.dart
class FamilyMembersRepositoryMockFactory {
  static MockFamilyMembersRepository createFamilyMembersRepository({
    bool shouldSucceed = true,
    List<FamilyMember>? mockMembers,
  }) {
    final mock = MockFamilyMembersRepository();
    // Configure mock behavior
    return mock;
  }
}
```

## Implementation Patterns

### 1. Result Pattern Integration

Our mocks properly integrate with the Result<T, E> pattern:

```dart
// ✅ CORRECT: Use named parameters for ApiFailure
when(mock.getFamilyMembers(any)).thenAnswer((_) async => 
  Result.err(ApiFailure(message: 'Family members fetch failed')));

// ❌ WRONG: Positional parameters
when(mock.getFamilyMembers(any)).thenAnswer((_) async => 
  Result.err(ApiFailure('Family members fetch failed')));
```

### 2. Entity Constructor Patterns

Mock entities use proper constructor patterns:

```dart
// ✅ CORRECT: Use proper entity constructors
static FamilyMember _createMockFamilyMember() {
  return FamilyMember(
    id: 'test-member-id',
    userId: 'test-user-id',
    familyId: 'test-family-id',
    role: FamilyRole.admin, // Use enum, not string
    joinedAt: DateTime.fromMillisecondsSinceEpoch(1640995200000),
    userName: 'Test Member',
    userEmail: 'member@example.com',
  );
}

// ❌ WRONG: Incorrect constructor parameters
static FamilyMember _createMockFamilyMember() {
  return FamilyMember(
    id: 'test-member-id',
    role: 'admin', // String instead of enum
    name: 'Test Member', // Non-existent parameter
    createdAt: DateTime.now(), // Non-existent parameter
  );
}
```

### 3. Method Signature Matching

Mock methods must match repository interface signatures exactly:

```dart
// Repository interface:
abstract class FamilyMembersRepository {
  Future<Result<List<FamilyMember>, Failure>> getFamilyMembers(String familyId);
  Future<Result<FamilyMember, Failure>> updateFamilyMember(
    String familyId,
    String memberId, 
    Map<String, dynamic> updateData,
  );
}

// ✅ CORRECT: Match exact signatures
when(mock.getFamilyMembers(any)).thenAnswer((_) async => Result.ok(members));
when(mock.updateFamilyMember(any, any, any)).thenAnswer((_) async => Result.ok(member));

// ❌ WRONG: Incorrect parameter count
when(mock.updateFamilyMember(any, any, role: anyNamed('role'))).thenAnswer(...);
```

## Factory Implementation Guide

### 1. Basic Factory Structure

```dart
class RepositoryMockFactory {
  static MockRepository createRepository({
    bool shouldSucceed = true,
    List<Entity>? mockEntities,
  }) {
    final mock = MockRepository();
    final entities = mockEntities ?? [_createMockEntity()];
    
    if (shouldSucceed) {
      // Configure success scenarios
      _configureSuccessScenarios(mock, entities);
    } else {
      // Configure failure scenarios  
      _configureFailureScenarios(mock);
    }
    
    return mock;
  }
  
  static void _configureSuccessScenarios(MockRepository mock, List<Entity> entities) {
    when(mock.getEntities()).thenAnswer((_) async => Result.ok(entities));
    when(mock.createEntity(any)).thenAnswer((_) async => Result.ok(entities.first));
    when(mock.updateEntity(any, any)).thenAnswer((_) async => Result.ok(entities.first));
    when(mock.deleteEntity(any)).thenAnswer((_) async => Result.ok(()));
  }
  
  static void _configureFailureScenarios(MockRepository mock) {
    when(mock.getEntities()).thenAnswer((_) async => 
      Result.err(ApiFailure(message: 'Failed to fetch entities')));
    when(mock.createEntity(any)).thenAnswer((_) async => 
      Result.err(ApiFailure(message: 'Failed to create entity')));
  }
  
  static Entity _createMockEntity() {
    return Entity(
      id: 'test-entity-id',
      // Use proper constructor parameters
    );
  }
}
```

### 2. Advanced Configuration

```dart
class AdvancedRepositoryMockFactory {
  static MockRepository createWithCustomBehavior({
    Map<String, dynamic>? customResponses,
    Duration? delay,
  }) {
    final mock = MockRepository();
    
    // Custom response configuration
    if (customResponses != null) {
      customResponses.forEach((method, response) {
        _configureCustomResponse(mock, method, response);
      });
    }
    
    // Simulate network delay
    if (delay != null) {
      _addDelay(mock, delay);
    }
    
    return mock;
  }
  
  static void _configureCustomResponse(MockRepository mock, String method, dynamic response) {
    switch (method) {
      case 'getEntities':
        when(mock.getEntities()).thenAnswer((_) async => response);
        break;
      // Handle other methods...
    }
  }
}
```

## Common Patterns

### 1. Success/Failure Toggle Pattern

```dart
static MockRepository createRepository({bool shouldSucceed = true}) {
  final mock = MockRepository();
  
  if (shouldSucceed) {
    when(mock.getData()).thenAnswer((_) async => Result.ok(mockData));
  } else {
    when(mock.getData()).thenAnswer((_) async => 
      Result.err(ApiFailure(message: 'Operation failed')));
  }
  
  return mock;
}
```

### 2. Entity Customization Pattern

```dart
static MockRepository createRepository({
  List<Entity>? customEntities,
}) {
  final mock = MockRepository();
  final entities = customEntities ?? [_createDefaultEntity()];
  
  when(mock.getEntities()).thenAnswer((_) async => Result.ok(entities));
  return mock;
}
```

### 3. Method-Specific Configuration Pattern

```dart
static MockRepository createWithSpecificBehavior({
  bool getSuccess = true,
  bool createSuccess = true,
  bool updateSuccess = true,
}) {
  final mock = MockRepository();
  
  // Configure each method independently
  if (getSuccess) {
    when(mock.getEntities()).thenAnswer((_) async => Result.ok(mockEntities));
  } else {
    when(mock.getEntities()).thenAnswer((_) async => 
      Result.err(ApiFailure(message: 'Get failed')));
  }
  
  if (createSuccess) {
    when(mock.createEntity(any)).thenAnswer((_) async => Result.ok(mockEntity));
  } else {
    when(mock.createEntity(any)).thenAnswer((_) async => 
      Result.err(ApiFailure(message: 'Create failed')));
  }
  
  return mock;
}
```

## Error Prevention Checklist

### ✅ Compilation Error Prevention

1. **Entity Constructors**
   - [ ] Use exact constructor parameters from entity definition
   - [ ] Use proper enum types (not strings)
   - [ ] Include all required parameters
   - [ ] Use correct parameter names

2. **Method Signatures**
   - [ ] Match repository interface exactly
   - [ ] Use correct parameter count in `when()` calls
   - [ ] Use `any` for parameter matching, not specific values

3. **Result Pattern**
   - [ ] Use `Result.ok(value)` with single parameter
   - [ ] Use `Result.err(failure)` with single parameter
   - [ ] Use named parameters for failure constructors

4. **Import Statements**
   - [ ] Import entity classes being mocked
   - [ ] Import repository interfaces
   - [ ] Import generated mocks file

### ✅ Runtime Error Prevention

1. **Mockito Setup**
   - [ ] Use proper `when().thenAnswer()` syntax
   - [ ] Provide dummy values when needed
   - [ ] Handle async methods with `(_) async =>`

2. **Type Safety**
   - [ ] Match return types exactly
   - [ ] Use proper generic types in Result<T, E>
   - [ ] Handle nullable vs non-nullable types

## Testing Integration

### 1. Basic Usage in Tests

```dart
testWidgets('Repository integration test', (tester) async {
  final mockRepo = FamilyMembersRepositoryMockFactory.createFamilyMembersRepository(
    shouldSucceed: true,
  );
  
  // Use mock in widget/service
  final service = FamilyService(mockRepo);
  final result = await service.getMembers('family-id');
  
  expect(result.isSuccess, true);
});
```

### 2. Failure Scenario Testing

```dart
testWidgets('Repository failure handling', (tester) async {
  final mockRepo = FamilyMembersRepositoryMockFactory.createFamilyMembersRepository(
    shouldSucceed: false,
  );
  
  final service = FamilyService(mockRepo);
  final result = await service.getMembers('family-id');
  
  expect(result.isError, true);
  expect(result.error, isA<ApiFailure>());
});
```

### 3. Custom Data Testing

```dart
testWidgets('Custom data scenarios', (tester) async {
  final customMembers = [
    FamilyMember(
      id: 'member-1',
      role: FamilyRole.admin,
      // ... other required fields
    ),
  ];
  
  final mockRepo = FamilyMembersRepositoryMockFactory.createFamilyMembersRepository(
    mockMembers: customMembers,
  );
  
  // Test with custom data
});
```

## Build and Generation

### 1. Generate Mocks

```bash
# Generate all mocks
dart run build_runner build --delete-conflicting-outputs

# Watch for changes
dart run build_runner watch --delete-conflicting-outputs
```

### 2. Verify No Compilation Errors

```bash
# Check specific mock factories
dart analyze test/test_mocks/family_members_repository_mock_factory.dart --no-fatal-warnings

# Check all mock factories
dart analyze test/test_mocks/ --no-fatal-warnings
```

### 3. Integration Testing

```bash
# Test mock factories can be instantiated
flutter test test/test_mocks/ --plain-name "mock creation"
```

## Troubleshooting

### Common Compilation Errors

1. **"Too many positional arguments"**
   - Check Result.ok() and Result.err() usage
   - Verify ApiFailure uses named parameters

2. **"The constructor being called isn't a const constructor"**
   - Remove `const` from entity constructors with non-const fields
   - DateTime constructors are not const

3. **"Undefined method"**
   - Verify repository interface method names
   - Check generated mocks file is up to date

4. **"Missing required argument"**
   - Check entity constructor for required parameters
   - Verify all required fields are provided

### Runtime Errors

1. **"MissingDummyValueError"**
   - Normal for mock factories - dummy values handled by test framework
   - Not a compilation error, can be ignored for factory verification

2. **"Null check operator used on a null value"**
   - Ensure all required entity fields are provided
   - Check for proper nullable type handling

## Best Practices

1. **One Factory Per Repository**
   - Each repository gets its own mock factory
   - Clear separation of concerns
   - Easy to maintain and debug

2. **Consistent Naming**
   - Use `create{RepositoryName}` method names
   - Include `shouldSucceed` parameter by default
   - Provide entity customization options

3. **Entity Builders**
   - Create helper methods for mock entities
   - Use realistic test data
   - Include all required fields

4. **Documentation**
   - Document mock behavior in comments
   - Include usage examples
   - Document any special configuration

This guide ensures reliable, maintainable mock infrastructure that supports robust testing without compilation errors.