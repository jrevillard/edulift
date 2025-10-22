# Flutter Error Handling Best Practices - Extracted from Web Frontend

## Overview

This document provides actionable best practices for Flutter error handling, extracted from successful patterns in the EduLift web frontend. These practices are designed to be directly implementable in the Flutter mobile app to achieve cross-platform consistency.

## Core Principles from Web Implementation

### 1. Multi-Layered Error Architecture
The web frontend uses a clear 3-tier separation that Flutter should adopt:

```dart
// Repository Layer - HTTP error processing
class ApiClient {
  Future<Result<T, ApiFailure>> request<T>(
    String endpoint,
    T Function(Map<String, dynamic>) fromJson,
  ) async {
    try {
      final response = await dio.get(endpoint);
      return Result.ok(fromJson(response.data['data']));
    } on DioException catch (e) {
      return Result.err(_mapDioError(e));
    }
  }

  ApiFailure _mapDioError(DioException error) {
    final statusCode = error.response?.statusCode ?? 0;
    final message = error.response?.data?['error'] ?? error.message;
    
    switch (statusCode) {
      case 400:
        if (message?.contains('invite') == true || message?.contains('code') == true) {
          return ApiFailure.badRequest(
            message: 'Invalid group invite code. Please check the code and try again.'
          );
        }
        return ApiFailure.badRequest(message: message);
      case 401:
        return ApiFailure.unauthorized();
      case 403:
        return ApiFailure.forbidden(message: message);
      case 404:
        return ApiFailure.notFound();
      case 409:
        return ApiFailure.conflict(message: message);
      case 500:
      case 502:
      case 503:
        return ApiFailure.serverError(message: message);
      default:
        if (error.type == DioExceptionType.connectionTimeout ||
            error.type == DioExceptionType.receiveTimeout) {
          return ApiFailure.timeout();
        }
        if (error.type == DioExceptionType.connectionError) {
          return ApiFailure.noConnection();
        }
        return ApiFailure.network(message: message);
    }
  }
}
```

### 2. Provider Layer - State Management with Error Propagation

```dart
// Enhanced provider with web-inspired error handling
class FamilyProvider extends StateNotifier<FamilyState> {
  final FamilyRepository _familyRepository;
  final AppStateNotifier _appStateNotifier;

  FamilyProvider(this._familyRepository, this._appStateNotifier) 
    : super(const FamilyState());

  Future<void> createFamily(String name) async {
    // Set loading state and clear previous errors
    state = state.copyWith(
      isLoading: true, 
      error: null,
      operation: FamilyOperation.creating
    );
    _appStateNotifier.setFeatureLoading('family_create', true);

    try {
      final result = await _familyRepository.createFamily(name: name);
      
      result.when(
        ok: (family) {
          state = state.copyWith(
            family: family,
            isLoading: false,
            operation: null,
            requiresFamily: false, // Family requirement fulfilled
          );
          _appStateNotifier.setError(null);
          _appStateNotifier.showSuccess('Family created successfully');
        },
        err: (failure) {
          final errorMessage = _mapFamilyError(failure, FamilyOperation.creating);
          state = state.copyWith(
            isLoading: false,
            error: errorMessage,
            operation: null,
          );
          _appStateNotifier.setError(errorMessage);
        },
      );
    } catch (e, stackTrace) {
      AppLogger.error('Unexpected error in createFamily', e, stackTrace);
      const errorMessage = 'Failed to create family. Please try again.';
      state = state.copyWith(
        isLoading: false,
        error: errorMessage,
        operation: null,
      );
      _appStateNotifier.setError(errorMessage);
    } finally {
      _appStateNotifier.setFeatureLoading('family_create', false);
    }
  }

  String _mapFamilyError(ApiFailure failure, FamilyOperation operation) {
    // Context-aware error mapping inspired by web implementation
    if (failure.statusCode == 403) {
      switch (operation) {
        case FamilyOperation.creating:
          return 'You do not have permission to create a family.';
        case FamilyOperation.inviting:
          return 'You do not have permission to invite members. Only family admins can invite.';
        case FamilyOperation.removingMember:
          return 'You do not have permission to remove members. Only family admins can remove members.';
        default:
          return 'You do not have permission to perform this action.';
      }
    }

    if (failure.statusCode == 409) {
      if (failure.message?.contains('already in family') == true) {
        return 'You are already part of a family. You must leave your current family first.';
      }
      if (failure.message?.contains('family full') == true) {
        return 'This family has reached the maximum number of members (6).';
      }
      return 'This action conflicts with existing data.';
    }

    // Network and server errors
    if (failure.isRetryable) {
      return '${failure.message ?? 'Network error'}. Please try again.';
    }

    return failure.message ?? 'An unexpected error occurred.';
  }
}

enum FamilyOperation { creating, joining, inviting, removingMember, updating }
```

