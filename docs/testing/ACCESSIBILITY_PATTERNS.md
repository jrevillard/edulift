# Flutter Accessibility Testing Patterns (2025)

This guide demonstrates **realistic** accessibility testing patterns that align with WCAG 2.1 principles where automation is possible.

**IMPORTANT LIMITATION**: Full WCAG 2.1 AA compliance cannot be guaranteed through automated testing alone in Flutter. This guide provides patterns for catching **common, verifiable issues**. Manual testing and expert accessibility review remain essential for true compliance.

## Overview

Our AccessibilityTestHelper provides utilities for **automatable** accessibility checks:

**✅ AUTOMATED CHECKS (Available)**:
- Semantic label validation
- Minimum touch target size compliance (44x44 logical pixels)
- Common anti-pattern detection (unlabeled IconButtons, images without alt text)
- Form accessibility validation (TextFormField/TextField labeling)
- Basic visual accessibility checks (minimum text size)

**❌ MANUAL TESTING REQUIRED (Not Automated)**:
- Color contrast ratios (requires visual inspection)
- Complex focus management and keyboard navigation flows
- Screen reader experience quality
- Cognitive accessibility assessment
- Content structure and reading order

## Basic Usage

```dart
import 'package:flutter_test/flutter_test.dart';
import '../support/accessibility_test_helper.dart';

void main() {
  testWidgets('MyWidget passes automated accessibility checks', (tester) async {
    await tester.pumpWidget(MyWidget());
    
    // Run available automated accessibility checks
    await AccessibilityTestHelper.runFullAccessibilityAudit(
      tester,
      requiredLabels: ['Submit', 'Cancel', 'Email Input'],
    );
    
    // NOTE: This only tests automatable patterns. 
    // Manual testing still required for WCAG 2.1 AA compliance.
  });
}
```

## Individual Test Methods

### 1. Semantic Labels Validation

```dart
await AccessibilityTestHelper.expectProperSemanticLabels(
  tester,
  requiredLabels: ['Login Button', 'Password Field'],
);
```

**Validates:**
- All required semantic labels are present
- Interactive elements have proper labeling

### 2. Touch Target Size Testing

```dart
await AccessibilityTestHelper.expectProperTouchTargets(tester);
```

**Validates:**
- All interactive elements meet 44x44 logical pixel minimum
- Excludes system UI elements with framework constraints
- Tests: ElevatedButton, OutlinedButton, TextButton, IconButton, FloatingActionButton

### 3. Anti-Pattern Detection

```dart
await AccessibilityTestHelper.checkForAntiPatterns(tester);
```

**Detects:**
- Images without alternative text (unless explicitly excluded)
- IconButtons without semantic labels
- Common accessibility violations

### 4. Form Accessibility

```dart
await AccessibilityTestHelper.checkFormAccessibility(tester);
```

**Validates:**
- TextFormField and TextField have semantic labels or hints
- Form elements are properly labeled for screen readers

### 5. Visual Accessibility

```dart
await AccessibilityTestHelper.checkVisualAccessibility(tester);
```

**Validates:**
- Text size meets minimum readability standards (12px+)
- Basic visual accessibility compliance

### 6. Basic Focus Testing

```dart
await AccessibilityTestHelper.testKeyboardNavigation(tester);
```

**LIMITED VALIDATION:**
- Verifies focus system is active
- Basic focus management presence check
- **NOT** comprehensive keyboard navigation flow testing

### 7. Semantic Tree Validation

```dart
await AccessibilityTestHelper.testScreenReaderCompatibility(tester);
```

**LIMITED VALIDATION:**
- Verifies semantic nodes exist
- Basic semantic tree structure presence
- **NOT** actual screen reader experience testing

## Real-World Examples

### Example 1: Login Form Testing

```dart
testWidgets('Login form accessibility', (tester) async {
  await tester.pumpWidget(LoginForm());
  
  await AccessibilityTestHelper.runFullAccessibilityAudit(
    tester,
    requiredLabels: [
      'Email Address',
      'Password',
      'Login',
      'Forgot Password',
    ],
  );
});
```

### Example 2: Complex Widget with Custom Checks

```dart
testWidgets('Dashboard accessibility audit', (tester) async {
  await tester.pumpWidget(Dashboard());
  
  // Run base accessibility tests
  await AccessibilityTestHelper.runAccessibilityTestSuite(
    tester,
    requiredLabels: ['Menu', 'Search', 'Profile'],
  );
  
  // Add specific checks
  await AccessibilityTestHelper.checkForAntiPatterns(tester);
  await AccessibilityTestHelper.testKeyboardNavigation(tester);
});
```

### Example 3: Form-Heavy Widget

```dart
testWidgets('Registration form accessibility', (tester) async {
  await tester.pumpWidget(RegistrationForm());
  
  await AccessibilityTestHelper.runFullAccessibilityAudit(
    tester,
    requiredLabels: [
      'First Name',
      'Last Name', 
      'Email',
      'Phone Number',
      'Create Account',
    ],
    includeFormCheck: true,
    includeVisualCheck: true,
  );
});
```

