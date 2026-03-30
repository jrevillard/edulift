#!/bin/bash
# Post-edit hook: runs eslint --fix on the edited file to keep formatting consistent

set -e

# Read JSON input from Claude Code
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Skip if no file path (shouldn't happen but defensive)
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only process TypeScript/JavaScript files
if [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  exit 0
fi

# Skip node_modules, dist, build, generated files
if [[ "$FILE_PATH" =~ node_modules|dist/|build/|\.d\.ts$|generated/ ]]; then
  exit 0
fi

# Determine project directory and run eslint from there
PROJECT_ROOT="/workspace"

if [[ "$FILE_PATH" == "$PROJECT_ROOT/frontend/"* ]]; then
  ESLINT_DIR="$PROJECT_ROOT/frontend"
elif [[ "$FILE_PATH" == "$PROJECT_ROOT/backend/"* ]]; then
  ESLINT_DIR="$PROJECT_ROOT/backend"
elif [[ "$FILE_PATH" == "$PROJECT_ROOT/e2e/"* ]]; then
  ESLINT_DIR="$PROJECT_ROOT/e2e"
else
  exit 0
fi

# Run eslint --fix on the specific file (suppress output, only show errors)
cd "$ESLINT_DIR"
npx eslint --fix "$FILE_PATH" 2>/dev/null || true

exit 0
