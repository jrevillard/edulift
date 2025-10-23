#!/bin/bash

# Script to analyze functional changes in git diff

echo "=== ANALYZING FUNCTIONAL CHANGES ==="
echo ""

# Check for async/await changes
echo "1. ASYNC/AWAIT CHANGES:"
git diff HEAD -- 'src/**/*.ts' ':(exclude)*/__tests__/*' ':(exclude)*.test.ts' | grep -E "^[\-\+].*\b(async|await)\b" | grep -v "^[\+\-]\s*//" | head -20
echo ""

# Check for conditional logic changes
echo "2. CONDITIONAL LOGIC CHANGES:"
git diff HEAD -- 'src/**/*.ts' ':(exclude)*/__tests__/*' ':(exclude)*.test.ts' | grep -E "^[\-\+].*\b(if|else|switch|case)\b" | grep -v "^[\+\-]\s*//" | head -20
echo ""

# Check for return statement changes
echo "3. RETURN STATEMENT CHANGES:"
git diff HEAD -- 'src/**/*.ts' ':(exclude)*/__tests__/*' ':(exclude)*.test.ts' | grep -E "^[\-].*\breturn\b" | head -20
echo ""

# Check for comparison operator changes
echo "4. COMPARISON CHANGES:"
git diff HEAD -- 'src/**/*.ts' ':(exclude)*/__tests__/*' ':(exclude)*.test.ts' | grep -E "^[\-\+].*(===|!==|==|!=|>=|<=|>|<)" | grep -v "^[\+\-]\s*//" | head -20
echo ""

# Check for throw/error changes
echo "5. ERROR HANDLING CHANGES:"
git diff HEAD -- 'src/**/*.ts' ':(exclude)*/__tests__/*' ':(exclude)*.test.ts' | grep -E "^[\-\+].*\b(throw|catch|try)\b" | grep -v "^[\+\-]\s*//" | head -20
echo ""

# Check for loop changes
echo "6. LOOP CHANGES:"
git diff HEAD -- 'src/**/*.ts' ':(exclude)*/__tests__/*' ':(exclude)*.test.ts' | grep -E "^[\-\+].*\b(for|while|forEach|map|filter|reduce)\b" | grep -v "^[\+\-]\s*//" | head -20
echo ""

# Check for database query changes
echo "7. DATABASE QUERY CHANGES:"
git diff HEAD -- 'src/**/*.ts' ':(exclude)*/__tests__/*' ':(exclude)*.test.ts' | grep -E "^[\-\+].*(prisma\.|findUnique|findFirst|findMany|create|update|delete|where:)" | grep -v "^[\+\-]\s*//" | head -30
echo ""
