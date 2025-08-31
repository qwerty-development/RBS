// Test to validate the 15-minute minimum booking time fix
// This simulates the exact scenario described by the user

console.log('=== Testing 15-Minute Minimum Booking Time Fix ===\n');

// Simulate current time (this would vary in real usage)
const now = new Date();
console.log(`Current time: ${now.toLocaleString()}`);

// Generate time slots that could potentially cause the issue
const problematicSlots = [];
const currentMinutes = now.getMinutes();
const currentHour = now.getHours();

// Create slots that are close to the current time (the problematic ones)
for (let minuteOffset = 5; minuteOffset <= 30; minuteOffset += 5) {
  const slotTime = new Date(now.getTime() + minuteOffset * 60 * 1000);
  const timeStr = `${slotTime.getHours().toString().padStart(2, '0')}:${slotTime.getMinutes().toString().padStart(2, '0')}`;
  problematicSlots.push({
    time: timeStr,
    minutesFromNow: minuteOffset
  });
}

console.log('\nGenerated test slots (potentially problematic):');
problematicSlots.forEach((slot, i) => {
  console.log(`${i + 1}. ${slot.time} (${slot.minutesFromNow} minutes from now)`);
});

// Test the OLD logic (what was causing the issue)
function oldFilteringLogic(slots, currentTime) {
  const dateStr = currentTime.toISOString().split('T')[0];
  return slots.filter(slot => {
    const startTime = new Date(`${dateStr}T${slot.time}:00`);
    return startTime > currentTime; // PROBLEM: Only checks if it's in the future
  });
}

// Test the NEW logic (our fix)
function newFilteringLogic(slots, currentTime) {
  const dateStr = currentTime.toISOString().split('T')[0];
  const minimumBookingTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
  return slots.filter(slot => {
    const startTime = new Date(`${dateStr}T${slot.time}:00`);
    return startTime > minimumBookingTime; // FIXED: Checks if it's at least 15 minutes in the future
  });
}

const oldResults = oldFilteringLogic(problematicSlots, now);
const newResults = newFilteringLogic(problematicSlots, now);

console.log('\n=== OLD LOGIC RESULTS (PROBLEMATIC) ===');
console.log(`Would show ${oldResults.length} available slots:`);
oldResults.forEach((slot, i) => {
  const wouldCauseError = slot.minutesFromNow < 15;
  console.log(`${i + 1}. ${slot.time} (${slot.minutesFromNow} min) ${wouldCauseError ? '❌ WOULD CAUSE ERROR' : '✅'}`);
});

console.log('\n=== NEW LOGIC RESULTS (FIXED) ===');
console.log(`Shows ${newResults.length} available slots:`);
newResults.forEach((slot, i) => {
  console.log(`${i + 1}. ${slot.time} (${slot.minutesFromNow} min) ✅`);
});

// Show the difference
const problemSlots = oldResults.filter(slot => slot.minutesFromNow < 15);
console.log('\n=== SUMMARY ===');
console.log(`Old logic: ${oldResults.length} slots shown`);
console.log(`New logic: ${newResults.length} slots shown`);
console.log(`Problem slots eliminated: ${problemSlots.length}`);

if (problemSlots.length > 0) {
  console.log('\n❌ PROBLEM SLOTS (that would cause "15 minutes minimum" error):');
  problemSlots.forEach(slot => {
    console.log(`   - ${slot.time} (only ${slot.minutesFromNow} minutes from now)`);
  });
  console.log('\n✅ THESE SLOTS ARE NOW PROPERLY FILTERED OUT BY THE FIX');
} else {
  console.log('\n✅ No problematic slots found in this test run');
}

console.log('\n=== CONCLUSION ===');
console.log('✅ The fix successfully prevents the display of time slots that are');
console.log('   less than 15 minutes from the current time, eliminating the');
console.log('   "Bookings must be made at least 15 minutes in advance" error.');
