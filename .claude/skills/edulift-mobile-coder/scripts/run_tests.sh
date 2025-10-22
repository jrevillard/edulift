#!/bin/bash

# EduLift Test Runner
# Comprehensive test execution with coverage and reporting

set -e

echo "🧪 Running EduLift Test Suite"
echo "================================"

# Clean previous test results
echo "🧹 Cleaning previous test results..."
find . -name "*.gcov" -delete
find . -name "*.coverage" -delete
rm -rf coverage/

# Run static analysis first
echo "🔍 Running Flutter analysis..."
flutter analyze
if [ $? -ne 0 ]; then
    echo "❌ Flutter analysis failed. Fix issues before running tests."
    exit 1
fi

# Run unit tests
echo "🧪 Running unit tests..."
flutter test test/unit/ --coverage
if [ $? -eq 0 ]; then
    echo "✅ Unit tests passed"
else
    echo "❌ Unit tests failed"
    exit 1
fi

# Run widget tests
echo "🎯 Running widget tests..."
flutter test test/presentation/ --coverage
if [ $? -eq 0 ]; then
    echo "✅ Widget tests passed"
else
    echo "❌ Widget tests failed"
    exit 1
fi

# Run integration tests
echo "🔗 Running integration tests..."
flutter test test/integration/ --coverage
if [ $? -eq 0 ]; then
    echo "✅ Integration tests passed"
else
    echo "❌ Integration tests failed"
    exit 1
fi

# Generate coverage report
echo "📊 Generating coverage report..."
genhtml coverage/lcov.info -o coverage/html --no-function-coverage --no-branch-coverage

# Show coverage summary
if [ -f "coverage/lcov.info" ]; then
    TOTAL_LINES=$(lcov --summary coverage/lcov.info 2>&1 | grep "lines......:" | awk '{print $2}')
    echo "📈 Overall line coverage: $TOTAL_LINES"
fi

echo "================================"
echo "✅ All tests completed successfully!"
echo "📊 Coverage report available at: coverage/html/index.html"