## Configuration and Setup

### Test Setup

```dart
void main() {
  setUp(() {
    AccessibilityTestHelper.configure();
  });
  
  // Your tests...
}
```

### Custom Accessibility Requirements

```dart
testWidgets('Custom accessibility validation', (tester) async {
  await tester.pumpWidget(MyWidget());
  
  // Custom semantic label validation
  await AccessibilityTestHelper.expectProperSemanticLabels(
    tester,
    requiredLabels: ['Custom Action', 'Special Button'],
  );
  
  // Individual checks as needed
  await AccessibilityTestHelper.checkForAntiPatterns(tester);
  await AccessibilityTestHelper.expectProperTouchTargets(tester);
});
```

## Best Practices

### 1. Integration into Widget Tests

Always include accessibility testing in your widget tests:

```dart
testWidgets('Widget functionality and accessibility', (tester) async {
  await tester.pumpWidget(MyWidget());
  
  // Test functionality
  await tester.tap(find.byKey(Key('submit')));
  await tester.pump();
  expect(find.text('Success'), findsOneWidget);
  
  // Test accessibility
  await AccessibilityTestHelper.runFullAccessibilityAudit(tester);
});
```

### 2. Label Requirements Planning

Plan your semantic labels before implementation:

```dart
// Define expected labels based on design
const expectedLabels = [
  'Add Item',
  'Remove Item', 
  'Item List',
  'Search Items',
];

testWidgets('Item list accessibility', (tester) async {
  await tester.pumpWidget(ItemList());
  
  await AccessibilityTestHelper.runFullAccessibilityAudit(
    tester,
    requiredLabels: expectedLabels,
  );
});
```

### 3. Selective Testing

Use selective testing for performance optimization:

```dart
testWidgets('Performance-optimized accessibility test', (tester) async {
  await tester.pumpWidget(LargeWidget());
  
  // Skip expensive checks for large widgets
  await AccessibilityTestHelper.runFullAccessibilityAudit(
    tester,
    includeVisualCheck: false, // Skip for performance
    includeAntiPatternCheck: true,
    includeFormCheck: true,
  );
});
```

## Troubleshooting

### Common Issues

1. **IconButton without semantic label**
   ```dart
   // Wrong
   IconButton(icon: Icon(Icons.add), onPressed: () {})
   
   // Correct
   IconButton(
     icon: Icon(Icons.add),
     onPressed: () {},
     tooltip: 'Add Item', // Provides semantic label
   )
   ```

2. **Image without alternative text**
   ```dart
   // Wrong
   Image.asset('assets/logo.png')
   
   // Correct
   Image.asset(
     'assets/logo.png',
     semanticLabel: 'Company Logo',
   )
   ```

3. **Form field without proper labeling**
   ```dart
   // Wrong
   TextField()
   
   // Correct
   TextField(
     decoration: InputDecoration(
       labelText: 'Email Address',
       hintText: 'Enter your email',
     ),
   )
   ```

### Performance Considerations

- Use selective testing for large widgets
- Consider running full audits only on critical user paths
- Cache test results when possible

## Integration with CI/CD

Add accessibility testing to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run accessibility tests
  run: flutter test test/ --coverage --reporter=github
```

## Standards Alignment (With Limitations)

This testing approach provides **partial support** for:
- **WCAG 2.1 AA principles** (limited to automatable checks only)
- **Flutter accessibility guidelines** (basic semantic patterns)
- **Platform compatibility** (semantic tree structure for iOS VoiceOver, Android TalkBack)

**CRITICAL DISCLAIMER**: These automated tests catch **common accessibility issues** but **DO NOT** guarantee WCAG 2.1 AA compliance. True compliance requires:
- Manual accessibility audits
- Real screen reader testing
- User testing with assistive technology users
- Professional accessibility review

## What WCAG 2.1 AA Actually Requires (That We Can't Test)

**WCAG 2.1 AA compliance includes requirements that cannot be automated in Flutter:**

1. **Color Contrast**: 4.5:1 ratio for normal text, 3:1 for large text (requires visual analysis)
2. **Keyboard Navigation**: Full keyboard access to all interactive elements (requires complex flow testing)
3. **Focus Management**: Logical focus order and visible focus indicators (requires visual inspection)
4. **Content Structure**: Proper heading hierarchy and landmarks (requires semantic analysis)
5. **Alternative Text**: Meaningful descriptions, not just presence (requires human judgment)
6. **Audio/Video**: Captions, audio descriptions, transcripts (not applicable to most mobile apps)
7. **Timing**: User control over time limits (requires functional testing)
8. **Seizures**: No content flashes more than 3 times per second (requires visual analysis)

**Our automated tests cover approximately 20-30% of WCAG 2.1 AA requirements.**