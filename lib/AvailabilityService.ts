// lib/availability/AvailabilityService.ts (Complete Implementation)
import { supabase } from "@/config/supabase";

export interface TimeSlot {
  time: string;
  available: boolean;
  tables?: Table[];
  requiresCombination?: boolean;
  totalCapacity?: number;
}

export interface TimeSlotBasic {
  time: string;
  available: boolean;
}

export interface SlotTableOptions {
  time: string;
  options: TableOption[];
  primaryOption: TableOption;
}

export interface TableOption {
  tables: Table[];
  requiresCombination: boolean;
  totalCapacity: number;
  tableTypes: string[];
  experienceTitle: string;
  experienceDescription: string;
  isPerfectFit: boolean;
  combinationInfo?: {
    primaryTable: Table;
    secondaryTable: Table;
    reason: string;
  };
}

export interface Table {
  id: string;
  table_number: string;
  capacity: number;
  min_capacity: number;
  max_capacity: number;
  table_type: string;
  is_combinable: boolean;
  priority_score: number;
  features?: string[];
}

export interface SlotAvailability {
  isAvailable: boolean;
  tables?: Table[];
  requiresCombination?: boolean;
  totalCapacity?: number;
}

export interface VIPBenefits {
  extended_booking_days: number;
  priority_booking: boolean;
}

export class AvailabilityService {
  private static instance: AvailabilityService;

  static getInstance() {
    if (!this.instance) {
      this.instance = new AvailabilityService();
    }
    return this.instance;
  }

  private async getMaxTurnTime(restaurantId: string): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('get_max_turn_time', {
        p_restaurant_id: restaurantId
      });
  
      if (error || !data) {
        console.warn('Could not fetch max turn time, using default');
        return 240; // 4 hours default
      }
  
