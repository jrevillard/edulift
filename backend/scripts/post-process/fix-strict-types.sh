#!/bin/bash

# Post-processing script to fix AsyncAPI generated types for strict TypeScript
# Converts exports/imports to be compatible with verbatimModuleSyntax
# Preserves enum exports as values (needed for runtime access)

set -e

TYPES_DIR="${1:-src/generated/types}"

echo "🔧 Fixing generated types for strict TypeScript compatibility..."

# Find all .ts files (excluding index.ts)
find "$TYPES_DIR" -name "*.ts" -type f ! -name "index.ts" | while read -r file; do
  echo "Processing: $(basename "$file")"

  # Get the base filename without extension
  basename=$(basename "$file" .ts)

  # Read file content
  content=$(cat "$file")

  # Check if file contains an enum definition (more robust pattern)
  has_enum=false
  if echo "$content" | grep -q "^[[:space:]]*enum[[:space:]]"; then
    has_enum=true
  fi

  if [ "$has_enum" = true ]; then
    # For enum files: keep as value export (enums are used at runtime)
    # Already correct: export { EnumName };
    :
  else
    # For interface files: use type-only export
    content=$(echo "$content" | sed "s/^export { $basename };$/export type { $basename };/")
  fi

  # Fix imports in files that import other types
  # For each import line, check if the imported file is an enum or interface
  import_lines=$(echo "$content" | grep -n "^import {[^}]*} from" | cut -d: -f1)

  if [ -n "$import_lines" ]; then
    # Process imports in reverse order to maintain line numbers
    while IFS= read -r line_num; do
      import_line=$(echo "$content" | sed "${line_num}q;d")
      import_from=$(echo "$import_line" | sed -n "s/^import {[^}]*} from '\.\/\([^']*\)';$/\1/p")

      if [ -n "$import_from" ]; then
        # Check if the imported file is an enum
        imported_file="$TYPES_DIR/$import_from.ts"
        if [ -f "$imported_file" ]; then
          if grep -q "^[[:space:]]*enum[[:space:]]" "$imported_file"; then
            # Keep as value import for enums
            :
          else
            # Convert to type import for interfaces
            content=$(echo "$content" | sed "${line_num}s/^import {/import type {/")
          fi
        fi
      fi
    done <<< "$(echo "$import_lines" | sort -rn)"
  fi

  # Write back
  echo "$content" > "$file"
done

echo "✅ Fixed $(find "$TYPES_DIR" -name "*.ts" ! -name "index.ts" | wc -l) TypeScript files"
