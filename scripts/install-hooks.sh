#!/bin/bash

# Git Hooks Installation Script for EduLift
# Installs custom Git hooks from .githooks directory

set -e

echo "🔧 Installing Git hooks for EduLift..."

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

# Get the git hooks directory
GIT_HOOKS_DIR=$(git rev-parse --git-dir)/hooks
PROJECT_ROOT=$(git rev-parse --show-toplevel)

print_info "Git repository found at: $PROJECT_ROOT"
print_info "Git hooks directory: $GIT_HOOKS_DIR"

# Check if .githooks directory exists
GITHOOKS_DIR="$PROJECT_ROOT/.githooks"
if [ ! -d "$GITHOOKS_DIR" ]; then
    print_error ".githooks directory not found at: $GITHOOKS_DIR"
    exit 1
fi

print_info "Found .githooks directory at: $GITHOOKS_DIR"

# Install pre-commit hook
if [ -f "$GITHOOKS_DIR/pre-commit" ]; then
    cp "$GITHOOKS_DIR/pre-commit" "$GIT_HOOKS_DIR/pre-commit"
    chmod +x "$GIT_HOOKS_DIR/pre-commit"
    print_success "pre-commit hook installed"
else
    print_warning "pre-commit hook not found in .githooks directory"
fi

# Install other hooks if they exist
for hook in commit-msg pre-push prepare-commit-msg; do
    if [ -f "$GITHOOKS_DIR/$hook" ]; then
        cp "$GITHOOKS_DIR/$hook" "$GIT_HOOKS_DIR/$hook"
        chmod +x "$GIT_HOOKS_DIR/$hook"
        print_success "$hook hook installed"
    fi
done

echo ""
print_success "Git hooks installation completed! 🎉"
echo ""
print_info "The hooks will now run automatically before each commit."
print_warning "Note: If you need to bypass hooks, use: git commit --no-verify"
print_warning "       Only do this if you know what you're doing - CI will still run these checks!"
echo ""

# Test the pre-commit hook
print_info "Testing pre-commit hook syntax..."
if bash -n "$GIT_HOOKS_DIR/pre-commit"; then
    print_success "pre-commit hook syntax is valid"
else
    print_error "pre-commit hook has syntax errors"
    exit 1
fi

echo ""
print_success "All set! Your Git hooks are ready to use."