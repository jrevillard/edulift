# EduLift Riverpod Patterns

## State Management Best Practices

EduLift uses Riverpod 2.x for state management, providing compile-time safety and excellent performance.

## Provider Types and Patterns

### 1. AsyncNotifierProvider
**Use case**: Managing asynchronous state with loading/error states

```dart
@riverpod
class FamilyNotifier extends _$FamilyNotifier {
  @override
  Future<Family?> build() async {
    ref.onDispose(() {
      // Cleanup resources
    });
    return _repository.getCurrentFamily();
  }

  Future<void> addMember(Member member) async {
    // Set loading state
    state = const AsyncValue.loading();

    // Execute operation with error handling
    state = await AsyncValue.guard(() async {
      final currentFamily = state.value ?? throw Exception('No family loaded');
      await _repository.addMember(currentFamily.id, member);
      return _repository.getCurrentFamily(); // Refresh data
    });
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _repository.getCurrentFamily());
  }
}
```

**Usage in Widget:**
```dart
ConsumerWidget(
  builder: (context, ref, child) {
    final familyState = ref.watch(familyNotifierProvider);

    return familyState.when(
      data: (family) => FamilyView(family: family),
      loading: () => const CircularProgressIndicator(),
      error: (error, stack) => ErrorDisplay(
        error: error,
        onRetry: () => ref.read(familyNotifierProvider.notifier).refresh(),
      ),
    );
  },
)
```

### 2. NotifierProvider
**Use case**: Simple synchronous state management

```dart
@riverpod
class ThemeNotifier extends _$ThemeNotifier {
  @override
  AppTheme build() {
    return AppTheme.system();
  }

  void setTheme(AppTheme theme) {
    state = theme;
    _preferences.setTheme(theme);
  }

  void toggleDarkMode() {
    state = state.isDark ? AppTheme.light() : AppTheme.dark();
  }
}
```

### 3. Provider (Computed)
**Use case**: Derived state, computations

```dart
// Simple computation
final familyNameProvider = Provider<String>((ref) {
  final family = ref.watch(familyNotifierProvider);
  return family.value?.name ?? 'No Family';
});

// Complex computation with memoization
final memberStatsProvider = Provider<MemberStats>((ref) {
  final family = ref.watch(familyNotifierProvider);
  return MemberStats.calculate(family.value);
});

// Watching specific value
final canAddMemberProvider = Provider<bool>((ref) {
  final family = ref.watch(familyNotifierProvider.select((family) => family.value));
  return family?.canAddMember() ?? false;
});
```

### 4. FutureProvider
**Use case**: Simple one-time async operations

```dart
@riverpod
Future<User> currentUser(CurrentUserRef ref) async {
  final token = await ref.watch(tokenProvider.future);
  return await _authService.getUser(token);
}
```

### 5. StreamProvider
**Use case**: Real-time data streams

```dart
@riverpod
Stream<List<Message>> messages(MessagesRef ref, String chatId) {
  final firestore = ref.watch(firestoreProvider);
  return firestore
      .collection('chats/$chatId/messages')
      .orderBy('timestamp')
      .snapshots()
      .map((snapshot) => snapshot.docs.map((doc) => Message.fromFirestore(doc)).toList());
}
```

## Advanced Patterns

### Auto-Dispose Providers
For providers that should be cleaned up when not in use:

```dart
@riverpod
Future<VehicleDetails> vehicleDetails(VehicleDetailsRef ref, String vehicleId) async {
  ref.onDispose(() {
    // Cancel any ongoing operations
  });

  return await _vehicleService.getVehicleDetails(vehicleId);
}
```

### Provider Families
For parameterized providers:

```dart
@riverpod
Future<Vehicle> vehicle(VehicleRef ref, String vehicleId) async {
  return await _repository.getVehicle(vehicleId);
}

// Usage
final vehicle = ref.watch(vehicleProvider(vehicleId));
```

### Provider Overrides for Testing
```dart
// Test setup
final container = ProviderContainer(
  overrides: [
    familyRepositoryProvider.overrideWithValue(mockFamilyRepository),
    networkInfoProvider.overrideWithValue(MockNetworkInfo()),
  ],
);

// Widget testing
testWidgets('FamilyPage shows loading state', (tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        familyNotifierProvider.overrideWith((ref) => MockFamilyNotifier()),
      ],
      child: MaterialApp(home: FamilyPage()),
    ),
  );
});
```

## Performance Optimization

### 1. Use select() for Partial Watching
```dart
// Bad - rebuilds when any family property changes
final family = ref.watch(familyNotifierProvider);

// Good - only rebuilds when name changes
final familyName = ref.watch(familyNotifierProvider.select((family) => family.value?.name));
```

### 2. Lazy Provider Creation
```dart
@riverpod
ExpensiveService expensiveService(ExpensiveServiceRef ref) {
  // Only created when actually watched
  return ExpensiveService();
}
```

### 3. Provider Caching
```dart
@riverpod
Future<ExpensiveData> expensiveData(ExpensiveDataRef ref) async {
  // Cached until manually invalidated
  ref.cacheTime = Duration(minutes: 5);
  return await computeExpensiveOperation();
}
```

## Error Handling Patterns

### 1. Centralized Error Handling
```dart
@riverpod
class FamilyNotifier extends _$FamilyNotifier {
  @override
  Future<Family?> build() async {
    return await _executeWithErrorHandling(() => _repository.getCurrentFamily());
  }

  Future<void> addMember(Member member) async {
    state = const AsyncValue.loading();
    state = await _executeWithErrorHandling(() async {
      final family = state.value ?? throw Exception('No family');
      await _repository.addMember(family.id, member);
      return _repository.getCurrentFamily();
    });
  }

  Future<T> _executeWithErrorHandling<T>(Future<T> Function() operation) async {
    try {
      return await operation();
    } on NetworkException catch (e) {
      throw FamilyFailure.network(e.message);
    } on ValidationException catch (e) {
      throw FamilyFailure.validation(e.message);
    } catch (e) {
      throw FamilyFailure.unknown(e.toString());
    }
  }
}
```

### 2. Retry Logic
```dart
@riverpod
Future<Data> resilientData(ResilientDataRef ref) async {
  return await ref.retryAsync(
    () => _repository.getData(),
    retryCount: 3,
    delay: Duration(seconds: 1),
  );
}
```

## Best Practices

1. **Keep providers focused**: Single responsibility principle
2. **Use proper types**: Leverage type safety
3. **Handle errors gracefully**: Always handle loading/error states
4. **Optimize rebuilds**: Use select() and proper provider design
5. **Test thoroughly**: Mock providers for isolated testing
6. **Document providers**: Explain purpose and usage
7. **Use autoDispose**: Clean up unused providers
8. **Separate concerns**: Keep business logic out of UI providers