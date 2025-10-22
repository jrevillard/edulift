# ARB Pluralization Guide - ICU Message Format

## Overview

This guide explains the correct pluralization format for Application Resource Bundle (ARB) files in Flutter applications using ICU (International Components for Unicode) message format.

## CRITICAL ISSUE RESOLVED

**Phase 1 Vehicle ARB keys had incorrect pluralization format** - they used simple parameter substitution instead of proper ICU plural format, which caused grammatical errors in UI text.

## Correct ICU Pluralization Pattern

### ✅ CORRECT FORMAT
```json
"keyName": "{count, plural, =0{zero form} =1{one form} other{many form}}",
"@keyName": {
  "description": "Description with ICU pluralization",
  "placeholders": {
    "count": {
      "type": "int",
      "description": "Count value for pluralization"
    }
  }
}
```

### ❌ WRONG FORMAT (What was fixed)
```json
"keyName": "Simple text with {count} items",
"@keyName": {
  "description": "Simple description",
  "placeholders": {
    "count": {
      "type": "int",
      "description": "Count value"
    }
  }
}
```

## ICU Plural Rules

### English Rules
- `=0` - Exactly zero (optional: "no items", "empty")
- `=1` - Exactly one ("1 item", "a single item")
- `other` - Everything else ("2 items", "5 items", "many items")

### French Rules
- `=0` - Exactly zero ("aucun élément")
- `=1` - Exactly one ("1 élément")
- `other` - Everything else ("2 éléments", "plusieurs éléments")

**Note**: French uses `=1` for singular, `other` for plural (including zero in some contexts).

## Fixed Vehicle Keys

### Before/After Examples

#### 1. passengerSeats
**❌ BEFORE:**
```json
"passengerSeats": "Passenger seats: {count} seats"
```

**✅ AFTER:**
```json
"passengerSeats": "{count, plural, =0{no passenger seats} =1{{count} passenger seat} other{{count} passenger seats}}"
```

#### 2. totalCapacityLabel
**❌ BEFORE:**
```json
"totalCapacityLabel": "Total capacity: {count} seats"
```

**✅ AFTER:**
```json
"totalCapacityLabel": "{count, plural, =0{no seats} =1{{count} seat total capacity} other{{count} seats total capacity}}"
```

#### 3. childTransportInfo
**❌ BEFORE:**
```json
"childTransportInfo": "This vehicle can transport up to {count} children"
```

**✅ AFTER:**
```json
"childTransportInfo": "{count, plural, =0{This vehicle cannot transport children} =1{This vehicle can transport up to {count} child} other{This vehicle can transport up to {count} children}}"
```

## French Translations

### French Examples
```json
"passengerSeats": "{count, plural, =0{aucune place passager} =1{{count} place passager} other{{count} places passagers}}",
"seatsRecommended": "{count, plural, =1{Recommandé: {count} place} other{Recommandé: {count} places}}",
"childTransportInfo": "{count, plural, =0{Ce véhicule ne peut pas transporter d'enfants} =1{Ce véhicule peut transporter jusqu'à {count} enfant} other{Ce véhicule peut transporter jusqu'à {count} enfants}}"
```

## Dart Integration

### Usage in Dart Code
```dart
// Correct - ICU pluralization handled automatically
final message = AppLocalizations.of(context).passengerSeats(seatCount);

// Examples of generated text:
// seatCount = 0: "no passenger seats"
// seatCount = 1: "1 passenger seat"
// seatCount = 5: "5 passenger seats"
```

### Key Benefits
- **Grammatical Correctness**: Proper singular/plural forms
- **Internationalization**: Language-specific plural rules
- **User Experience**: Natural-sounding text
- **Maintainability**: Centralized pluralization logic

## Template for Future Phases

### New Count-Based Keys
```json
"newCountKey": "{count, plural, =0{zero context} =1{{count} singular unit} other{{count} plural units}}",
"@newCountKey": {
  "description": "Description with ICU pluralization",
  "placeholders": {
    "count": {
      "type": "int",
      "description": "Count for pluralization"
    }
  }
}
```

### French Translation Template
```json
"newCountKey": "{count, plural, =0{contexte zéro} =1{{count} unité singulière} other{{count} unités plurielles}}",
"@newCountKey": {
  "description": "Description avec pluralisation ICU",
  "placeholders": {
    "count": {
      "type": "int",
      "description": "Compteur pour pluralisation"
    }
  }
}
```

## Validation Checklist

Before adding new count-based ARB keys:

- [ ] Uses ICU plural format `{count, plural, ...}`
- [ ] Includes `=1` case for singular
- [ ] Includes `other` case for plural
- [ ] Optionally includes `=0` for zero case
- [ ] Placeholder type is `int` not `String`
- [ ] Description mentions "ICU pluralization"
- [ ] Both English and French versions implemented
- [ ] Dart code uses the key with count parameter

## Common Mistakes to Avoid

1. **String type instead of int**: Use `"type": "int"` for count placeholders
2. **Missing =1 case**: Always include singular form
3. **Simple interpolation**: Don't use `{count} items` - use ICU format
4. **Inconsistent translations**: Ensure French follows French plural rules
5. **Missing @annotations**: Always update description to mention ICU pluralization

## References

- [ICU Message Format Guide](https://unicode-org.github.io/icu/userguide/format_parse/messages/)
- [Flutter Internationalization](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization)
- [ARB File Format](https://github.com/google/app-resource-bundle/wiki/ApplicationResourceBundleSpecification)

---

**This guide ensures consistent, grammatically correct pluralization across all phases of the project.**