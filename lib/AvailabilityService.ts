// lib/availability/AvailabilityService.ts
import { supabase } from "@/config/supabase";

export interface TimeSlot {
  time: string;
  available: boolean;
  tables?: Table[];
  requiresCombination?: boolean;
  totalCapacity?: number;
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

export interface Restaurant {
  id: string;
  opening_time: string;
  closing_time: string;
  booking_window_days?: number;
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
   * Get available time slots for a restaurant
   */
  async getAvailableSlots(
    restaurantId: string,
    date: Date,
    partySize: number,
    userId?: string
  ): Promise<TimeSlot[]> {
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

      // 3. Generate 15-minute intervals
      const baseSlots = await  this.generate15MinuteSlots(
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

      // 5. Check availability for each slot
      const availableSlots: TimeSlot[] = [];
      const dateStr = date.toISOString().split("T")[0];

      for (const slot of baseSlots) {
        const startTime = new Date(`${dateStr}T${slot.time}:00`);
        const endTime = new Date(startTime.getTime() + turnTime * 60000);

        // Skip slots that are in the past
        if (startTime < new Date()) {
          continue;
        }

        const availability = await this.checkSlotAvailability(
          restaurantId,
          startTime,
          endTime,
          partySize
        );

        if (availability.isAvailable) {
          availableSlots.push({
            time: slot.time,
            available: true,
            tables: availability.tables,
            requiresCombination: availability.requiresCombination,
            totalCapacity: availability.totalCapacity,
          });
        }
      }

      return availableSlots;
    } catch (error) {
      console.error("Error getting available slots:", error);
      return [];
    }
  }

  /**
   * Check if a specific time slot is available
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

    // If we found a single table that fits
    if (availableTables && availableTables.length > 0) {
      return {
        isAvailable: true,
        tables: [availableTables[0]],
        requiresCombination: false,
        totalCapacity: availableTables[0].capacity,
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