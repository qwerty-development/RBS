// lib/availability/AvailabilityService.ts (Optimized)
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

// Enhanced cache with LRU and batching
class EnhancedCache<T> {
  private cache = new Map<
    string,
    { data: T; timestamp: number; hits: number }
  >();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 100, ttl: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): T | null {
    const now = Date.now();
    const entry = this.cache.get(key);

    if (!entry || now - entry.timestamp > this.ttl) {
      if (entry) this.cache.delete(key);
      return null;
    }

    entry.hits++;
    entry.timestamp = now; // Update access time
    return entry.data;
  }

  set(key: string, data: T): void {
    const now = Date.now();

    // Cleanup if at max capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLeastUsed();
    }

    this.cache.set(key, { data, timestamp: now, hits: 1 });
  }

  private evictLeastUsed(): void {
    let leastUsedKey = "";
    let leastHits = Infinity;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (
        entry.hits < leastHits ||
        (entry.hits === leastHits && entry.timestamp < oldestTime)
      ) {
        leastUsedKey = key;
        leastHits = entry.hits;
        oldestTime = entry.timestamp;
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
    }
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  prefetch(keys: string[], fetchFn: (key: string) => Promise<T>): void {
    // Background prefetch without blocking
    setTimeout(async () => {
      const promises = keys
        .filter((key) => !this.get(key))
        .slice(0, 5) // Limit concurrent prefetch
        .map(async (key) => {
          try {
            const data = await fetchFn(key);
            this.set(key, data);
          } catch (error) {
            console.warn(`Prefetch failed for key: ${key}`, error);
          }
        });

      await Promise.allSettled(promises);
    }, 100);
  }
}

export class AvailabilityService {
  private static instance: AvailabilityService;

  // Enhanced caching system
  private timeSlotsCache = new EnhancedCache<TimeSlotBasic[]>(
    50,
    3 * 60 * 1000,
  ); // 3 min TTL
  private tableOptionsCache = new EnhancedCache<SlotTableOptions>(
    100,
    2 * 60 * 1000,
  ); // 2 min TTL
  private restaurantConfigCache = new EnhancedCache<any>(20, 10 * 60 * 1000); // 10 min TTL
  private quickAvailabilityCache = new EnhancedCache<boolean>(
    200,
    1 * 60 * 1000,
  ); // 1 min TTL

  // Batch processing
  private batchedQueries = new Map<string, Promise<any>>();
  private batchTimeout: NodeJS.Timeout | null = null;

  static getInstance() {
    if (!this.instance) {
      this.instance = new AvailabilityService();
    }
    return this.instance;
  }

  private async getMaxTurnTime(restaurantId: string): Promise<number> {
    const cacheKey = `turn-time:${restaurantId}`;
    let cached = this.restaurantConfigCache.get(cacheKey);

    if (cached) return cached;

    try {
      const { data, error } = await supabase.rpc("get_max_turn_time", {
        p_restaurant_id: restaurantId,
      });

      const turnTime = error || !data ? 240 : data;
      this.restaurantConfigCache.set(cacheKey, turnTime);
      return turnTime;
    } catch (error) {
      console.error("Error getting max turn time:", error);
      return 240;
    }
  }

