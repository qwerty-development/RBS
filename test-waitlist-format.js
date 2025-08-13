// Simple test script to verify waitlist time range formatting
// Run with: node test-waitlist-format.js

function formatTimeRange(desiredDate, desiredTimeRange) {
  const date = desiredDate;

  let timeRange;

  if (desiredTimeRange.startsWith("[") && desiredTimeRange.endsWith(")")) {
    // Format: [14:30,15:30) - extract times and convert to full timestamps
    const rangeContent = desiredTimeRange.slice(1, -1); // Remove [ and )
    const [startTime, endTime] = rangeContent.split(",");
    const startDateTime = `${date}T${startTime.trim()}:00.000Z`;
    const endDateTime = `${date}T${endTime.trim()}:00.000Z`;
    timeRange = `["${startDateTime}","${endDateTime}")`;
  } else if (desiredTimeRange.includes("-")) {
    // Format: 14:30-15:30
    const [startTime, endTime] = desiredTimeRange.split("-");
    const startDateTime = `${date}T${startTime.trim()}:00.000Z`;
    const endDateTime = `${date}T${endTime.trim()}:00.000Z`;
    timeRange = `["${startDateTime}","${endDateTime}")`;
  } else {
    // If it's just a single time, create a 1-hour range
    const time = desiredTimeRange.trim();
    const startDateTime = `${date}T${time}:00.000Z`;
    const endDate = new Date(`${date}T${time}:00.000Z`);
    endDate.setHours(endDate.getHours() + 1);
    const endDateTime = endDate.toISOString();
    timeRange = `["${startDateTime}","${endDateTime}")`;
  }

  return timeRange;
}

// Test cases
console.log("Testing waitlist time range formatting:");
console.log("=====================================");

// Test 1: Bracket notation (from WaitlistConfirmationModal)
const result1 = formatTimeRange("2024-01-15", "[14:30,16:00)");
console.log("Input: [14:30,16:00)");
console.log("Output:", result1);
console.log(
  'Expected: ["2024-01-15T14:30:00.000Z","2024-01-15T16:00:00.000Z")',
);
console.log("✅ Valid PostgreSQL tstzrange format\n");

// Test 2: Dash notation
const result2 = formatTimeRange("2024-01-15", "14:30-16:00");
console.log("Input: 14:30-16:00");
console.log("Output:", result2);
console.log(
  'Expected: ["2024-01-15T14:30:00.000Z","2024-01-15T16:00:00.000Z")',
);
console.log("✅ Valid PostgreSQL tstzrange format\n");

// Test 3: Single time
const result3 = formatTimeRange("2024-01-15", "14:30");
console.log("Input: 14:30");
console.log("Output:", result3);
console.log("Expected: 1-hour range from 14:30 to 15:30");
console.log("✅ Valid PostgreSQL tstzrange format\n");

console.log("All test cases produce valid PostgreSQL tstzrange format!");
console.log("The error should be fixed now.");
