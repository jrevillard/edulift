# EduLift Architecture Patterns

## Clean Architecture Implementation

EduLift follows Clean Architecture principles with feature-first organization. This ensures maintainability, testability, and separation of concerns.

### Layer Responsibilities

#### 1. Domain Layer (`lib/features/[feature]/domain/`)
**Purpose**: Core business logic and rules, independent of external dependencies

**Components**:
- **Entities**: Core business objects with behavior
  ```dart
  class Family {
    final String id;
    final String name;
    final List<Member> members;

    // Domain logic
    bool canAddMember() => members.length < maxMembers;
  }
  ```

- **Repositories**: Abstract interfaces for data access
  ```dart
  abstract class FamilyRepository {
    Future<Family> getFamily(String id);
    Future<void> saveFamily(Family family);
    Stream<List<Family>> getFamiliesStream();
  }
  ```

- **Use Cases**: Application-specific business operations
  ```dart
  class AddFamilyMemberUseCase {
    AddFamilyMemberUseCase(this._repository);

    final FamilyRepository _repository;

    Future<void> execute(Family family, Member member) async {
      if (!family.canAddMember()) {
        throw FamilyCapacityExceeded();
      }
      await _repository.addMember(family.id, member);
    }
  }
  ```

- **Services**: Domain services for complex business logic
- **Failures**: Domain-specific error types

#### 2. Data Layer (`lib/features/[feature]/data/`)
**Purpose**: Data access implementation, external dependencies

**Components**:
- **Models**: Data transfer objects for serialization
  ```dart
  @freezed
  class FamilyDto with _$FamilyDto {
    const factory FamilyDto({
      required String id,
      required String name,
      required List<MemberDto> members,
    }) = _FamilyDto;

    factory FamilyDto.fromJson(Map<String, dynamic> json) =>
        _$FamilyDtoFromJson(json);
  }
  ```

- **Repositories**: Concrete implementations of domain repositories
  ```dart
  class FamilyRepositoryImpl implements FamilyRepository {
    FamilyRepositoryImpl({
      required FamilyRemoteDatasource remote,
      required FamilyLocalDatasource local,
      required NetworkInfo networkInfo,
    });

    @override
    Future<Family> getFamily(String id) async {
      try {
        final dto = await remote.getFamily(id);
        await local.cacheFamily(dto);
        return FamilyMapper.dtoToDomain(dto);
      } on NetworkException {
        return local.getCachedFamily(id);
      }
    }
  }
  ```

- **Data Sources**: External data access (API, local storage)
  ```dart
  abstract class FamilyRemoteDatasource {
    Future<FamilyDto> getFamily(String id);
    Future<List<FamilyDto>> getFamilies();
  }
  ```

#### 3. Presentation Layer (`lib/features/[feature]/presentation/`)
**Purpose**: UI components, state management, user interactions

**Components**:
- **Providers**: Riverpod state management
  ```dart
  @riverpod
  class FamilyNotifier extends _$FamilyNotifier {
    @override
    Future<Family?> build() async {
      return ref.watch(getFamilyUseCaseProvider).execute('current');
    }

    Future<void> addMember(Member member) async {
      state = const AsyncValue.loading();
      state = await AsyncValue.guard(() async {
        final family = state.value!;
        await ref.watch(addFamilyMemberUseCaseProvider).execute(family, member);
        return ref.watch(getFamilyUseCaseProvider).execute('current');
      });
    }
  }
  ```

- **Pages**: Screen implementations
- **Widgets**: Reusable UI components
- **Routing**: Navigation logic

### Dependency Flow

```
Presentation → Domain ← Data
     ↓            ↑     ↓
   State       Logic  External
 Management    Rules  Dependencies
```

### Key Principles

1. **Dependency Inversion**: High-level modules don't depend on low-level modules
2. **Single Responsibility**: Each class has one reason to change
3. **Open/Closed**: Open for extension, closed for modification
4. **Interface Segregation**: Clients don't depend on unused interfaces
5. **Dependency Injection**: All dependencies provided externally

### Testing Strategy

- **Domain Tests**: Pure unit tests, no external dependencies
- **Data Tests**: Repository implementations with mocks
- **Presentation Tests**: Widget tests with provider overrides

### Feature Organization Rules

1. Each feature is self-contained with all three layers
2. Cross-feature communication through domain entities only
3. Shared code in `lib/core/`
4. Navigation handled by Go Router with feature-specific route factories