### 3. UI Layer - Rich Error Presentation

```dart
// Error display widget inspired by web's BackendConnectionAlert
class ConnectionErrorBanner extends StatelessWidget {
  final VoidCallback? onRetry;
  final String? message;

  const ConnectionErrorBanner({
    Key? key,
    this.onRetry,
    this.message,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppStateProvider>();
    
    if (appState.isConnected) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(16),
      color: Theme.of(context).errorColor.withOpacity(0.1),
      child: Row(
        children: [
          Icon(
            Icons.error_outline,
            color: Theme.of(context).errorColor,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Unable to connect to server',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: Theme.of(context).errorColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  message ?? 'Please check your connection and try again.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).errorColor.withOpacity(0.8),
                  ),
                ),
              ],
            ),
          ),
          if (onRetry != null) ...[
            const SizedBox(width: 12),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Theme.of(context).errorColor,
                side: BorderSide(color: Theme.of(context).errorColor),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
```

### 4. Form Error Handling Pattern

```dart
// Form error handling inspired by web children/vehicles pages
class VehicleFormWidget extends StatefulWidget {
  final Vehicle? vehicle;
  final VoidCallback? onSuccess;

  const VehicleFormWidget({Key? key, this.vehicle, this.onSuccess}) : super(key: key);

  @override
  State<VehicleFormWidget> createState() => _VehicleFormWidgetState();
}

class _VehicleFormWidgetState extends State<VehicleFormWidget> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _capacityController = TextEditingController();
  String? _formError;
  bool _isSubmitting = false;

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Show form-level error
          if (_formError != null)
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(context).errorColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: Theme.of(context).errorColor.withOpacity(0.3),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.error_outline,
                    color: Theme.of(context).errorColor,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _formError!,
                      style: TextStyle(
                        color: Theme.of(context).errorColor,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ],
              ),
            ),

          TextFormField(
            controller: _nameController,
            decoration: const InputDecoration(
              labelText: 'Vehicle Name',
              hintText: 'Enter vehicle name',
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Vehicle name is required';
              }
              if (value.trim().length > 100) {
                return 'Name must be less than 100 characters';
              }
              return null;
            },
          ),

          const SizedBox(height: 16),

          TextFormField(
            controller: _capacityController,
            decoration: const InputDecoration(
              labelText: 'Capacity',
              hintText: 'Enter number of seats',
            ),
            keyboardType: TextInputType.number,
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Capacity is required';
              }
              final capacity = int.tryParse(value);
              if (capacity == null) {
                return 'Please enter a valid number';
              }
              if (capacity < 1 || capacity > 50) {
                return 'Capacity must be between 1 and 50';
              }
              return null;
            },
          ),

          const SizedBox(height: 24),

          ElevatedButton(
            onPressed: _isSubmitting ? null : _handleSubmit,
            child: _isSubmitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(widget.vehicle != null ? 'Update Vehicle' : 'Add Vehicle'),
          ),
        ],
      ),
    );
  }

  Future<void> _handleSubmit() async {
    // Clear previous form error
    setState(() {
      _formError = null;
    });

    if (!_formKey.currentState!.validate()) {
      return;
    }

    // Prevent multiple submissions
    if (_isSubmitting) return;

    setState(() {
      _isSubmitting = true;
    });

    try {
      final vehicleProvider = context.read<VehicleProvider>();
      final name = _nameController.text.trim();
      final capacity = int.parse(_capacityController.text.trim());

      if (widget.vehicle != null) {
        await vehicleProvider.updateVehicle(
          vehicleId: widget.vehicle!.id,
          name: name,
          capacity: capacity,
        );
      } else {
        await vehicleProvider.addVehicle(
          name: name,
          capacity: capacity,
        );
      }

      // Check if operation was successful
      final state = vehicleProvider.state;
      if (state.error != null) {
        setState(() {
          _formError = _mapProviderErrorToFormError(state.error!);
        });
      } else {
        widget.onSuccess?.call();
      }
    } catch (e) {
      setState(() {
        _formError = 'An unexpected error occurred. Please try again.';
      });
    } finally {
      setState(() {
        _isSubmitting = false;
      });
    }
  }

  String _mapProviderErrorToFormError(String providerError) {
    // Map provider errors to user-friendly form messages
    // similar to web implementation
    if (providerError.contains('permission')) {
      return 'You do not have permission to perform this action. Only family admins can manage vehicles.';
    }
    if (providerError.contains('unauthorized')) {
      return 'You must be logged in to manage vehicles.';
    }
    if (providerError.contains('network') || providerError.contains('connection')) {
      return 'Network error. Please check your connection and try again.';
    }
    return providerError;
  }
}
```

