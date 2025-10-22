// Template for new EduLift feature
// Copy this structure when creating new features

// ==================== DOMAIN LAYER ====================

// Entity: Core business object
class FeatureEntity {
  final String id;
  final String name;
  final DateTime createdAt;

  const FeatureEntity({
    required this.id,
    required this.name,
    required this.createdAt,
  });

  // Domain logic
  bool isValid() => name.isNotEmpty && id.isNotEmpty;

  FeatureEntity copyWith({
    String? id,
    String? name,
    DateTime? createdAt,
  }) {
    return FeatureEntity(
      id: id ?? this.id,
      name: name ?? this.name,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is FeatureEntity &&
        other.id == id &&
        other.name == name &&
        other.createdAt == createdAt;
  }

  @override
  int get hashCode => id.hashCode ^ name.hashCode ^ createdAt.hashCode;
}

// Repository Interface
abstract class FeatureRepository {
  Future<FeatureEntity> getFeature(String id);
  Future<List<FeatureEntity>> getAllFeatures();
  Future<void> saveFeature(FeatureEntity feature);
  Future<void> deleteFeature(String id);
  Stream<List<FeatureEntity>> watchFeatures();
}

// Use Case
class GetFeatureUseCase {
  GetFeatureUseCase(this._repository);

  final FeatureRepository _repository;

  Future<FeatureEntity> execute(String id) async {
    final feature = await _repository.getFeature(id);
    if (!feature.isValid()) {
      throw FeatureFailure.invalidFeature();
    }
    return feature;
  }
}

// Failure
abstract class FeatureFailure {
  const FeatureFailure();

  factory FeatureFailure.invalidFeature() = InvalidFeatureFailure;
  factory FeatureFailure.notFound() = NotFoundFailure;
  factory FeatureFailure.network(String message) = NetworkFailure;
}

class InvalidFeatureFailure extends FeatureFailure {
  const InvalidFeatureFailure();
}

class NotFoundFailure extends FeatureFailure {
  const NotFoundFailure();
}

class NetworkFailure extends FeatureFailure {
  final String message;
  const NetworkFailure(this.message);
}

// ==================== DATA LAYER ====================

// DTO for serialization
@freezed
class FeatureDto with _$FeatureDto {
  const factory FeatureDto({
    required String id,
    required String name,
    required String createdAt,
  }) = _FeatureDto;

  factory FeatureDto.fromJson(Map<String, dynamic> json) =>
      _$FeatureDtoFromJson(json);
}

// Mapper
class FeatureMapper {
  static FeatureEntity dtoToDomain(FeatureDto dto) {
    return FeatureEntity(
      id: dto.id,
      name: dto.name,
      createdAt: DateTime.parse(dto.createdAt),
    );
  }

  static FeatureDto domainToDto(FeatureEntity entity) {
    return FeatureDto(
      id: entity.id,
      name: entity.name,
      createdAt: entity.createdAt.toIso8601String(),
    );
  }
}

// Repository Implementation with NetworkErrorHandler
class FeatureRepositoryImpl implements FeatureRepository {
  FeatureRepositoryImpl({
    required FeatureRemoteDatasource remote,
    required FeatureLocalDatasource local,
    required NetworkErrorHandler networkErrorHandler,
  });

  final FeatureRemoteDatasource remote;
  final FeatureLocalDatasource local;
  final NetworkErrorHandler networkErrorHandler;

  @override
  Future<FeatureEntity> getFeature(String id) async {
    final dto = await networkErrorHandler.executeRepositoryOperation(
      () => remote.getFeature(id),
      operationName: 'feature.getFeature',
      strategy: CacheStrategy.networkFirst,
      serviceName: 'feature',
    );
    await local.cacheFeature(dto);
    return FeatureMapper.dtoToDomain(dto);
  }

