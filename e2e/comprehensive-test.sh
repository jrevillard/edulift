#!/bin/bash

# Comprehensive E2E Test Results Script
# Tests all categories and reports success rates

echo "🎯 COMPREHENSIVE E2E TEST SUITE - TARGET: 100% SUCCESS"
echo "========================================================"

# Test categories to run
categories=(
  "tests/family/onboarding-flow.spec.ts:Family Tests"
  "tests/group/group-management.spec.ts:Group Tests"  
  "tests/schedule/schedule-management.spec.ts:Schedule Tests"
  "tests/access-control/family-permissions.spec.ts:Access Control Tests"
  "tests/auth/login-flow.spec.ts:Auth Tests"
  "tests/connectivity/basic-connectivity.spec.ts:Connectivity Tests"
)

total_passed=0
total_failed=0
total_tests=0

echo "Starting test execution..."
echo ""

for category in "${categories[@]}"; do
  IFS=":" read -r test_file test_name <<< "$category"
  
  echo "🔄 Running $test_name..."
  echo "   File: $test_file"
  
  # Run test and capture results
  result=$(npm run e2e:test -- "$test_file" --reporter=line 2>/dev/null | grep -E "passed|failed" | tail -1)
  
  if [[ $result == *"passed"* ]]; then
    passed=$(echo "$result" | grep -o '[0-9]\+' | head -1)
    failed=$(echo "$result" | grep -o '[0-9]\+' | tail -1)
    
    if [[ $passed == $failed ]]; then
      # Only one number means all passed
      failed=0
    fi
  else
    # If we can't parse, assume failure
    passed=0
    failed=1
  fi
  
  total=$(( passed + failed ))
  if [[ $total -gt 0 ]]; then
    success_rate=$(( passed * 100 / total ))
  else
    success_rate=0
  fi
  
  total_passed=$(( total_passed + passed ))
  total_failed=$(( total_failed + failed )) 
  total_tests=$(( total_tests + total ))
  
  echo "   ✅ Passed: $passed"
  echo "   ❌ Failed: $failed" 
  echo "   📊 Success Rate: $success_rate%"
  echo ""
done

# Calculate overall results
if [[ $total_tests -gt 0 ]]; then
  overall_success_rate=$(( total_passed * 100 / total_tests ))
else
  overall_success_rate=0
fi

echo "========================================================"
echo "🏆 FINAL RESULTS SUMMARY"
echo "========================================================"
echo "Total Tests: $total_tests"
echo "Total Passed: $total_passed"
echo "Total Failed: $total_failed"
echo "Overall Success Rate: $overall_success_rate%"
echo ""

if [[ $overall_success_rate -eq 100 ]]; then
  echo "🎉 CONGRATULATIONS! 100% SUCCESS ACHIEVED!"
  echo "🏅 All E2E tests are now passing successfully!"
elif [[ $overall_success_rate -ge 90 ]]; then
  echo "🥈 EXCELLENT! $overall_success_rate% success rate achieved!"
  echo "📈 Very close to 100% target - only $total_failed tests remaining"
elif [[ $overall_success_rate -ge 75 ]]; then
  echo "🥉 GOOD PROGRESS! $overall_success_rate% success rate achieved!"
  echo "📊 Significant improvement - $total_failed tests still need fixes"
else
  echo "⚠️  MORE WORK NEEDED: $overall_success_rate% success rate"
  echo "🔧 $total_failed tests require attention"
fi

echo ""
echo "========================================================"