// Test script to verify the 15-minute minimum booking time filtering
const now = new Date();
console.log("Current time:", now.toLocaleString());

// Generate some test time slots for today
const testSlots = [];
const currentHour = now.getHours();
const currentMinute = now.getMinutes();

// Generate slots starting from current time
for (let h = currentHour; h <= currentHour + 2; h++) {
  for (let m = 0; m < 60; m += 15) {
    if (h === currentHour && m < currentMinute) {
      continue; // Skip past times
    }

    const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    testSlots.push({ time: timeStr });
  }
}

console.log("\nGenerated test slots:");
testSlots.slice(0, 10).forEach((slot, index) => {
  const slotTime = new Date(
    `${now.toISOString().split("T")[0]}T${slot.time}:00`,
  );
  const minutesFromNow = Math.round(
    (slotTime.getTime() - now.getTime()) / (60 * 1000),
  );
  console.log(
    `${index + 1}. ${slot.time} (${minutesFromNow} minutes from now)`,
  );
});

// Test the OLD filtering logic (what was causing the issue)
console.log("\n--- OLD LOGIC (problematic) ---");
const oldFilteredSlots = testSlots.filter((slot) => {
  const startTime = new Date(
    `${now.toISOString().split("T")[0]}T${slot.time}:00`,
  );
  return startTime > now; // This was the problem - should be >= minimumBookingTime
});

console.log("Old filtered slots (only past filtering):");
oldFilteredSlots.slice(0, 5).forEach((slot, index) => {
  const slotTime = new Date(
    `${now.toISOString().split("T")[0]}T${slot.time}:00`,
  );
  const minutesFromNow = Math.round(
    (slotTime.getTime() - now.getTime()) / (60 * 1000),
  );
  console.log(
    `${index + 1}. ${slot.time} (${minutesFromNow} minutes from now)`,
  );
});

// Test the NEW filtering logic (our fix)
console.log("\n--- NEW LOGIC (fixed) ---");
const minimumBookingTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now
console.log(
  "Minimum booking time (15 mins from now):",
  minimumBookingTime.toLocaleString(),
);

const newFilteredSlots = testSlots.filter((slot) => {
  const startTime = new Date(
    `${now.toISOString().split("T")[0]}T${slot.time}:00`,
  );
  return startTime > minimumBookingTime; // Fixed logic
});

console.log("New filtered slots (15+ minutes from now):");
newFilteredSlots.slice(0, 5).forEach((slot, index) => {
  const slotTime = new Date(
    `${now.toISOString().split("T")[0]}T${slot.time}:00`,
  );
  const minutesFromNow = Math.round(
    (slotTime.getTime() - now.getTime()) / (60 * 1000),
  );
  console.log(
    `${index + 1}. ${slot.time} (${minutesFromNow} minutes from now)`,
  );
});

// Show the difference
console.log("\n--- COMPARISON ---");
console.log(`Old logic would show: ${oldFilteredSlots.length} slots`);
console.log(`New logic shows: ${newFilteredSlots.length} slots`);
console.log(
  `Difference: ${oldFilteredSlots.length - newFilteredSlots.length} slots filtered out by 15-min rule`,
);

// Show which slots would be problematic (the ones that would cause booking errors)
const problematicSlots = oldFilteredSlots.filter((slot) => {
  const slotTime = new Date(
    `${now.toISOString().split("T")[0]}T${slot.time}:00`,
  );
  return slotTime <= minimumBookingTime;
});

if (problematicSlots.length > 0) {
  console.log('\nProblematic slots (would cause "15 minutes minimum" error):');
  problematicSlots.forEach((slot, index) => {
    const slotTime = new Date(
      `${now.toISOString().split("T")[0]}T${slot.time}:00`,
    );
    const minutesFromNow = Math.round(
      (slotTime.getTime() - now.getTime()) / (60 * 1000),
    );
    console.log(
      `${index + 1}. ${slot.time} (${minutesFromNow} minutes from now) ❌`,
    );
  });
} else {
  console.log("\n✅ No problematic slots found!");
}
