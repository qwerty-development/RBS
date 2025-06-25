// lib/constants/tableConfig.ts
export const TABLE_TYPE_CONFIG = {
    window: { 
      color: "#3b82f6", 
      icon: "🪟", 
      label: "Window",
      description: "Tables by the window with natural light"
    },
    patio: { 
      color: "#10b981", 
      icon: "🌿", 
      label: "Patio",
      description: "Outdoor seating area"
    },
    booth: { 
      color: "#8b5cf6", 
      icon: "🛋️", 
      label: "Booth",
      description: "Private booth seating"
    },
    standard: { 
      color: "#6b7280", 
      icon: "🪑", 
      label: "Standard",
      description: "Regular dining tables"
    },
    bar: { 
      color: "#f59e0b", 
      icon: "🍺", 
      label: "Bar",
      description: "Bar counter seating"
    },
    private: { 
      color: "#ef4444", 
      icon: "🚪", 
      label: "Private",
      description: "Private dining room"
    },
  } as const;
  
  export const TABLE_FEATURES = {
    window_view: { label: "Window View", icon: "🪟" },
    corner: { label: "Corner Table", icon: "📐" },
    quiet: { label: "Quiet Area", icon: "🤫" },
    romantic: { label: "Romantic Setting", icon: "❤️" },
    family: { label: "Family Friendly", icon: "👨‍👩‍👧‍👦" },
    outdoor: { label: "Outdoor", icon: "☀️" },
    garden_view: { label: "Garden View", icon: "🌳" },
    accessible: { label: "Wheelchair Accessible", icon: "♿" },
    highchair: { label: "High Chair Available", icon: "👶" },
  } as const;