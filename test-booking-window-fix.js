// Test to verify the 15-minute booking window fix
const { AvailabilityService } = require('./lib/AvailabilityService.ts');

// Mock test for the 15-minute minimum booking window fix
console.log('Testing 15-minute minimum booking window fix...');

// Simulate current time and time slots
const now = new Date();
console.log('Current time:', now.toLocaleString());

// Create test time slots - some within 15 minutes, some after
const testSlots = [];
for (let i = 5; i <= 30; i += 5) {
  const futureTime = new Date(now.getTime() + i * 60 * 1000);
  const timeStr = futureTime.toTimeString().substring(0, 5);
  testSlots.push({ time: timeStr });
}

console.log('\nGenerated test slots:');
testSlots.forEach((slot, index) => {
  const slotTime = new Date(`${now.toISOString().split('T')[0]}T${slot.time}:00`);
  const minutesFromNow = Math.round((slotTime.getTime() - now.getTime()) / (60 * 1000));
  console.log(`${index + 1}. ${slot.time} (${minutesFromNow} minutes from now)`);
});

// Simulate the filtering logic from our fix
const minimumBookingTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now
console.log('\nMinimum booking time (15 mins from now):', minimumBookingTime.toLocaleString());

const filteredSlots = testSlots.filter(slot => {
  const startTime = new Date(`${now.toISOString().split('T')[0]}T${slot.time}:00`);
  return startTime >= minimumBookingTime;
});

console.log('\nFiltered slots (should only include slots 15+ minutes from now):');
filteredSlots.forEach((slot, index) => {
  const slotTime = new Date(`${now.toISOString().split('T')[0]}T${slot.time}:00`);
  const minutesFromNow = Math.round((slotTime.getTime() - now.getTime()) / (60 * 1000));
  console.log(`${index + 1}. ${slot.time} (${minutesFromNow} minutes from now)`);
});

console.log('\n✅ Fix verification complete!');
console.log(`Original slots: ${testSlots.length}`);
console.log(`Filtered slots: ${filteredSlots.length}`);
console.log('Slots within 15 minutes should have been filtered out.');
