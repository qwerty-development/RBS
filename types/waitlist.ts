// Database enum types - exact match with PostgreSQL enums

// table_type enum from database
export type TableType = "any" | "booth" | "window" | "patio" | "standard" | "bar" | "private";

// waiting_status enum from database  
export type WaitingStatus = "active" | "notified" | "booked" | "expired";

// Table type display information
export const TABLE_TYPE_INFO = {
  any: { label: "Any", icon: "🍽️", description: "No preference" },
  booth: { label: "Booth", icon: "🛋️", description: "Cozy enclosed seating" },
  window: { label: "Window", icon: "🪟", description: "Tables with a view" },
  patio: { label: "Patio", icon: "🌿", description: "Outdoor dining" },
  standard: { label: "Standard", icon: "🪑", description: "Regular table seating" },
  bar: { label: "Bar", icon: "🍷", description: "Bar counter seating" },
  private: { label: "Private", icon: "🔒", description: "Private dining room" },
} as const;

// Array of all valid table types for iteration
export const TABLE_TYPES_ARRAY: readonly TableType[] = [
  "any",
  "booth", 
  "window",
  "patio", 
  "standard",
  "bar",
  "private"
] as const;

// Array of all valid waiting statuses
export const WAITING_STATUSES_ARRAY: readonly WaitingStatus[] = [
  "active",
  "notified",
  "booked", 
  "expired"
] as const;