  @override
  Future<List<FeatureEntity>> getAllFeatures() async {
    final dtos = await networkErrorHandler.executeRepositoryOperation(
      () => remote.getAllFeatures(),
      operationName: 'feature.getAllFeatures',
      strategy: CacheStrategy.networkFirst,
      serviceName: 'feature',
    );
    return dtos.map(FeatureMapper.dtoToDomain).toList();
  }

  @override
  Future<void> saveFeature(FeatureEntity feature) async {
    final dto = FeatureMapper.domainToDto(feature);
    await networkErrorHandler.executeRepositoryOperation(
      () => remote.saveFeature(dto),
      operationName: 'feature.saveFeature',
      strategy: CacheStrategy.networkOnly,
      serviceName: 'feature',
      config: RetryConfig.standard,
    );
    await local.cacheFeature(dto);
  }

  @override
  Future<void> deleteFeature(String id) async {
    await networkErrorHandler.executeRepositoryOperation(
      () => remote.deleteFeature(id),
      operationName: 'feature.deleteFeature',
      strategy: CacheStrategy.networkOnly,
      serviceName: 'feature',
    );
    await local.deleteCachedFeature(id);
  }

  @override
  Stream<List<FeatureEntity>> watchFeatures() {
    return remote.watchFeatures().map((dtos) => dtos.map(FeatureMapper.dtoToDomain).toList());
  }
}

// ==================== PRESENTATION LAYER ====================

// Riverpod Provider with BaseState pattern
@immutable
class FeatureState implements BaseState<FeatureState> {
  const FeatureState({
    required this.isLoading,
    required this.features,
    this.error,
  });

  final bool isLoading;
  final List<FeatureEntity> features;
  final String? error;

  @override
  FeatureState copyWith({
    bool? isLoading,
    List<FeatureEntity>? features,
    String? error,
    bool clearError = false,
  }) {
    return FeatureState(
      isLoading: isLoading ?? this.isLoading,
      features: features ?? this.features,
      error: clearError ? null : error ?? this.error,
    );
  }
}

@riverpod
class FeatureNotifier extends _$FeatureNotifier {
  @override
  Future<FeatureState> build() async {
    final features = await _repository.getAllFeatures();
    return FeatureState(
      isLoading: false,
      features: features,
    );
  }

  Future<void> addFeature(FeatureEntity feature) async {
    state = state.value?.copyWith(isLoading: true) ??
           const FeatureState(isLoading: true, features: []);

    state = await AsyncValue.guard(() async {
      await _repository.saveFeature(feature);
      final features = await _repository.getAllFeatures();
      return FeatureState(
        isLoading: false,
        features: features,
      );
    });
  }

  Future<void> deleteFeature(String id) async {
    state = state.value?.copyWith(isLoading: true) ??
           const FeatureState(isLoading: true, features: []);

    state = await AsyncValue.guard(() async {
      await _repository.deleteFeature(id);
      final features = await _repository.getAllFeatures();
      return FeatureState(
        isLoading: false,
        features: features,
      );
    });
  }

  Future<void> refresh() async {
    state = state.value?.copyWith(isLoading: true) ??
           const FeatureState(isLoading: true, features: []);

    state = await AsyncValue.guard(() async {
      final features = await _repository.getAllFeatures();
      return FeatureState(
        isLoading: false,
        features: features,
      );
    });
  }
}

// Widget
class FeaturePage extends ConsumerWidget {
  const FeaturePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final featuresState = ref.watch(featureNotifierProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(AppLocalizations.of(context).features),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.read(featureNotifierProvider.notifier).refresh(),
          ),
        ],
      ),
      body: featuresState.when(
        data: (features) => FeatureList(features: features),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => ErrorDisplay(
          error: error,
          onRetry: () => ref.read(featureNotifierProvider.notifier).refresh(),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddFeatureDialog(context, ref),
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showAddFeatureDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (context) => AddFeatureDialog(
        onAdd: (feature) {
          ref.read(featureNotifierProvider.notifier).addFeature(feature);
          Navigator.of(context).pop();
        },
      ),
    );
  }
}