/**
 * Phase 2C Verification Script
 *
 * Demonstrates timezone-aware week filtering for schedule queries
 */

import { getDateFromISOWeek, getWeekBoundaries } from '../utils/isoWeekUtils';

console.log('='.repeat(80));
console.log('PHASE 2C: BACKEND - SCHEDULE FILTERING BY WEEK');
console.log('='.repeat(80));
console.log();

// Test Case 1: Asia/Tokyo - Week 1, 2024
console.log('TEST CASE 1: Week 1, 2024 in Asia/Tokyo (UTC+9)');
console.log('-'.repeat(80));

const tokyoWeekStart = getDateFromISOWeek(2024, 1, 'Asia/Tokyo');
const tokyoBoundaries = getWeekBoundaries(tokyoWeekStart, 'Asia/Tokyo');

console.log('Week Start (User TZ): Monday 2024-01-01 00:00 JST');
console.log('Week Start (UTC):    ', tokyoBoundaries.weekStart.toISOString());
console.log('Expected:            ', '2023-12-31T15:00:00.000Z');
console.log('Match:               ', tokyoBoundaries.weekStart.toISOString() === '2023-12-31T15:00:00.000Z' ? '✓' : '✗');
console.log();

console.log('Week End (User TZ):   Sunday 2024-01-07 23:59:59.999 JST');
console.log('Week End (UTC):      ', tokyoBoundaries.weekEnd.toISOString());
console.log('Expected:            ', '2024-01-07T14:59:59.999Z');
console.log('Match:               ', tokyoBoundaries.weekEnd.toISOString() === '2024-01-07T14:59:59.999Z' ? '✓' : '✗');
console.log();

// Test Case 2: Inclusion/Exclusion Examples
console.log('SCHEDULE INCLUSION/EXCLUSION EXAMPLES:');
console.log('-'.repeat(80));

const schedules = [
  {
    datetime: new Date('2023-12-31T14:59:00.000Z'),
    localTime: 'Sunday 2023-12-31 23:59 JST',
    included: false,
    reason: 'Before week boundary (Sunday of previous week)'
  },
  {
    datetime: new Date('2023-12-31T15:00:00.000Z'),
    localTime: 'Monday 2024-01-01 00:00 JST',
    included: true,
    reason: 'At week start boundary'
  },
  {
    datetime: new Date('2024-01-01T05:00:00.000Z'),
    localTime: 'Monday 2024-01-01 14:00 JST',
    included: true,
    reason: 'Within week (Monday afternoon)'
  },
  {
    datetime: new Date('2024-01-07T10:00:00.000Z'),
    localTime: 'Sunday 2024-01-07 19:00 JST',
    included: true,
    reason: 'Within week (Sunday evening)'
  },
  {
    datetime: new Date('2024-01-07T14:59:59.999Z'),
    localTime: 'Sunday 2024-01-07 23:59:59.999 JST',
    included: true,
    reason: 'At week end boundary'
  },
  {
    datetime: new Date('2024-01-07T15:00:00.000Z'),
    localTime: 'Monday 2024-01-08 00:00 JST',
    included: false,
    reason: 'After week boundary (Monday of next week)'
  }
];

schedules.forEach((schedule) => {
  const isIncluded =
    schedule.datetime >= tokyoBoundaries.weekStart &&
    schedule.datetime <= tokyoBoundaries.weekEnd;

  const status = isIncluded === schedule.included ? '✓' : '✗';
  const icon = schedule.included ? 'INCLUDE' : 'EXCLUDE';

  console.log(`${status} ${icon}: ${schedule.localTime}`);
  console.log(`   UTC: ${schedule.datetime.toISOString()}`);
  console.log(`   Reason: ${schedule.reason}`);
  console.log();
});

// Test Case 3: America/Los_Angeles - Week 1, 2024
console.log('TEST CASE 2: Week 1, 2024 in America/Los_Angeles (UTC-8)');
console.log('-'.repeat(80));

const laWeekStart = getDateFromISOWeek(2024, 1, 'America/Los_Angeles');
const laBoundaries = getWeekBoundaries(laWeekStart, 'America/Los_Angeles');

console.log('Week Start (User TZ): Monday 2024-01-01 00:00 PST');
console.log('Week Start (UTC):    ', laBoundaries.weekStart.toISOString());
console.log('Expected:            ', '2024-01-01T08:00:00.000Z');
console.log('Match:               ', laBoundaries.weekStart.toISOString() === '2024-01-01T08:00:00.000Z' ? '✓' : '✗');
console.log();

console.log('Week End (User TZ):   Sunday 2024-01-07 23:59:59.999 PST');
console.log('Week End (UTC):      ', laBoundaries.weekEnd.toISOString());
console.log('Expected:            ', '2024-01-08T07:59:59.999Z');
console.log('Match:               ', laBoundaries.weekEnd.toISOString() === '2024-01-08T07:59:59.999Z' ? '✓' : '✗');
console.log();

// Test Case 4: Europe/Paris - Week 1, 2024
console.log('TEST CASE 3: Week 1, 2024 in Europe/Paris (UTC+1)');
console.log('-'.repeat(80));

const parisWeekStart = getDateFromISOWeek(2024, 1, 'Europe/Paris');
const parisBoundaries = getWeekBoundaries(parisWeekStart, 'Europe/Paris');

console.log('Week Start (User TZ): Monday 2024-01-01 00:00 CET');
console.log('Week Start (UTC):    ', parisBoundaries.weekStart.toISOString());
console.log('Expected:            ', '2023-12-31T23:00:00.000Z');
console.log('Match:               ', parisBoundaries.weekStart.toISOString() === '2023-12-31T23:00:00.000Z' ? '✓' : '✗');
console.log();

console.log('Week End (User TZ):   Sunday 2024-01-07 23:59:59.999 CET');
console.log('Week End (UTC):      ', parisBoundaries.weekEnd.toISOString());
console.log('Expected:            ', '2024-01-07T22:59:59.999Z');
console.log('Match:               ', parisBoundaries.weekEnd.toISOString() === '2024-01-07T22:59:59.999Z' ? '✓' : '✗');
console.log();

// Summary
console.log('='.repeat(80));
console.log('VERIFICATION COMPLETE');
console.log('='.repeat(80));
console.log();
console.log('Key Points:');
console.log('1. Week boundaries calculated in user timezone (Monday 00:00 - Sunday 23:59:59.999)');
console.log('2. Boundaries converted to UTC for database queries');
console.log('3. Schedules filtered accurately according to user local week');
console.log('4. Handles timezone offsets (positive and negative)');
console.log('5. Correctly excludes schedules outside week boundaries');
console.log();
