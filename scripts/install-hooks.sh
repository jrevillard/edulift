#!/bin/bash

# Git Hooks Installation Script for EduLift
# Configures Git to use hooks from .githooks directory

set -e

echo "🔧 Configuring Git hooks for EduLift..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "This directory is not a Git repository"
    exit 1
fi

# Get the project root
PROJECT_ROOT=$(git rev-parse --show-toplevel)

print_info "Git repository found at: $PROJECT_ROOT"

# Check if .githooks directory exists
GITHOOKS_DIR="$PROJECT_ROOT/.githooks"
if [ ! -d "$GITHOOKS_DIR" ]; then
    print_error ".githooks directory not found at: $GITHOOKS_DIR"
    exit 1
fi

print_info "Found .githooks directory at: $GITHOOKS_DIR"

# Configure Git to use .githooks directory
print_info "Configuring Git to use hooks from .githooks directory..."
git config core.hooksPath ".githooks"
print_success "Git configured to use .githooks directory"

# Verify configuration
CONFIGURED_PATH=$(git config --get core.hooksPath)
if [ "$CONFIGURED_PATH" = ".githooks" ]; then
    print_success "Configuration verified: core.hooksPath = $CONFIGURED_PATH"
else
    print_error "Configuration verification failed"
    exit 1
fi

# Make hooks executable
print_info "Ensuring hooks are executable..."
HOOKS_FOUND=false
for hook in "$GITHOOKS_DIR"/*; do
    if [ -f "$hook" ]; then
        chmod +x "$hook"
        HOOK_NAME=$(basename "$hook")
        print_success "Made $HOOK_NAME executable"
        HOOKS_FOUND=true
    fi
done

if [ "$HOOKS_FOUND" = false ]; then
    print_warning "No hook files found in .githooks directory"
fi

echo ""
print_success "Git hooks configuration completed! 🎉"
echo ""
print_info "Hooks will now be read from the .githooks directory."
print_info "This means:"
print_info "  • Hooks are versioned in the repository"
print_info "  • Updates to hooks are automatically shared with the team"
print_info "  • No need to reinstall after pulling changes"
echo ""
print_warning "Note: If you need to bypass hooks, use: git commit --no-verify"
print_warning "       Only do this if you know what you're doing - CI will still run these checks!"
echo ""

# Test the pre-commit hook syntax if it exists
if [ -f "$GITHOOKS_DIR/pre-commit" ]; then
    print_info "Testing pre-commit hook syntax..."
    if bash -n "$GITHOOKS_DIR/pre-commit"; then
        print_success "pre-commit hook syntax is valid"
    else
        print_error "pre-commit hook has syntax errors"
        exit 1
    fi
fi

echo ""
print_success "All set! Your Git hooks are ready to use."