### 5. Centralized Connection Management

```dart
// Connection management inspired by web's connectionStore
class ConnectionManager extends ChangeNotifier {
  ConnectionStatus _apiStatus = ConnectionStatus.connected;
  ConnectionStatus _wsStatus = ConnectionStatus.disconnected;
  String? _apiError;
  String? _wsError;
  final List<ConnectionError> _recentErrors = [];

  ConnectionStatus get apiStatus => _apiStatus;
  ConnectionStatus get wsStatus => _wsStatus;
  String? get apiError => _apiError;
  String? get wsError => _wsError;
  List<ConnectionError> get recentErrors => List.unmodifiable(_recentErrors);

  void setApiStatus(ConnectionStatus status, [String? error]) {
    _apiStatus = status;
    _apiError = error;

    if (error != null && status == ConnectionStatus.error) {
      _addError(ConnectionError(
        type: ConnectionErrorType.api,
        message: error,
        timestamp: DateTime.now(),
      ));
    }

    notifyListeners();
  }

  void setWsStatus(ConnectionStatus status, [String? error]) {
    _wsStatus = status;
    _wsError = error;

    if (error != null && status == ConnectionStatus.error) {
      _addError(ConnectionError(
        type: ConnectionErrorType.websocket,
        message: error,
        timestamp: DateTime.now(),
      ));
    }

    notifyListeners();
  }

  bool get isConnected => _apiStatus == ConnectionStatus.connected && 
                         _wsStatus == ConnectionStatus.connected;

  bool get hasConnectionIssues => 
    _apiStatus == ConnectionStatus.error || 
    _apiStatus == ConnectionStatus.disconnected ||
    _wsStatus == ConnectionStatus.error || 
    _wsStatus == ConnectionStatus.disconnected;

  String? get connectionMessage {
    // Priority: API errors > WebSocket errors (similar to web)
    if (_apiStatus == ConnectionStatus.error || 
        _apiStatus == ConnectionStatus.disconnected) {
      return _apiError ?? 'Unable to connect to server. Please ensure you have an internet connection.';
    }

    if (_wsStatus == ConnectionStatus.error || 
        _wsStatus == ConnectionStatus.disconnected) {
      return _wsError ?? 'Cannot connect to real-time updates. Changes may not appear immediately.';
    }

    if (_apiStatus == ConnectionStatus.connecting || 
        _wsStatus == ConnectionStatus.connecting) {
      return 'Connecting to server...';
    }

    return null;
  }

  void _addError(ConnectionError error) {
    _recentErrors.add(error);
    // Keep only last 5 errors
    if (_recentErrors.length > 5) {
      _recentErrors.removeAt(0);
    }
  }

  void clearErrors() {
    _apiError = null;
    _wsError = null;
    _recentErrors.clear();
    notifyListeners();
  }
}

enum ConnectionStatus { connected, connecting, disconnected, error }
enum ConnectionErrorType { api, websocket }

class ConnectionError {
  final ConnectionErrorType type;
  final String message;
  final DateTime timestamp;

  ConnectionError({
    required this.type,
    required this.message,
    required this.timestamp,
  });
}
```

### 6. Automatic Error Recovery

