#!/bin/bash

# EduLift Feature Generator Script
# Creates a new feature structure following Clean Architecture patterns

set -e

# Check if feature name is provided
if [ -z "$1" ]; then
    echo "Usage: ./generate_feature.sh <feature_name>"
    echo "Example: ./generate_feature.sh notifications"
    exit 1
fi

FEATURE_NAME=$1
FEATURE_PATH="lib/features/$FEATURE_NAME"

echo "🚀 Creating EduLift feature: $FEATURE_NAME"

# Create directory structure
mkdir -p "$FEATURE_PATH/presentation/{providers,widgets,pages,routing,utils}"
mkdir -p "$FEATURE_PATH/domain/{entities,repositories,usecases,services,failures}"
mkdir -p "$FEATURE_PATH/data/{repositories,datasources,models,providers}"

# Create presentation files
touch "$FEATURE_PATH/presentation/providers/${FEATURE_NAME}_provider.dart"
touch "$FEATURE_PATH/presentation/pages/${FEATURE_NAME}_page.dart"
touch "$FEATURE_PATH/presentation/routing/${FEATURE_NAME}_route_factory.dart"

# Create domain files
touch "$FEATURE_PATH/domain/entities/${FEATURE_NAME}_entity.dart"
touch "$FEATURE_PATH/domain/repositories/${FEATURE_NAME}_repository.dart"
touch "$FEATURE_PATH/domain/usecases/${FEATURE_NAME}_usecase.dart"
touch "$FEATURE_PATH/domain/failures/${FEATURE_NAME}_failure.dart"

# Create data files
touch "$FEATURE_PATH/data/repositories/${FEATURE_NAME}_repository_impl.dart"
touch "$FEATURE_PATH/data/datasources/${FEATURE_NAME}_remote_datasource.dart"
touch "$FEATURE_PATH/data/datasources/${FEATURE_NAME}_local_datasource.dart"
touch "$FEATURE_PATH/data/models/${FEATURE_NAME}_dto.dart"

# Create index file
touch "$FEATURE_PATH/index.dart"

# Add to index file
cat > "$FEATURE_PATH/index.dart" << EOF
// $FEATURE_NAME feature
export 'presentation/providers/${FEATURE_NAME}_provider.dart';
export 'presentation/pages/${FEATURE_NAME}_page.dart';
export 'presentation/routing/${FEATURE_NAME}_route_factory.dart';
export 'domain/entities/${FEATURE_NAME}_entity.dart';
export 'domain/repositories/${FEATURE_NAME}_repository.dart';
export 'domain/usecases/${FEATURE_NAME}_usecase.dart';
export 'domain/failures/${FEATURE_NAME}_failure.dart';
export 'data/repositories/${FEATURE_NAME}_repository_impl.dart';
export 'data/datasources/${FEATURE_NAME}_remote_datasource.dart';
export 'data/datasources/${FEATURE_NAME}_local_datasource.dart';
export 'data/models/${FEATURE_NAME}_dto.dart';
EOF

echo "✅ Feature '$FEATURE_NAME' created successfully!"
echo "📁 Path: $FEATURE_PATH"
echo ""
echo "Next steps:"
echo "1. Implement domain entities and repository interfaces"
echo "2. Create data models and repository implementations"
echo "3. Add presentation providers and widgets"
echo "4. Update dependency injection in lib/core/di/"
echo "5. Add comprehensive tests"