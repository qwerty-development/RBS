// Test for Waitlist Functionality
// This is a simple test to ensure the waitlist components work correctly

import { WaitlistEntry } from "@/components/booking/WaitlistConfirmationModal";

// Mock waitlist entry for testing
const mockWaitlistEntry: WaitlistEntry = {
  restaurantId: "test-restaurant-id",
  userId: "test-user-id",
  desiredDate: "2025-08-07",
  desiredTimeRange: "[18:00,20:00)",
  partySize: 4,
  tableTypes: ["booth", "window"],
  specialRequests: "Anniversary dinner, quiet table please",
};

console.log("Mock waitlist entry:", mockWaitlistEntry);

export { mockWaitlistEntry };