      return data;
    } catch (error) {
      console.error('Error getting max turn time:', error);
      return 240;
    }
  }

  /**
   * Get available time slots WITHOUT table details (faster)
   */
  async getAvailableTimeSlots(
    restaurantId: string,
    date: Date,
    partySize: number,
    userId?: string
  ): Promise<TimeSlotBasic[]> {
    try {
      // 1. Get restaurant operating hours
      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("opening_time, closing_time, booking_window_days")
        .eq("id", restaurantId)
        .single();

      if (restaurantError || !restaurant) {
        console.error("Error fetching restaurant:", restaurantError);
        return [];
      }

      // 2. Check if date is within booking window
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const bookingDate = new Date(date);
      bookingDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((bookingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Check VIP extended booking window
      let maxBookingDays = restaurant.booking_window_days || 30;
      if (userId) {
        const vipBenefits = await this.getVIPBenefits(restaurantId, userId);
        if (vipBenefits?.extended_booking_days) {
          maxBookingDays = vipBenefits.extended_booking_days;
        }
      }

      if (daysDiff > maxBookingDays) {
        return [];
      }

      // 3. Generate time slots
      const baseSlots = await this.generate15MinuteSlots(
        restaurant.opening_time,
        restaurant.closing_time,
        restaurantId
      );

      // 4. Get turn time for party size
      const { data: turnTimeData } = await supabase.rpc("get_turn_time", {
        p_restaurant_id: restaurantId,
        p_party_size: partySize,
        p_booking_time: date.toISOString(),
      });

      const turnTime = turnTimeData || this.getDefaultTurnTime(partySize);
      const dateStr = date.toISOString().split("T")[0];

      // 5. Quick availability check (without table details)
      const availableSlots: TimeSlotBasic[] = [];

      for (const slot of baseSlots) {
        const startTime = new Date(`${dateStr}T${slot.time}:00`);
        const endTime = new Date(startTime.getTime() + turnTime * 60000);

        // Skip slots that are in the past
        if (startTime < new Date()) {
          continue;
        }

        // Quick check if ANY tables are available
        const hasAvailability = await this.quickAvailabilityCheck(
          restaurantId,
          startTime,
          endTime,
          partySize
        );

        if (hasAvailability) {
          availableSlots.push({
            time: slot.time,
            available: true,
          });
        }
      }

      return availableSlots;
    } catch (error) {
      console.error("Error getting available time slots:", error);
      return [];
    }
  }

  /**
   * Get detailed table options for a specific time slot
   */
  async getTableOptionsForSlot(
    restaurantId: string,
    date: Date,
    time: string,
    partySize: number
  ): Promise<SlotTableOptions | null> {
    try {
      const dateStr = date.toISOString().split("T")[0];
      const startTime = new Date(`${dateStr}T${time}:00`);
      
      // Get turn time
      const { data: turnTimeData } = await supabase.rpc("get_turn_time", {
        p_restaurant_id: restaurantId,
        p_party_size: partySize,
        p_booking_time: date.toISOString(),
      });

      const turnTime = turnTimeData || this.getDefaultTurnTime(partySize);
      const endTime = new Date(startTime.getTime() + turnTime * 60000);

      // Get ALL available tables for this slot
      const { data: availableTables, error } = await supabase.rpc(
        "get_available_tables",
        {
          p_restaurant_id: restaurantId,
          p_start_time: startTime.toISOString(),
          p_end_time: endTime.toISOString(),
          p_party_size: partySize,
        }
      );

      if (error || !availableTables || availableTables.length === 0) {
        // Try table combinations if no single tables available
        if (partySize > 4) {
          const combination = await this.findTableCombination(
            restaurantId,
            startTime,
            endTime,
            partySize
          );

          if (combination) {
            const combinationOption: TableOption = {
              tables: combination,
              requiresCombination: true,
              totalCapacity: combination.reduce((sum, t) => sum + t.capacity, 0),
              tableTypes: [...new Set(combination.map(t => t.table_type))],
              experienceTitle: "Private Group Arrangement",
              experienceDescription: "Multiple tables specially arranged together for your group dining experience",
              isPerfectFit: false,
              combinationInfo: {
                primaryTable: combination[0],
                secondaryTable: combination[1],
                reason: `Specially arranged for ${partySize} guests`,
              },
            };

            return {
              time,
              options: [combinationOption],
              primaryOption: combinationOption,
            };
          }
        }
        return null;
      }

      // Create options from available single tables
      const tableOptions = this.createOptimizedTableOptions(availableTables, partySize);
      
      if (tableOptions.length === 0) {
        return null;
      }

      // Select the best primary option
      const primaryOption = this.selectPrimaryOption(tableOptions, partySize);

      return {
        time,
        options: tableOptions,
        primaryOption,
      };
    } catch (error) {
      console.error("Error getting table options for slot:", error);
      return null;
    }
  }

  /**
   * OPTIMIZED: Create smart table options that prioritize perfect fits and experiences
   */
  private createOptimizedTableOptions(availableTables: Table[], partySize: number): TableOption[] {
    // Group tables by type
    const tablesByType = availableTables.reduce((groups, table) => {
      const type = table.table_type;
      if (!groups[type]) groups[type] = [];
      groups[type].push(table);
      return groups;
    }, {} as Record<string, Table[]>);

    const options: TableOption[] = [];

    // First pass: Find perfect fits (capacity exactly matches or +1)
    const perfectFitOptions = this.createPerfectFitOptions(tablesByType, partySize);
    options.push(...perfectFitOptions);

    // Second pass: Add other options only if they offer unique experiences
    // and we don't already have too many perfect fits
    if (perfectFitOptions.length < 3) {
      const additionalOptions = this.createAdditionalOptions(
        tablesByType, 
        partySize, 
        perfectFitOptions.map(opt => opt.tableTypes[0])
      );
      options.push(...additionalOptions);
    }

    // Sort by preference: perfect fits first, then by experience score
    return options.sort((a, b) => {
      if (a.isPerfectFit && !b.isPerfectFit) return -1;
      if (!a.isPerfectFit && b.isPerfectFit) return 1;
      
      const scoreA = this.getExperienceScore(a.tableTypes[0], partySize);
      const scoreB = this.getExperienceScore(b.tableTypes[0], partySize);
      return scoreB - scoreA;
    });
  }

  /**
   * Create options for tables that fit perfectly (capacity = party size or party size + 1)
   */
  private createPerfectFitOptions(tablesByType: Record<string, Table[]>, partySize: number): TableOption[] {
    const perfectOptions: TableOption[] = [];

    Object.entries(tablesByType).forEach(([tableType, tables]) => {
      // Find perfect fit tables (exact match or +1)
      const perfectFitTables = tables.filter(table => 
        table.capacity >= partySize && table.capacity <= partySize + 1
      );

      if (perfectFitTables.length > 0) {
        // Sort by priority and pick the best one
        const sortedTables = [...perfectFitTables].sort((a, b) => {
          const aDiff = a.capacity - partySize;
          const bDiff = b.capacity - partySize;
          if (aDiff !== bDiff) return aDiff - bDiff; // Prefer exact match
          return (b.priority_score || 0) - (a.priority_score || 0);
        });

        const bestTable = sortedTables[0];
        const experience = this.getTableExperience(bestTable, partySize);

        perfectOptions.push({
          tables: [bestTable],
          requiresCombination: false,
          totalCapacity: bestTable.capacity,
          tableTypes: [bestTable.table_type],
          experienceTitle: experience.title,
          experienceDescription: experience.description,
          isPerfectFit: true,
        });
      }
    });

    return perfectOptions;
  }

  /**
   * Create additional options for unique experiences (only if not too much overcapacity)
   */
  private createAdditionalOptions(
    tablesByType: Record<string, Table[]>, 
    partySize: number, 
    existingTypes: string[]
  ): TableOption[] {
    const additionalOptions: TableOption[] = [];

    Object.entries(tablesByType).forEach(([tableType, tables]) => {
      // Skip if we already have this table type
      if (existingTypes.includes(tableType)) return;

      // Only consider tables that aren't massively oversized (max +3 capacity)
      const reasonableTables = tables.filter(table => 
        table.capacity >= partySize && table.capacity <= partySize + 3
      );

      if (reasonableTables.length > 0) {
        const sortedTables = [...reasonableTables].sort((a, b) => {
          const aDiff = a.capacity - partySize;
          const bDiff = b.capacity - partySize;
          if (aDiff !== bDiff) return aDiff - bDiff;
          return (b.priority_score || 0) - (a.priority_score || 0);
        });

        const bestTable = sortedTables[0];
        const experience = this.getTableExperience(bestTable, partySize);

        // Only add if it offers a meaningfully different experience
        if (this.isUniqueExperience(tableType, existingTypes)) {
          additionalOptions.push({
            tables: [bestTable],
            requiresCombination: false,
            totalCapacity: bestTable.capacity,
            tableTypes: [bestTable.table_type],
            experienceTitle: experience.title,
            experienceDescription: experience.description,
            isPerfectFit: bestTable.capacity <= partySize + 1,
          });
        }
      }
    });

    return additionalOptions;
  }

  /**
   * Get experience-focused title and description for a table
   */
  private getTableExperience(table: Table, partySize: number): { title: string; description: string } {
    const tableType = table.table_type;
    const isCozy = partySize <= 2;
    const isGroup = partySize >= 6;

    const experiences: Record<string, { title: string; description: string }> = {
      'booth': {
        title: isCozy ? 'Intimate Booth' : 'Cozy Booth Seating',
        description: isCozy 
          ? 'Private and romantic booth perfect for intimate dining'
          : 'Comfortable booth seating with privacy and warmth'
      },
      'window': {
        title: 'Window View',
        description: isCozy
          ? 'Scenic window seating with natural light and views'
          : 'Bright window table with lovely views while you dine'
      },
      'patio': {
        title: 'Outdoor Dining',
        description: isCozy
          ? 'Fresh air dining with an al fresco atmosphere'
          : 'Outdoor seating for a refreshing dining experience'
      },
      'bar': {
        title: 'Bar Counter',
        description: 'Casual bar-style seating with a lively atmosphere'
      },
      'private': {
        title: isGroup ? 'Private Dining Room' : 'Exclusive Seating',
        description: isGroup
          ? 'Dedicated private space perfect for group celebrations'
          : 'Exclusive and quiet seating away from the main dining area'
      },
      'standard': {
        title: 'Classic Dining',
        description: isCozy
          ? 'Traditional table setting in the heart of the restaurant'
          : 'Prime dining room seating with full restaurant atmosphere'
      }
    };

    return experiences[tableType] || {
      title: 'Restaurant Seating',
      description: 'Quality dining table in a welcoming atmosphere'
    };
  }

  /**
   * Check if a table type offers a unique experience compared to existing options
   */
  private isUniqueExperience(tableType: string, existingTypes: string[]): boolean {
    // Group similar experiences to avoid redundancy
    const experienceGroups: Record<string, string[]> = {
      'intimate': ['booth', 'window'],
      'casual': ['standard', 'bar'],
      'outdoor': ['patio'],
      'private': ['private']
    };

    const newExperienceGroup = Object.entries(experienceGroups)
      .find(([_, types]) => types.includes(tableType))?.[0] || 'other';

    const existingExperienceGroups = existingTypes.map(type => 
      Object.entries(experienceGroups)
        .find(([_, types]) => types.includes(type))?.[0] || 'other'
    );

    return !existingExperienceGroups.includes(newExperienceGroup);
  }

  /**
   * Get experience score for prioritization
   */
  private getExperienceScore(tableType: string, partySize: number): number {
    const baseScores: Record<string, number> = {
      'booth': 20,
      'window': 18,
      'patio': 16,
      'private': 15,
      'standard': 12,
      'bar': 10,
    };

    let score = baseScores[tableType] || 8;

    // Boost score based on party size appropriateness
    const sizePreferences: Record<string, Record<number, number>> = {
      'booth': { 1: 5, 2: 15, 3: 8, 4: 12, 5: 3, 6: 0, 7: 0, 8: 0 },
      'window': { 1: 8, 2: 12, 3: 10, 4: 8, 5: 5, 6: 3, 7: 0, 8: 0 },
      'private': { 1: 0, 2: 3, 3: 5, 4: 8, 5: 12, 6: 15, 7: 18, 8: 20 },
      'bar': { 1: 10, 2: 8, 3: 3, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
      'patio': { 1: 5, 2: 12, 3: 8, 4: 10, 5: 6, 6: 4, 7: 2, 8: 0 },
      'standard': { 1: 6, 2: 8, 3: 10, 4: 10, 5: 8, 6: 6, 7: 4, 8: 2 },
    };

    const sizeBonus = sizePreferences[tableType]?.[Math.min(partySize, 8)] || 0;
    return score + sizeBonus;
  }

  /**
   * Select the primary (recommended) option
   */
  private selectPrimaryOption(options: TableOption[], partySize: number): TableOption {
    // Prioritize perfect fits, then by experience score
    const perfectFits = options.filter(opt => opt.isPerfectFit);
    if (perfectFits.length > 0) {
      return perfectFits[0]; // Already sorted by preference
    }
    
    return options[0]; // Fallback to first option
  }

  /**
   * Quick availability check without table details (faster)
   */
  private async quickAvailabilityCheck(
    restaurantId: string,
    startTime: Date,
    endTime: Date,
    partySize: number
  ): Promise<boolean> {
    try {
      // Check if ANY single table can handle the party size
      const { data: singleTable } = await supabase.rpc("get_available_tables", {
        p_restaurant_id: restaurantId,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_party_size: partySize,
      });

      if (singleTable && singleTable.length > 0) {
        return true;
      }

      // For larger parties, do a quick combination check
      if (partySize > 4) {
        const { data: combinableTables } = await supabase
          .from("restaurant_tables")
          .select("id, capacity")
          .eq("restaurant_id", restaurantId)
          .eq("is_active", true)
          .eq("is_combinable", true)
          .gte("capacity", Math.floor(partySize / 2))
          .limit(4);

        if (combinableTables && combinableTables.length >= 2) {
          // Quick check if any combination could work
          for (let i = 0; i < combinableTables.length - 1; i++) {
            for (let j = i + 1; j < combinableTables.length; j++) {
              const combinedCapacity = combinableTables[i].capacity + combinableTables[j].capacity;
              if (combinedCapacity >= partySize) {
                // Quick overlap check
                const { data: conflict } = await supabase.rpc("check_booking_overlap", {
                  p_table_ids: [combinableTables[i].id, combinableTables[j].id],
                  p_start_time: startTime.toISOString(),
                  p_end_time: endTime.toISOString(),
                });
                
                if (!conflict) {
                  return true;
                }
              }
            }
          }
        }
      }

      return false;
    } catch (error) {
      console.error("Error in quick availability check:", error);
      return false;
    }
  }

  /**
   * EXISTING: Full slot availability check with table details (backward compatibility)
   */
  async getAvailableSlots(
    restaurantId: string,
    date: Date,
    partySize: number,
    userId?: string
  ): Promise<TimeSlot[]> {
    try {
      const timeSlots = await this.getAvailableTimeSlots(restaurantId, date, partySize, userId);
      const fullSlots: TimeSlot[] = [];

      for (const timeSlot of timeSlots) {
        const tableOptions = await this.getTableOptionsForSlot(
          restaurantId,
          date,
          timeSlot.time,
          partySize
        );

        if (tableOptions) {
          fullSlots.push({
            time: timeSlot.time,
            available: true,
            tables: tableOptions.primaryOption.tables,
            requiresCombination: tableOptions.primaryOption.requiresCombination,
            totalCapacity: tableOptions.primaryOption.totalCapacity,
          });
        }
      }

      return fullSlots;
    } catch (error) {
      console.error("Error getting available slots:", error);
      return [];
    }
  }

  /**
   * Check if a specific time slot is available with full table details
   */
  private async checkSlotAvailability(
    restaurantId: string,
    startTime: Date,
    endTime: Date,
    partySize: number
  ): Promise<SlotAvailability> {
    // 1. Try to find available single tables
    const { data: availableTables, error } = await supabase.rpc(
      "get_available_tables",
      {
        p_restaurant_id: restaurantId,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_party_size: partySize,
      }
    );

    if (error) {
      console.error("Error checking availability:", error);
      return { isAvailable: false };
    }

    // If we found single tables that fit, select the best option with variety consideration
    if (availableTables && availableTables.length > 0) {
      // Sort tables to prioritize variety and optimal fit
      const sortedTables = [...availableTables].sort((a, b) => {
        // 1. Prioritize tables that fit the party size better (closer capacity)
        const aDiff = a.capacity - partySize;
        const bDiff = b.capacity - partySize;
        
        // Prefer tables that are close to party size but not too big
        if (aDiff >= 0 && bDiff >= 0) {
          return aDiff - bDiff; // Smaller difference is better
        }
        if (aDiff >= 0) return -1; // a fits, b doesn't
        if (bDiff >= 0) return 1;  // b fits, a doesn't
        
        // 2. If both are too small, prefer larger
        return b.capacity - a.capacity;
      });

      // Get the best table, but also consider table type variety
      const bestTable = this.selectBestTableWithVariety(sortedTables, partySize);
      
      return {
        isAvailable: true,
        tables: [bestTable],
        requiresCombination: false,
        totalCapacity: bestTable.capacity,
      };
    }

    // 2. If no single table, try combinations for larger parties
    if (partySize > 4) {
      const combination = await this.findTableCombination(
        restaurantId,
        startTime,
        endTime,
        partySize
      );

      if (combination) {
        return {
          isAvailable: true,
          tables: combination,
          requiresCombination: true,
          totalCapacity: combination.reduce((sum, t) => sum + t.capacity, 0),
        };
      }
    }

    return { isAvailable: false };
  }

  /**
   * Select best table considering variety and avoiding always picking the same type
   */
  private selectBestTableWithVariety(tables: Table[], partySize: number): Table {
    if (tables.length === 1) return tables[0];

    // Keep track of recently selected table types to encourage variety
    const now = Date.now();
    const recentSelections = this.getRecentTableSelections();

    // Score each table based on multiple factors
    const scoredTables = tables.map(table => {
      let score = 0;

      // 1. Capacity fit score (higher is better for optimal fit)
      const capacityDiff = table.capacity - partySize;
      if (capacityDiff >= 0 && capacityDiff <= 2) {
        score += 100 - (capacityDiff * 10); // Perfect fit gets 100, +1 capacity gets 90, etc.
      } else if (capacityDiff >= 0) {
        score += 50 - capacityDiff; // Too big but still acceptable
      }

      // 2. Table type variety bonus (encourage different types)
      const recentTypeCount = recentSelections[table.table_type] || 0;
      score += Math.max(0, 20 - (recentTypeCount * 5)); // Bonus for less recently used types

      // 3. Table priority score (from database configuration)
      score += (table.priority_score || 0);

      // 4. Table type preference based on party size
      score += this.getTableTypePreferenceScore(table.table_type, partySize);

      return { table, score };
    });

    // Sort by score and pick the best
    scoredTables.sort((a, b) => b.score - a.score);
    const selectedTable = scoredTables[0].table;

    // Update recent selections tracking
    this.updateRecentTableSelection(selectedTable.table_type);

    return selectedTable;
  }

  // Track recent table selections to encourage variety
  private recentTableSelections = new Map<string, { count: number; timestamp: number }>();
  private SELECTION_MEMORY_DURATION = 10 * 60 * 1000; // 10 minutes

  private getRecentTableSelections(): Record<string, number> {
    const now = Date.now();
    const recent: Record<string, number> = {};

    this.recentTableSelections.forEach((data, tableType) => {
      if (now - data.timestamp < this.SELECTION_MEMORY_DURATION) {
        recent[tableType] = data.count;
      } else {
        this.recentTableSelections.delete(tableType); // Cleanup old entries
      }
    });

    return recent;
  }

  private updateRecentTableSelection(tableType: string): void {
    const now = Date.now();
    const existing = this.recentTableSelections.get(tableType);
    
    this.recentTableSelections.set(tableType, {
      count: (existing?.count || 0) + 1,
      timestamp: now
    });
  }

  /**
   * Get preference score for table type based on party size
   */
  private getTableTypePreferenceScore(tableType: string, partySize: number): number {
    const preferences: Record<string, Record<number, number>> = {
      'booth': {
        1: 5, 2: 15, 3: 10, 4: 20, 5: 5, 6: 0, 7: 0, 8: 0
      },
      'window': {
        1: 10, 2: 20, 3: 15, 4: 10, 5: 5, 6: 5, 7: 0, 8: 0
      },
      'standard': {
        1: 8, 2: 12, 3: 15, 4: 15, 5: 10, 6: 8, 7: 5, 8: 0
      },
      'patio': {
        1: 8, 2: 18, 3: 12, 4: 15, 5: 8, 6: 5, 7: 0, 8: 0
      },
      'bar': {
        1: 15, 2: 10, 3: 5, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0
      },
      'private': {
        1: 0, 2: 5, 3: 8, 4: 12, 5: 15, 6: 20, 7: 25, 8: 30
      }
    };

    return preferences[tableType]?.[Math.min(partySize, 8)] || 0;
  }

  // Table combination logic with caching
  private combinationCache = new Map<string, { tables: Table[], timestamp: number }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  private async findTableCombination(
    restaurantId: string,
    startTime: Date,
    endTime: Date,
    partySize: number
  ): Promise<Table[] | null> {
    const cacheKey = `${restaurantId}:${partySize}`;
    const now = Date.now();
  
    // Check cache first
    const cached = this.combinationCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      // Verify the cached combination is still available
      const tableIds = cached.tables.map(t => t.id);
      const { data: conflict } = await supabase.rpc("check_booking_overlap", {
        p_table_ids: tableIds,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
      });
  
      if (!conflict) {
        return cached.tables;
      }
    }
  
    // Get all tables that are combinable
    const { data: tables } = await supabase
      .from("restaurant_tables")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .eq("is_combinable", true)
      .order("priority_score", { ascending: true })
      .order("capacity", { ascending: false });
  
    if (!tables || tables.length < 2) return null;
  
    // Check pre-configured combinations first
    const { data: combinations } = await supabase
      .from("table_combinations")
      .select(`
        *,
        primary_table:primary_table_id(*),
        secondary_table:secondary_table_id(*)
      `)
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .gte("combined_capacity", partySize)
      .lte("combined_capacity", partySize + 2) // Don't over-allocate
      .order("combined_capacity", { ascending: true });
  
    // Check each pre-configured combination
    for (const combo of combinations || []) {
      const tableIds = [combo.primary_table_id, combo.secondary_table_id];
      
      const { data: conflict } = await supabase.rpc("check_booking_overlap", {
        p_table_ids: tableIds,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
      });
  
      if (!conflict) {
        const result = [combo.primary_table, combo.secondary_table];
        // Cache the successful combination
        this.combinationCache.set(cacheKey, { tables: result, timestamp: now });
        return result;
      }
    }
  
    // Try dynamic combinations (improved algorithm)
    // First, try to find the most efficient combination
    const sortedTables = [...tables].sort((a, b) => {
      // Prioritize by how close the capacity is to party size
      const aDiff = Math.abs(a.capacity - partySize);
      const bDiff = Math.abs(b.capacity - partySize);
      return aDiff - bDiff;
    });
  
    for (let i = 0; i < sortedTables.length - 1; i++) {
      for (let j = i + 1; j < sortedTables.length; j++) {
        const table1 = sortedTables[i];
        const table2 = sortedTables[j];
        const combinedCapacity = table1.capacity + table2.capacity;
  
        // Check if combination is efficient (not too much overcapacity)
        if (combinedCapacity >= partySize && combinedCapacity <= partySize + 2) {
          const tableIds = [table1.id, table2.id];
          
          const { data: conflict } = await supabase.rpc("check_booking_overlap", {
            p_table_ids: tableIds,
            p_start_time: startTime.toISOString(),
            p_end_time: endTime.toISOString(),
          });
  
          if (!conflict) {
            const result = [table1, table2];
            // Cache the successful combination
            this.combinationCache.set(cacheKey, { tables: result, timestamp: now });
            return result;
          }
        }
      }
    }
  
    // Try three-table combinations for very large parties
    if (partySize > 8 && tables.length >= 3) {
      for (let i = 0; i < tables.length - 2; i++) {
        for (let j = i + 1; j < tables.length - 1; j++) {
          for (let k = j + 1; k < tables.length; k++) {
            const table1 = tables[i];
            const table2 = tables[j];
            const table3 = tables[k];
            const combinedCapacity = table1.capacity + table2.capacity + table3.capacity;
  
            if (combinedCapacity >= partySize && combinedCapacity <= partySize + 4) {
              const tableIds = [table1.id, table2.id, table3.id];
              
              const { data: conflict } = await supabase.rpc("check_booking_overlap", {
                p_table_ids: tableIds,
                p_start_time: startTime.toISOString(),
                p_end_time: endTime.toISOString(),
              });
  
              if (!conflict) {
                return [table1, table2, table3];
              }
            }
          }
        }
      }
    }
  
    return null;
  }

  clearCombinationCache(restaurantId?: string) {
    if (restaurantId) {
      // Clear only for specific restaurant
      const keysToDelete: string[] = [];
      this.combinationCache.forEach((_, key) => {
        if (key.startsWith(restaurantId + ':')) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.combinationCache.delete(key));
    } else {
      // Clear entire cache
      this.combinationCache.clear();
    }
  }

  /**
   * Get VIP benefits for a user at a restaurant
   */
  private async getVIPBenefits(
    restaurantId: string,
    userId: string
  ): Promise<VIPBenefits | null> {
    const { data } = await supabase
      .from("restaurant_vip_users")
      .select("extended_booking_days, priority_booking")
      .eq("restaurant_id", restaurantId)
      .eq("user_id", userId)
      .gte("valid_until", new Date().toISOString())
      .single();

    return data;
  }

  /**
   * Generate 15-minute interval slots
   */
  private async generate15MinuteSlots(
    openTime: string,
    closeTime: string,
    restaurantId: string
  ): Promise<{ time: string }[]> {
    const slots: { time: string }[] = [];
    const [openHour, openMin] = openTime.split(":").map(Number);
    const [closeHour, closeMin] = closeTime.split(":").map(Number);
  
    let currentHour = openHour;
    let currentMin = openMin;
  
    // Align to 15-minute intervals
    currentMin = Math.ceil(currentMin / 15) * 15;
    if (currentMin === 60) {
      currentMin = 0;
      currentHour++;
    }
  
    const closeTimeInMinutes = closeHour * 60 + closeMin;
    
    // Get dynamic buffer time based on restaurant's max turn time
    const maxTurnTime = await this.getMaxTurnTime(restaurantId);
  
    // Stop at a time that allows for the maximum turn time
    while (currentHour * 60 + currentMin <= closeTimeInMinutes - maxTurnTime) {
      slots.push({
        time: `${currentHour.toString().padStart(2, "0")}:${currentMin
          .toString()
          .padStart(2, "0")}`,
      });
  
      currentMin += 15;
      if (currentMin >= 60) {
        currentMin = 0;
        currentHour++;
      }
    }
  
    return slots;
  }

  /**
   * Get default turn time based on party size
   */
  private getDefaultTurnTime(partySize: number): number {
    if (partySize <= 2) return 90;
    if (partySize <= 4) return 120;
    if (partySize <= 6) return 150;
    return 180;
  }

  /**
   * Check if tables are available (direct check)
   */
  async areTablesAvailable(
    tableIds: string[],
    startTime: Date,
    endTime: Date
  ): Promise<boolean> {
    const { data: conflict } = await supabase.rpc("check_booking_overlap", {
      p_table_ids: tableIds,
      p_start_time: startTime.toISOString(),
      p_end_time: endTime.toISOString(),
    });

    return !conflict;
  }
}