  /**
   * OPTIMIZED: Get available time slots with enhanced caching and pre-loading
   */
  async getAvailableTimeSlots(
    restaurantId: string,
    date: Date,
    partySize: number,
    userId?: string,
    preloadNextDay: boolean = true,
  ): Promise<TimeSlotBasic[]> {
    const dateStr = date.toISOString().split("T")[0];
    const cacheKey = `time-slots:${restaurantId}:${dateStr}:${partySize}:${userId || "guest"}`;

    // Check cache first
    let cached = this.timeSlotsCache.get(cacheKey);
    if (cached) {
      // Trigger background prefetch for next day
      if (preloadNextDay) {
        this.prefetchNextDay(restaurantId, date, partySize, userId);
      }
      return cached;
    }

    try {
      // Batch restaurant config requests
      const [restaurant, vipBenefits] = await Promise.all([
        this.getRestaurantConfig(restaurantId),
        userId
          ? this.getVIPBenefits(restaurantId, userId)
          : Promise.resolve(null),
      ]);

      if (!restaurant) return [];

      // Check booking window
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const bookingDate = new Date(date);
      bookingDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor(
        (bookingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      let maxBookingDays = restaurant.booking_window_days || 30;
      if (vipBenefits?.extended_booking_days) {
        maxBookingDays = vipBenefits.extended_booking_days;
      }

      if (daysDiff > maxBookingDays) {
        this.timeSlotsCache.set(cacheKey, []);
        return [];
      }

      // Generate base slots and get turn time in parallel
      const [baseSlots, turnTime] = await Promise.all([
        this.generate15MinuteSlots(
          restaurant.opening_time,
          restaurant.closing_time,
          restaurantId,
        ),
        this.getTurnTimeForParty(restaurantId, partySize, date),
      ]);

      // Batch availability checks
      const availableSlots = await this.batchQuickAvailabilityChecks(
        restaurantId,
        date,
        baseSlots,
        turnTime,
        partySize,
      );

      // Cache result
      this.timeSlotsCache.set(cacheKey, availableSlots);

      // Trigger background prefetch
      if (preloadNextDay) {
        this.prefetchNextDay(restaurantId, date, partySize, userId);
      }

      return availableSlots;
    } catch (error) {
      console.error("Error getting available time slots:", error);
      return [];
    }
  }

  /**
   * OPTIMIZED: Get table options with smart caching and parallel processing
   */
  async getTableOptionsForSlot(
    restaurantId: string,
    date: Date,
    time: string,
    partySize: number,
  ): Promise<SlotTableOptions | null> {
    const dateStr = date.toISOString().split("T")[0];
    const cacheKey = `table-options:${restaurantId}:${dateStr}:${time}:${partySize}`;

    // Check cache first
    let cached = this.tableOptionsCache.get(cacheKey);
    if (cached) return cached;

    try {
      const startTime = new Date(`${dateStr}T${time}:00`);

      // Get turn time from cache if possible
      const turnTime = await this.getTurnTimeForParty(
        restaurantId,
        partySize,
        date,
      );
      const endTime = new Date(startTime.getTime() + turnTime * 60000);

      // Execute query directly without batching to avoid promise type issues
      const { data: availableTables, error } = await supabase.rpc(
        "get_available_tables",
        {
          p_restaurant_id: restaurantId,
          p_start_time: startTime.toISOString(),
          p_end_time: endTime.toISOString(),
          p_party_size: partySize,
        },
      );

      if (error) {
        console.error("Error checking availability:", error);
        return null;
      }

      return this.processTableOptions(
        time,
        availableTables,
        restaurantId,
        startTime,
        endTime,
        partySize,
        cacheKey,
      );
    } catch (error) {
      console.error("Error getting table options for slot:", error);
      return null;
    }
  }

  /**
   * Process table options with enhanced logic
   */
  private async processTableOptions(
    time: string,
    availableTables: any[],
    restaurantId: string,
    startTime: Date,
    endTime: Date,
    partySize: number,
    cacheKey: string,
  ): Promise<SlotTableOptions | null> {
    if (!availableTables || availableTables.length === 0) {
      // Try table combinations for larger parties
      if (partySize > 4) {
        const combination = await this.findTableCombination(
          restaurantId,
          startTime,
          endTime,
          partySize,
        );

        if (combination) {
          const combinationOption: TableOption = {
            tables: combination,
            requiresCombination: true,
            totalCapacity: combination.reduce((sum, t) => sum + t.capacity, 0),
            tableTypes: [...new Set(combination.map((t) => t.table_type))],
            experienceTitle: "Private Group Arrangement",
            experienceDescription:
              "Multiple tables specially arranged together for your group dining experience",
            isPerfectFit: false,
            combinationInfo: {
              primaryTable: combination[0],
              secondaryTable: combination[1],
              reason: `Specially arranged for ${partySize} guests`,
            },
          };

          const result = {
            time,
            options: [combinationOption],
            primaryOption: combinationOption,
          };

          this.tableOptionsCache.set(cacheKey, result);
          return result;
        }
      }
      return null;
    }

    // Create optimized table options
    const tableOptions = this.createOptimizedTableOptions(
      availableTables,
      partySize,
    );

    if (tableOptions.length === 0) {
      return null;
    }

    const primaryOption = this.selectPrimaryOption(tableOptions, partySize);
    const result = {
      time,
      options: tableOptions,
      primaryOption,
    };

    // Cache the result
    this.tableOptionsCache.set(cacheKey, result);
    return result;
  }

  /**
   * OPTIMIZED: Batch quick availability checks to reduce database round trips
   */
  private async batchQuickAvailabilityChecks(
    restaurantId: string,
    date: Date,
    baseSlots: { time: string }[],
    turnTime: number,
    partySize: number,
  ): Promise<TimeSlotBasic[]> {
    const dateStr = date.toISOString().split("T")[0];
    const now = new Date();
    const availableSlots: TimeSlotBasic[] = [];

    // Process slots in batches of 10 to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < baseSlots.length; i += batchSize) {
      const batch = baseSlots.slice(i, i + batchSize);
      const batchPromises = batch.map(async (slot) => {
        const startTime = new Date(`${dateStr}T${slot.time}:00`);

        // Skip slots that are in the past
        if (startTime < now) return null;

        const cacheKey = `quick-check:${restaurantId}:${startTime.toISOString()}:${partySize}`;
        let hasAvailability = this.quickAvailabilityCache.get(cacheKey);

        if (hasAvailability === null) {
          const endTime = new Date(startTime.getTime() + turnTime * 60000);
          hasAvailability = await this.quickAvailabilityCheck(
            restaurantId,
            startTime,
            endTime,
            partySize,
          );
          this.quickAvailabilityCache.set(cacheKey, hasAvailability);
        }

        return hasAvailability ? { time: slot.time, available: true } : null;
      });

      const batchResults = await Promise.all(batchPromises);
      availableSlots.push(
        ...(batchResults.filter(
          (result) => result !== null,
        ) as TimeSlotBasic[]),
      );
    }

    return availableSlots;
  }

  /**
   * OPTIMIZED: Get restaurant config with caching
   */
  private async getRestaurantConfig(restaurantId: string): Promise<any> {
    const cacheKey = `restaurant:${restaurantId}`;
    let cached = this.restaurantConfigCache.get(cacheKey);

    if (cached) return cached;

    const { data: restaurant, error } = await supabase
      .from("restaurants")
      .select("opening_time, closing_time, booking_window_days")
      .eq("id", restaurantId)
      .single();

    if (!error && restaurant) {
      this.restaurantConfigCache.set(cacheKey, restaurant);
    }

    return error ? null : restaurant;
  }

  /**
   * OPTIMIZED: Get turn time with caching
   */
  private async getTurnTimeForParty(
    restaurantId: string,
    partySize: number,
    date: Date,
  ): Promise<number> {
    const cacheKey = `turn-time-party:${restaurantId}:${partySize}`;
    let cached = this.restaurantConfigCache.get(cacheKey);

    if (cached) return cached;

    const { data: turnTimeData } = await supabase.rpc("get_turn_time", {
      p_restaurant_id: restaurantId,
      p_party_size: partySize,
      p_booking_time: date.toISOString(),
    });

    const turnTime = turnTimeData || this.getDefaultTurnTime(partySize);
    this.restaurantConfigCache.set(cacheKey, turnTime);

    return turnTime;
  }

  /**
   * OPTIMIZED: Prefetch next day data in background
   */
  private prefetchNextDay(
    restaurantId: string,
    currentDate: Date,
    partySize: number,
    userId?: string,
  ): void {
    const nextDay = new Date(currentDate);
    nextDay.setDate(currentDate.getDate() + 1);

    // Don't await this - let it run in background
    setTimeout(() => {
      this.getAvailableTimeSlots(
        restaurantId,
        nextDay,
        partySize,
        userId,
        false,
      ).catch((error) => console.warn("Background prefetch failed:", error));
    }, 500);
  }

  /**
   * Enhanced quick availability check with better query optimization
   */
  private async quickAvailabilityCheck(
    restaurantId: string,
    startTime: Date,
    endTime: Date,
    partySize: number,
  ): Promise<boolean> {
    try {
      // First, try a single optimized query for available tables
      const { data: availabilityCheck, error } = await supabase.rpc(
        "quick_availability_check",
        {
          p_restaurant_id: restaurantId,
          p_start_time: startTime.toISOString(),
          p_end_time: endTime.toISOString(),
          p_party_size: partySize,
        },
      );

      // If we have a custom function, use it
      if (!error && availabilityCheck !== undefined) {
        return availabilityCheck;
      }

      // Fallback to original logic
      const { data: singleTable } = await supabase.rpc("get_available_tables", {
        p_restaurant_id: restaurantId,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_party_size: partySize,
      });

      if (singleTable && singleTable.length > 0) {
        return true;
      }

      // For larger parties, quick combination check
      if (partySize > 4) {
        // Use a more efficient combination check
        return await this.quickCombinationCheck(
          restaurantId,
          startTime,
          endTime,
          partySize,
        );
      }

      return false;
    } catch (error) {
      console.error("Error in quick availability check:", error);
      return false;
    }
  }

  /**
   * OPTIMIZED: Quick combination check without full table details
   */
  private async quickCombinationCheck(
    restaurantId: string,
    startTime: Date,
    endTime: Date,
    partySize: number,
  ): Promise<boolean> {
    // Get minimal table info for combination check
    const { data: combinableTables } = await supabase
      .from("restaurant_tables")
      .select("id, capacity")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .eq("is_combinable", true)
      .gte("capacity", Math.max(2, Math.floor(partySize / 3))) // More efficient filter
      .order("capacity", { ascending: false })
      .limit(6); // Limit to reduce processing

    if (!combinableTables || combinableTables.length < 2) return false;

    // Check only the most promising combinations
    for (let i = 0; i < Math.min(combinableTables.length - 1, 3); i++) {
      for (let j = i + 1; j < Math.min(combinableTables.length, 4); j++) {
        const combinedCapacity =
          combinableTables[i].capacity + combinableTables[j].capacity;

        if (
          combinedCapacity >= partySize &&
          combinedCapacity <= partySize + 3
        ) {
          // Quick overlap check
          const { data: conflict } = await supabase.rpc(
            "check_booking_overlap",
            {
              p_table_ids: [combinableTables[i].id, combinableTables[j].id],
              p_start_time: startTime.toISOString(),
              p_end_time: endTime.toISOString(),
            },
          );

          if (!conflict) return true;
        }
      }
    }

    return false;
  }

  // ... [Rest of the existing methods remain the same - createOptimizedTableOptions, selectPrimaryOption, etc.]

  /**
   * OPTIMIZED: Create smart table options that prioritize perfect fits and experiences
   */
  private createOptimizedTableOptions(
    availableTables: Table[],
    partySize: number,
  ): TableOption[] {
    // 1. Find exact capacity matches first.
    const exactCapacityTables = availableTables.filter(
      (table) => table.capacity === partySize,
    );

    if (exactCapacityTables.length > 0) {
      // If we have exact matches, create options for all of them.
      const exactFitOptions = exactCapacityTables.map((table) => {
        const experience = this.getTableExperience(table, partySize);
        return {
          tables: [table],
          requiresCombination: false,
          totalCapacity: table.capacity,
          tableTypes: [table.table_type],
          experienceTitle: experience.title,
          experienceDescription: experience.description,
          isPerfectFit: true, // It's an exact fit.
        };
      });
      // Sort them by experience score
      return exactFitOptions.sort((a, b) => {
        const scoreA = this.getExperienceScore(a.tableTypes[0], partySize);
        const scoreB = this.getExperienceScore(b.tableTypes[0], partySize);
        return scoreB - scoreA;
      });
    }

    // 2. If no exact matches, fall back to finding the next best oversized tables.
    const tablesByType = availableTables.reduce(
      (groups, table) => {
        const type = table.table_type;
        if (!groups[type]) groups[type] = [];
        groups[type].push(table);
        return groups;
      },
      {} as Record<string, Table[]>,
    );

    const additionalOptions = this.createAdditionalOptions(
      tablesByType,
      partySize,
      [], // No existing types to exclude
    );

    // Sort by preference: perfect fits first, then by capacity, then by score
    return additionalOptions.sort((a, b) => {
      if (a.isPerfectFit && !b.isPerfectFit) return -1;
      if (!a.isPerfectFit && b.isPerfectFit) return 1;

      const aCapacityDiff = a.totalCapacity - partySize;
      const bCapacityDiff = b.totalCapacity - partySize;
      if (aCapacityDiff !== bCapacityDiff) {
        return aCapacityDiff - bCapacityDiff;
      }

      const scoreA = this.getExperienceScore(a.tableTypes[0], partySize);
      const scoreB = this.getExperienceScore(b.tableTypes[0], partySize);
      return scoreB - scoreA;
    });
  }

  /**
   * Create options for tables that fit perfectly (capacity = party size or party size + 1)
   */
  private createPerfectFitOptions(
    tablesByType: Record<string, Table[]>,
    partySize: number,
  ): TableOption[] {
    const perfectOptions: TableOption[] = [];

    Object.entries(tablesByType).forEach(([tableType, tables]) => {
      // Find perfect fit tables (exact match or +1)
      const perfectFitTables = tables.filter(
        (table) =>
          table.capacity >= partySize && table.capacity <= partySize + 1,
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
    existingTypes: string[],
  ): TableOption[] {
    const additionalOptions: TableOption[] = [];

    Object.entries(tablesByType).forEach(([tableType, tables]) => {
      // Skip if we already have this table type
      if (existingTypes.includes(tableType)) return;

      // Only consider tables that aren't massively oversized (max +3 capacity)
      const reasonableTables = tables.filter(
        (table) =>
          table.capacity >= partySize && table.capacity <= partySize + 3,
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
  private getTableExperience(
    table: Table,
    partySize: number,
  ): { title: string; description: string } {
    const tableType = table.table_type;
    const isCozy = partySize <= 2;
    const isGroup = partySize >= 6;

    const experiences: Record<string, { title: string; description: string }> =
      {
        booth: {
          title: isCozy ? "Intimate Booth" : "Cozy Booth Seating",
          description: isCozy
            ? "Private and romantic booth perfect for intimate dining"
            : "Comfortable booth seating with privacy and warmth",
        },
        window: {
          title: "Window View",
          description: isCozy
            ? "Scenic window seating with natural light and views"
            : "Bright window table with lovely views while you dine",
        },
        patio: {
          title: "Outdoor Dining",
          description: isCozy
            ? "Fresh air dining with an al fresco atmosphere"
            : "Outdoor seating for a refreshing dining experience",
        },
        bar: {
          title: "Bar Counter",
          description: "Casual bar-style seating with a lively atmosphere",
        },
        private: {
          title: isGroup ? "Private Dining Room" : "Exclusive Seating",
          description: isGroup
            ? "Dedicated private space perfect for group celebrations"
            : "Exclusive and quiet seating away from the main dining area",
        },
        standard: {
          title: "Classic Dining",
          description: isCozy
            ? "Traditional table setting in the heart of the restaurant"
            : "Prime dining room seating with full restaurant atmosphere",
        },
      };

    return (
      experiences[tableType] || {
        title: "Restaurant Seating",
        description: "Quality dining table in a welcoming atmosphere",
      }
    );
  }

  /**
   * Check if a table type offers a unique experience compared to existing options
   */
  private isUniqueExperience(
    tableType: string,
    existingTypes: string[],
  ): boolean {
    // Group similar experiences to avoid redundancy
    const experienceGroups: Record<string, string[]> = {
      intimate: ["booth", "window"],
      casual: ["standard", "bar"],
      outdoor: ["patio"],
      private: ["private"],
    };

    const newExperienceGroup =
      Object.entries(experienceGroups).find(([_, types]) =>
        types.includes(tableType),
      )?.[0] || "other";

    const existingExperienceGroups = existingTypes.map(
      (type) =>
        Object.entries(experienceGroups).find(([_, types]) =>
          types.includes(type),
        )?.[0] || "other",
    );

    return !existingExperienceGroups.includes(newExperienceGroup);
  }

  /**
   * Get experience score for prioritization
   */
  private getExperienceScore(tableType: string, partySize: number): number {
    const baseScores: Record<string, number> = {
      booth: 20,
      window: 18,
      patio: 16,
      private: 15,
      standard: 12,
      bar: 10,
    };

    let score = baseScores[tableType] || 8;

    // Boost score based on party size appropriateness
    const sizePreferences: Record<string, Record<number, number>> = {
      booth: { 1: 5, 2: 15, 3: 8, 4: 12, 5: 3, 6: 0, 7: 0, 8: 0 },
      window: { 1: 8, 2: 12, 3: 10, 4: 8, 5: 5, 6: 3, 7: 0, 8: 0 },
      private: { 1: 0, 2: 3, 3: 5, 4: 8, 5: 12, 6: 15, 7: 18, 8: 20 },
      bar: { 1: 10, 2: 8, 3: 3, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
      patio: { 1: 5, 2: 12, 3: 8, 4: 10, 5: 6, 6: 4, 7: 2, 8: 0 },
      standard: { 1: 6, 2: 8, 3: 10, 4: 10, 5: 8, 6: 6, 7: 4, 8: 2 },
    };

    const sizeBonus = sizePreferences[tableType]?.[Math.min(partySize, 8)] || 0;
    return score + sizeBonus;
  }

  /**
   * Select the primary (recommended) option
   */
  private selectPrimaryOption(
    options: TableOption[],
    partySize: number,
  ): TableOption {
    // Prioritize perfect fits, then by experience score
    const perfectFits = options.filter((opt) => opt.isPerfectFit);
    if (perfectFits.length > 0) {
      return perfectFits[0]; // Already sorted by preference
    }

    return options[0]; // Fallback to first option
  }

  // Table combination logic with enhanced caching
  private combinationCache = new EnhancedCache<Table[]>(30, 5 * 60 * 1000);

  private async findTableCombination(
    restaurantId: string,
    startTime: Date,
    endTime: Date,
    partySize: number,
  ): Promise<Table[] | null> {
    const cacheKey = `combination:${restaurantId}:${partySize}`;

    // Check cache first
    let cached = this.combinationCache.get(cacheKey);
    if (cached) {
      // Verify the cached combination is still available
      const tableIds = cached.map((t) => t.id);
      const { data: conflict } = await supabase.rpc("check_booking_overlap", {
        p_table_ids: tableIds,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
      });

      if (!conflict) {
        return cached;
      }
    }

    // Get all tables that are combinable
    const { data: tables } = await supabase
      .from("restaurant_tables")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .eq("is_combinable", true)
      .order("capacity", { ascending: false })
      .limit(10); // Limit to improve performance

    if (!tables || tables.length < 2) return null;

    // Check pre-configured combinations first
    const combination = await this.checkPreConfiguredCombinations(
      restaurantId,
      startTime,
      endTime,
      partySize,
    );

    if (combination) {
      this.combinationCache.set(cacheKey, combination);
      return combination;
    }

    // Try dynamic combinations with limited iterations
    const dynamicCombination = await this.findDynamicCombination(
      tables,
      startTime,
      endTime,
      partySize,
    );

    if (dynamicCombination) {
      this.combinationCache.set(cacheKey, dynamicCombination);
    }

    return dynamicCombination;
  }

  private async checkPreConfiguredCombinations(
    restaurantId: string,
    startTime: Date,
    endTime: Date,
    partySize: number,
  ): Promise<Table[] | null> {
    const { data: combinations } = await supabase
      .from("table_combinations")
      .select(
        `
        *,
        primary_table:primary_table_id(*),
        secondary_table:secondary_table_id(*)
      `,
      )
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .gte("combined_capacity", partySize)
      .lte("combined_capacity", partySize + 2)
      .order("combined_capacity", { ascending: true })
      .limit(5); // Limit for performance

    for (const combo of combinations || []) {
      const tableIds = [combo.primary_table_id, combo.secondary_table_id];

      const { data: conflict } = await supabase.rpc("check_booking_overlap", {
        p_table_ids: tableIds,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
      });

      if (!conflict) {
        return [combo.primary_table, combo.secondary_table];
      }
    }

    return null;
  }

  private async findDynamicCombination(
    tables: Table[],
    startTime: Date,
    endTime: Date,
    partySize: number,
  ): Promise<Table[] | null> {
    // Sort tables for optimal combinations
    const sortedTables = [...tables].sort((a, b) => {
      const aDiff = Math.abs(a.capacity - partySize / 2);
      const bDiff = Math.abs(b.capacity - partySize / 2);
      return aDiff - bDiff;
    });

    // Limit combinations to check for performance
    const maxChecks = 20;
    let checksPerformed = 0;

    for (
      let i = 0;
      i < sortedTables.length - 1 && checksPerformed < maxChecks;
      i++
    ) {
      for (
        let j = i + 1;
        j < sortedTables.length && checksPerformed < maxChecks;
        j++
      ) {
        checksPerformed++;

        const table1 = sortedTables[i];
        const table2 = sortedTables[j];
        const combinedCapacity = table1.capacity + table2.capacity;

        if (
          combinedCapacity >= partySize &&
          combinedCapacity <= partySize + 3
        ) {
          const { data: conflict } = await supabase.rpc(
            "check_booking_overlap",
            {
              p_table_ids: [table1.id, table2.id],
              p_start_time: startTime.toISOString(),
              p_end_time: endTime.toISOString(),
            },
          );

          if (!conflict) {
            return [table1, table2];
          }
        }
      }
    }

    return null;
  }

  /**
   * Get VIP benefits for a user at a restaurant
   */
  private async getVIPBenefits(
    restaurantId: string,
    userId: string,
  ): Promise<VIPBenefits | null> {
    const cacheKey = `vip:${restaurantId}:${userId}`;
    let cached = this.restaurantConfigCache.get(cacheKey);

    if (cached) return cached;

    const { data } = await supabase
      .from("restaurant_vip_users")
      .select("extended_booking_days, priority_booking")
      .eq("restaurant_id", restaurantId)
      .eq("user_id", userId)
      .gte("valid_until", new Date().toISOString())
      .single();

    if (data) {
      this.restaurantConfigCache.set(cacheKey, data);
    }

    return data;
  }

  /**
   * Generate 15-minute interval slots
   */
  private async generate15MinuteSlots(
    openTime: string,
    closeTime: string,
    restaurantId: string,
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
   * Backward compatibility methods
   */
  async getAvailableSlots(
    restaurantId: string,
    date: Date,
    partySize: number,
    userId?: string,
  ): Promise<TimeSlot[]> {
    try {
      const timeSlots = await this.getAvailableTimeSlots(
        restaurantId,
        date,
        partySize,
        userId,
      );
      const fullSlots: TimeSlot[] = [];

      // Process in batches to avoid overwhelming the system
      const batchSize = 5;
      for (let i = 0; i < timeSlots.length; i += batchSize) {
        const batch = timeSlots.slice(i, i + batchSize);
        const batchPromises = batch.map(async (timeSlot) => {
          const tableOptions = await this.getTableOptionsForSlot(
            restaurantId,
            date,
            timeSlot.time,
            partySize,
          );

          if (tableOptions) {
            return {
              time: timeSlot.time,
              available: true,
              tables: tableOptions.primaryOption.tables,
              requiresCombination:
                tableOptions.primaryOption.requiresCombination,
              totalCapacity: tableOptions.primaryOption.totalCapacity,
            };
          }
          return null;
        });

        const batchResults = await Promise.all(batchPromises);
        fullSlots.push(
          ...(batchResults.filter((slot) => slot !== null) as TimeSlot[]),
        );
      }

      return fullSlots;
    } catch (error) {
      console.error("Error getting available slots:", error);
      return [];
    }
  }

  async areTablesAvailable(
    tableIds: string[],
    startTime: Date,
    endTime: Date,
  ): Promise<boolean> {
    const { data: conflict } = await supabase.rpc("check_booking_overlap", {
      p_table_ids: tableIds,
      p_start_time: startTime.toISOString(),
      p_end_time: endTime.toISOString(),
    });

    return !conflict;
  }

  /**
   * Cache management
   */
  clearCombinationCache(restaurantId?: string) {
    if (restaurantId) {
      this.combinationCache.invalidate(restaurantId);
      this.timeSlotsCache.invalidate(restaurantId);
      this.tableOptionsCache.invalidate(restaurantId);
      this.quickAvailabilityCache.invalidate(restaurantId);
    } else {
      this.combinationCache.invalidate();
      this.timeSlotsCache.invalidate();
      this.tableOptionsCache.invalidate();
      this.quickAvailabilityCache.invalidate();
    }
  }

  /**
   * Preload popular time slots
   */
  async preloadPopularSlots(
    restaurantId: string,
    partySizes: number[] = [2, 4],
  ): Promise<void> {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const dates = [today, tomorrow];

    setTimeout(async () => {
      try {
        for (const date of dates) {
          for (const partySize of partySizes) {
            await this.getAvailableTimeSlots(
              restaurantId,
              date,
              partySize,
              undefined,
              false,
            );
          }
        }
      } catch (error) {
        console.warn("Preload failed:", error);
      }
    }, 1000);
  }
}
