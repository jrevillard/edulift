# Git Hooks for EduLift

Custom Git hooks to ensure code quality and consistency before commits.

## Available Hooks

### pre-commit

Runs before each commit to ensure code quality:

**For Backend Changes:**
1. **TypeScript type checking** - Verifies TypeScript types with `npm run typecheck`
2. **Linting** - Code style and quality checks (if available)
3. **Tests** - Runs unit tests (if available)

**For Frontend Changes:**
1. **TypeScript type checking** - Verifies TypeScript types with `npm run typecheck`
2. **Linting** - Code style and quality checks (if available)
3. **Tests** - Runs unit tests (if available)

**Smart Detection:**
- Automatically detects which directories (backend/frontend) have modified files
- Only runs relevant checks for the changed code
- Skips all checks if no code files were modified

If any check fails, the commit is blocked until issues are fixed.

## Installation

### Option 1: Using the Installation Script (Recommended)

Run the installation script from the project root:

```bash
bash scripts/install-hooks.sh
```

This script will:
- Verify you're in a Git repository
- Copy hooks from `.githooks/` to `.git/hooks/`
- Set proper permissions
- Validate hook syntax

### Option 2: Manual Installation

```bash
# Copy the pre-commit hook
cp .githooks/pre-commit .git/hooks/pre-commit

# Make it executable
chmod +x .git/hooks/pre-commit
```

## Usage

The hooks run automatically before each commit. No additional action needed!

### Example Workflow

```bash
# Make some changes to backend files
vim backend/src/config/logger.ts

# Stage your changes
git add backend/src/config/logger.ts

# Try to commit - hooks will run automatically
git commit -m "fix: resolve TypeScript errors in logger"
```

The hook will:
1. Detect that backend files were modified
2. Run `npm run typecheck` in the backend directory
3. Block the commit if TypeScript errors are found
4. Allow the commit only if all checks pass

### Skipping Hooks (Not Recommended)

If you absolutely need to bypass the hooks:

```bash
git commit --no-verify -m "Your message"
```

⚠️ **Warning**: Only skip hooks if you know what you're doing. The CI pipeline will still run these checks and fail if there are issues.

## Hook Behavior

### Success Case
```
🔍 Running pre-commit checks...

ℹ️  Backend files modified. Running backend checks...
🔎 Running TypeScript type checking...
✅ TypeScript type checking passed
✅ Linting passed
✅ Tests passed

✅ All pre-commit checks passed! 🎉
Proceeding with commit...
```

### Failure Case
```
🔍 Running pre-commit checks...

ℹ️  Backend files modified. Running backend checks...
🔎 Running TypeScript type checking...
❌ TypeScript type checking failed
Please fix the TypeScript errors before committing.
```

## Benefits

- ✅ **Early Detection**: Catch TypeScript errors and linting issues before pushing
- ✅ **Faster CI Pipeline**: Fewer failed builds in CI/CD
- ✅ **Consistent Code Quality**: Ensures all code passes basic quality checks
- ✅ **Smart Execution**: Only runs relevant checks based on changed files
- ✅ **Team Consistency**: All developers use the same quality gates

## Troubleshooting

### Hook Not Running
```bash
# Verify hooks are installed
ls -la .git/hooks/pre-commit

# Reinstall if needed
bash scripts/install-hooks.sh
```

### Permission Issues
```bash
# Make sure hook is executable
chmod +x .git/hooks/pre-commit
```

### Hook Syntax Errors
The installation script validates hook syntax automatically. If you modify hooks manually, test with:

```bash
bash -n .githooks/pre-commit
```

## Customization

To add new checks or modify existing ones:

1. Edit the hook file in `.githooks/pre-commit`
2. Test your changes: `bash -n .githooks/pre-commit`
3. Reinstall: `bash scripts/install-hooks.sh`

### Adding New Check Types

```bash
# Example: Add Prettier formatting check
if command -v prettier &> /dev/null; then
    echo "🎨 Running Prettier formatting check..."
    if prettier --check .; then
        print_success "Prettier formatting check passed"
    else
        print_error "Prettier formatting check failed"
        echo "Run 'prettier --write .' to fix formatting issues."
        exit 1
    fi
fi
```

## CI/CD Integration

These hooks complement the existing CI/CD pipeline:

- **Pre-commit**: Local development, fast feedback
- **CI Pipeline**: Remote validation, comprehensive testing
- **CD Pipeline**: Deployment validation

Using both ensures consistent code quality across development and deployment environments.