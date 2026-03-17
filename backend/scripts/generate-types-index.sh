#!/bin/bash
# Auto-generate index.ts for generated types

cd "$(dirname "$0")/.." || exit 1

TYPES_DIR="src/generated/types"
INDEX_FILE="$TYPES_DIR/index.ts"

# Get all .ts files except AnonymousSchema and index.ts
echo "// Auto-generated TypeScript types from AsyncAPI specification" > "$INDEX_FILE"
echo "// DO NOT EDIT - Regenerate with: npm run asyncapi:generate-types" >> "$INDEX_FILE"
echo "" >> "$INDEX_FILE"

# List and export all types
for file in "$TYPES_DIR"/*.ts; do
    filename=$(basename "$file" .ts)
    if [ "$filename" != "index" ]; then
        echo "export { $filename } from './$filename';" >> "$INDEX_FILE"
    fi
done

echo "✅ Generated $INDEX_FILE with $(grep -c "export" "$INDEX_FILE") type exports"
