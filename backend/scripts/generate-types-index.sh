#!/bin/bash
# Auto-generate index.ts for generated types

cd "$(dirname "$0")/.." || exit 1

TYPES_DIR="${1:-src/generated/types}"
INDEX_FILE="$TYPES_DIR/index.ts"

# Get all .ts files except AnonymousSchema and index.ts
echo "// Auto-generated TypeScript types from AsyncAPI specification" > "$INDEX_FILE"
echo "// DO NOT EDIT - Regenerate with: npm run asyncapi:generate-types" >> "$INDEX_FILE"
echo "" >> "$INDEX_FILE"

# List and export all types - enums as values, interfaces as types
for file in "$TYPES_DIR"/*.ts; do
    filename=$(basename "$file" .ts)
    if [ "$filename" != "index" ]; then
        # Check if file contains an enum (needs value export) or interface (type export)
        if grep -q "^enum " "$file"; then
            # Enum: export as value (needed for runtime access like EnumName.VALUE)
            echo "export { $filename } from './$filename';" >> "$INDEX_FILE"
        else
            # Interface: export as type (for strict mode compatibility)
            echo "export type { $filename } from './$filename';" >> "$INDEX_FILE"
        fi
    fi
done

echo "✅ Generated $INDEX_FILE with $(grep -c "export" "$INDEX_FILE") type exports"
