/**
 * Manual Test Script for Zone Coordinate Validation
 * 
 * This script tests the isValidCoordinate helper function and validates
 * the coordinate validation logic in the admin controller.
 * 
 * Run with: node backend/src/tests/manual-zone-test.js
 */

// Helper function from admin.controller.js
function isValidCoordinate(coord) {
  if (!coord) return false;
  if (typeof coord.lat !== 'number') return false;
  if (typeof coord.lng !== 'number') return false;
  if (coord.lat < -90 || coord.lat > 90) return false;
  if (coord.lng < -180 || coord.lng > 180) return false;
  return true;
}

// Test cases
const testCases = [
  {
    name: 'Valid coordinate',
    coord: { lat: 28.6139, lng: 77.2090 },
    expected: true
  },
  {
    name: 'Invalid latitude (> 90)',
    coord: { lat: 91, lng: 77.2090 },
    expected: false
  },
  {
    name: 'Invalid latitude (< -90)',
    coord: { lat: -91, lng: 77.2090 },
    expected: false
  },
  {
    name: 'Invalid longitude (> 180)',
    coord: { lat: 28.6139, lng: 181 },
    expected: false
  },
  {
    name: 'Invalid longitude (< -180)',
    coord: { lat: 28.6139, lng: -181 },
    expected: false
  },
  {
    name: 'Missing lat property',
    coord: { lng: 77.2090 },
    expected: false
  },
  {
    name: 'Missing lng property',
    coord: { lat: 28.6139 },
    expected: false
  },
  {
    name: 'Null coordinate',
    coord: null,
    expected: false
  },
  {
    name: 'Undefined coordinate',
    coord: undefined,
    expected: false
  },
  {
    name: 'String lat value',
    coord: { lat: "28.6139", lng: 77.2090 },
    expected: false
  },
  {
    name: 'Boundary: lat = 90',
    coord: { lat: 90, lng: 77.2090 },
    expected: true
  },
  {
    name: 'Boundary: lat = -90',
    coord: { lat: -90, lng: 77.2090 },
    expected: true
  },
  {
    name: 'Boundary: lng = 180',
    coord: { lat: 28.6139, lng: 180 },
    expected: true
  },
  {
    name: 'Boundary: lng = -180',
    coord: { lat: 28.6139, lng: -180 },
    expected: true
  }
];

// Run tests
console.log('Testing isValidCoordinate function...\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = isValidCoordinate(test.coord);
  const status = result === test.expected ? '✓ PASS' : '✗ FAIL';
  
  if (result === test.expected) {
    passed++;
  } else {
    failed++;
  }
  
  console.log(`${index + 1}. ${status} - ${test.name}`);
  if (result !== test.expected) {
    console.log(`   Expected: ${test.expected}, Got: ${result}`);
    console.log(`   Coordinate:`, test.coord);
  }
});

console.log(`\n${'='.repeat(50)}`);
console.log(`Total: ${testCases.length} tests`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`${'='.repeat(50)}\n`);

// Test coordinate array validation logic
console.log('Testing coordinate array validation logic...\n');

const arrayTestCases = [
  {
    name: 'Valid 5 coordinates',
    coordinates: [
      { lat: 28.6139, lng: 77.2090 },
      { lat: 28.6140, lng: 77.2091 },
      { lat: 28.6141, lng: 77.2092 },
      { lat: 28.6142, lng: 77.2093 },
      { lat: 28.6143, lng: 77.2094 }
    ],
    shouldPass: true
  },
  {
    name: 'Only 3 coordinates (invalid)',
    coordinates: [
      { lat: 28.6139, lng: 77.2090 },
      { lat: 28.6140, lng: 77.2091 },
      { lat: 28.6141, lng: 77.2092 }
    ],
    shouldPass: false
  },
  {
    name: '6 coordinates (invalid)',
    coordinates: [
      { lat: 28.6139, lng: 77.2090 },
      { lat: 28.6140, lng: 77.2091 },
      { lat: 28.6141, lng: 77.2092 },
      { lat: 28.6142, lng: 77.2093 },
      { lat: 28.6143, lng: 77.2094 },
      { lat: 28.6144, lng: 77.2095 }
    ],
    shouldPass: false
  },
  {
    name: 'One invalid coordinate in array',
    coordinates: [
      { lat: 28.6139, lng: 77.2090 },
      { lat: 91, lng: 77.2091 }, // Invalid
      { lat: 28.6141, lng: 77.2092 },
      { lat: 28.6142, lng: 77.2093 },
      { lat: 28.6143, lng: 77.2094 }
    ],
    shouldPass: false
  }
];

arrayTestCases.forEach((test, index) => {
  const isValidLength = Array.isArray(test.coordinates) && test.coordinates.length === 5;
  const allValid = test.coordinates.every(coord => isValidCoordinate(coord));
  const passes = isValidLength && allValid;
  
  const status = passes === test.shouldPass ? '✓ PASS' : '✗ FAIL';
  
  console.log(`${index + 1}. ${status} - ${test.name}`);
  if (passes !== test.shouldPass) {
    console.log(`   Expected to ${test.shouldPass ? 'pass' : 'fail'}, but ${passes ? 'passed' : 'failed'}`);
    console.log(`   Length check: ${isValidLength}, All valid: ${allValid}`);
  }
});

console.log('\n✓ All manual tests completed!\n');
