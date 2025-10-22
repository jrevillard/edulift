#!/bin/bash

# E2E Test Suite - Individual File Execution Script
# This script tests each E2E file individually as required by CLAUDE.md

echo "🚀 Starting comprehensive E2E file-by-file testing..."
echo "Date: $(date)"
echo "======================================================"

# Get list of all test files
TEST_FILES=$(find tests -name "*.spec.ts" | sort)
TOTAL_FILES=$(echo "$TEST_FILES" | wc -l)
PASSED_FILES=0
FAILED_FILES=0
RESULTS_FILE="individual-test-results.log"

echo "Found $TOTAL_FILES test files to process"
echo ""

# Clear previous results
> "$RESULTS_FILE"

# Test each file individually
CURRENT=1
for TEST_FILE in $TEST_FILES; do
    echo "[$CURRENT/$TOTAL_FILES] Testing: $TEST_FILE"
    echo "----------------------------------------"
    
    # Record start time
    START_TIME=$(date +%s)
    
    # Run the test with timeout
    if timeout 300 npx playwright test "$TEST_FILE" --project=chromium --reporter=line > "temp_output.log" 2>&1; then
        RESULT="✅ PASSED"
        ((PASSED_FILES++))
    else
        RESULT="❌ FAILED"
        ((FAILED_FILES++))
    fi
    
    # Calculate duration
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    # Log results
    echo "$TEST_FILE,$RESULT,$DURATION" >> "$RESULTS_FILE"
    echo "$RESULT ($DURATION seconds)"
    
    # Show brief output for failures
    if [[ "$RESULT" == "❌ FAILED" ]]; then
        echo "Last 10 lines of output:"
        tail -n 10 temp_output.log | sed 's/^/  /'
    fi
    
    echo ""
    ((CURRENT++))
done

# Generate summary report
echo "======================================================"
echo "📊 FINAL SUMMARY"
echo "======================================================"
echo "Total files tested: $TOTAL_FILES"
echo "✅ Passed: $PASSED_FILES"
echo "❌ Failed: $FAILED_FILES"
echo "Success rate: $(( PASSED_FILES * 100 / TOTAL_FILES ))%"
echo ""

echo "📋 DETAILED RESULTS:"
echo ""
printf "%-50s %-10s %-10s\n" "Test File" "Result" "Duration"
echo "--------------------------------------------------------------------------------"
while IFS=',' read -r file result duration; do
    printf "%-50s %-10s %-10s\n" "$(basename "$file")" "$result" "${duration}s"
done < "$RESULTS_FILE"

echo ""
echo "✅ File-by-file execution verification complete!"
echo "Results saved to: $RESULTS_FILE"

# Cleanup
rm -f temp_output.log