```dart
// Token refresh and automatic retry inspired by web authService
class AuthInterceptor extends Interceptor {
  final AuthRepository _authRepository;
  final Dio _dio;
  bool _isRefreshing = false;

  AuthInterceptor(this._authRepository, this._dio);

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      // Token expired or invalid
      if (!_isRefreshing) {
        _isRefreshing = true;
        
        try {
          // Try to refresh token
          final refreshResult = await _authRepository.refreshToken();
          
          refreshResult.when(
            ok: (newTokens) async {
              // Retry original request with new token
              final options = err.requestOptions;
              options.headers['Authorization'] = 'Bearer ${newTokens.accessToken}';
              
              try {
                final response = await _dio.request(
                  options.path,
                  options: Options(
                    method: options.method,
                    headers: options.headers,
                    extra: options.extra,
                  ),
                  data: options.data,
                  queryParameters: options.queryParameters,
                );
                handler.resolve(response);
              } catch (retryError) {
                handler.next(err);
              }
            },
            err: (failure) {
              // Refresh failed, logout user
              _authRepository.logout();
              handler.next(err);
            },
          );
        } finally {
          _isRefreshing = false;
        }
      } else {
        // Refresh already in progress, reject request
        handler.next(err);
      }
    } else {
      handler.next(err);
    }
  }
}
```

## Implementation Guidelines

### 1. Error Message Consistency
Use identical error messages across platforms:

```dart
class ErrorMessages {
  // Authentication errors
  static const String unauthorized = 'Please log in to continue';
  static const String forbidden = 'You don\'t have permission to perform this action';
  
  // Family errors
  static const String familyAdminRequired = 'Only family admins can perform this action';
  static const String familyFull = 'This family has reached the maximum number of members';
  static const String alreadyInFamily = 'You are already part of a family';
  
  // Network errors
  static const String noConnection = 'No internet connection. Please check your network and try again';
  static const String timeout = 'Request timed out. Please try again';
  static const String serverError = 'Something went wrong on our end. Please try again later';
  
  // Generic fallback
  static const String generic = 'An unexpected error occurred. Please try again';
}
```

### 2. Loading State Management
Implement consistent loading states:

```dart
class LoadingState {
  final bool isLoading;
  final String? operation;
  final bool canRetry;
  final int retryCount;

  const LoadingState({
    this.isLoading = false,
    this.operation,
    this.canRetry = true,
    this.retryCount = 0,
  });

  LoadingState copyWith({
    bool? isLoading,
    String? operation,
    bool? canRetry,
    int? retryCount,
  }) {
    return LoadingState(
      isLoading: isLoading ?? this.isLoading,
      operation: operation ?? this.operation,
      canRetry: canRetry ?? this.canRetry,
      retryCount: retryCount ?? this.retryCount,
    );
  }
}
```

### 3. Error Logging
Implement structured error logging:

```dart
class ErrorLogger {
  static void logError(
    Object error,
    StackTrace? stackTrace, {
    String? context,
    Map<String, dynamic>? additionalData,
    ErrorSeverity severity = ErrorSeverity.error,
  }) {
    final entry = ErrorLogEntry(
      timestamp: DateTime.now(),
      severity: severity,
      error: error.toString(),
      stackTrace: stackTrace?.toString(),
      context: context,
      additionalData: additionalData,
      userId: AuthService.currentUser?.id,
      sessionId: SessionManager.currentSessionId,
    );

    // Log to console in debug mode
    if (kDebugMode) {
      debugPrint('ERROR: ${entry.toString()}');
    }

    // Send to crash reporting service in production
    if (kReleaseMode) {
      CrashReportingService.recordError(entry);
    }
  }
}

enum ErrorSeverity { info, warning, error, critical }
```

## Conclusion

These patterns extracted from the web frontend provide a solid foundation for consistent error handling in the Flutter app. The key principles are:

1. **Multi-layered architecture** with clear separation of concerns
2. **Context-aware error mapping** for user-friendly messages  
3. **Rich error presentation** with recovery options
4. **Centralized connection management** 
5. **Automatic retry mechanisms** for appropriate error types
6. **Consistent loading and error states** across all features

By implementing these patterns, the Flutter app will achieve consistency with the web frontend while maintaining platform-appropriate user experience patterns.