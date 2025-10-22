# NetworkErrorHandler Pattern - EduLift

## Overview

The NetworkErrorHandler is the unified pattern for all network operations in EduLift, providing consistent error handling, caching strategies, and retry logic across all features.

## Core Pattern

```dart
// In any repository
Future<T> _executeWithErrorHandling<T>(
  Future<T> Function() operation,
  String operationName, {
  CacheStrategy strategy = CacheStrategy.networkFirst,
  RetryConfig? config,
}) async {
  return await _networkErrorHandler.executeRepositoryOperation(
    operation,
    operationName: operationName,
    strategy: strategy,
    serviceName: 'feature_name',
    config: config ?? RetryConfig.quick,
    onSuccess: (data) async {
      // Optional: cache success data
      if (strategy != CacheStrategy.networkOnly) {
        await _localDataSource.cache(data);
      }
    },
  );
}
```

## Usage Examples

### Family Repository
```dart
@override
Future<Family> getCurrentFamily() async {
  return await _executeWithErrorHandling(
    () => _remoteDataSource.getCurrentFamily(),
    'family.getCurrentFamily',
    strategy: CacheStrategy.networkFirst,
  );
}

@override
Future<void> saveFamily(Family family) async {
  await _executeWithErrorHandling(
    () => _remoteDataSource.saveFamily(FamilyMapper.toDto(family)),
    'family.saveFamily',
    strategy: CacheStrategy.networkOnly,
    config: RetryConfig.standard,
  );
}
```

### Schedule Repository
```dart
@override
Future<List<TimeSlot>> getTimeSlots(String scheduleId) async {
  return await _executeWithErrorHandling(
    () => _remoteDataSource.getTimeSlots(scheduleId),
    'schedule.getTimeSlots',
    strategy: CacheStrategy.staleWhileRevalidate,
  );
}
```

## Cache Strategies

- **networkOnly**: Always fetch from network, no caching
- **cacheOnly**: Use only cached data, no network requests
- **networkFirst**: Try network, fallback to cache on error
- **staleWhileRevalidate**: Return cache immediately, refresh in background

## Error Handling

All network errors are automatically handled:
- Network connectivity issues
- API server errors
- Authentication failures
- Timeout errors

The NetworkErrorHandler maps these to domain-specific failures and provides consistent error messages to the UI layer.