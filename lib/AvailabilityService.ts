// lib/availability/AvailabilityService.ts (Fixed for large groups)
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
    additionalTables?: Table[];
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
    entry.timestamp = now;
    return entry.data;
  }

  set(key: string, data: T): void {
    const now = Date.now();
    
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
    setTimeout(async () => {
      const promises = keys
        .filter(key => !this.get(key))
        .slice(0, 5)
        .map(async key => {
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

  private timeSlotsCache = new EnhancedCache<TimeSlotBasic[]>(50, 3 * 60 * 1000);
  private tableOptionsCache = new EnhancedCache<SlotTableOptions>(100, 2 * 60 * 1000);
  private restaurantConfigCache = new EnhancedCache<any>(20, 10 * 60 * 1000);
  private quickAvailabilityCache = new EnhancedCache<boolean>(200, 1 * 60 * 1000);

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

  async getAvailableTimeSlots(
    restaurantId: string,
    date: Date,
    partySize: number,
    userId?: string,
    preloadNextDay: boolean = true,
  ): Promise<TimeSlotBasic[]> {
    const dateStr = date.toISOString().split("T")[0];
    const cacheKey = `time-slots:${restaurantId}:${dateStr}:${partySize}:${userId || 'guest'}`;
    
    let cached = this.timeSlotsCache.get(cacheKey);
    if (cached) {
      if (preloadNextDay) {
        this.prefetchNextDay(restaurantId, date, partySize, userId);
      }
      return cached;
    }

    try {
      const [restaurant, vipBenefits] = await Promise.all([
        this.getRestaurantConfig(restaurantId),
        userId
          ? this.getVIPBenefits(restaurantId, userId)
          : Promise.resolve(null),
      ]);

      if (!restaurant) return [];

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

      const [baseSlots, turnTime] = await Promise.all([
        this.generate15MinuteSlots(restaurant.opening_time, restaurant.closing_time, restaurantId, partySize),
        this.getTurnTimeForParty(restaurantId, partySize, date)
      ]);

      const availableSlots = await this.batchQuickAvailabilityChecks(
        restaurantId,
        date,
        baseSlots,
        turnTime,
        partySize,
      );

      this.timeSlotsCache.set(cacheKey, availableSlots);
      
      if (preloadNextDay) {
        this.prefetchNextDay(restaurantId, date, partySize, userId);
      }

      return availableSlots;
    } catch (error) {
      console.error("Error getting available time slots:", error);
      return [];
    }
  }

  async getTableOptionsForSlot(
    restaurantId: string,
    date: Date,
    time: string,
    partySize: number,
  ): Promise<SlotTableOptions | null> {
    const dateStr = date.toISOString().split("T")[0];
    const cacheKey = `table-options:${restaurantId}:${dateStr}:${time}:${partySize}`;
    
    let cached = this.tableOptionsCache.get(cacheKey);
    if (cached) return cached;

    try {
      const startTime = new Date(`${dateStr}T${time}:00`);
      const turnTime = await this.getTurnTimeForParty(restaurantId, partySize, date);
      const endTime = new Date(startTime.getTime() + turnTime * 60000);

      const queryKey = `${restaurantId}:${startTime.toISOString()}:${endTime.toISOString()}:${partySize}`;
      if (this.batchedQueries.has(queryKey)) {
        const availableTables = await this.batchedQueries.get(queryKey);
        return this.processTableOptions(time, availableTables, restaurantId, startTime, endTime, partySize, cacheKey);
      }

      const tablesPromise = supabase.rpc("get_available_tables", {
        p_restaurant_id: restaurantId,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_party_size: partySize,
      });

      this.batchedQueries.set(queryKey, tablesPromise);
      setTimeout(() => this.batchedQueries.delete(queryKey), 5000);

      const { data: availableTables, error } = await tablesPromise;

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

  private async processTableOptions(
    time: string,
    availableTables: any[],
    restaurantId: string,
    startTime: Date,
    endTime: Date,
    partySize: number,
    cacheKey: string,
  ): Promise<SlotTableOptions | null> {
    // Validate table data
    const validTables = (availableTables || []).filter(table => 
      table.table_id && table.table_number && table.capacity
    ).map(table => ({
      id: table.table_id, // Ensure we use table_id from RPC result
      table_number: table.table_number,
      capacity: table.capacity,
      min_capacity: table.min_capacity,
      max_capacity: table.max_capacity,
      table_type: table.table_type || 'standard',
      is_combinable: table.is_combinable,
      priority_score: table.priority_score || 0,
      features: table.features || []
    }));
  
    console.log('Processing tables for slot:', time, 'Valid tables:', validTables.length);
  
    if (validTables.length === 0 && partySize > 2) {
      // Try combinations for larger parties
      const combination = await this.findTableCombinationForLargeParties(
        restaurantId,
        startTime,
        endTime,
        partySize
      );
  
      if (combination && combination.length > 0) {
        const totalCapacity = combination.reduce((sum, t) => sum + t.capacity, 0);
        const combinationOption: TableOption = {
          tables: combination,
          requiresCombination: true,
          totalCapacity: totalCapacity,
          tableTypes: [...new Set(combination.map(t => t.table_type))],
          experienceTitle: combination.length > 2 ? "Special Group Arrangement" : "Private Group Arrangement",
          experienceDescription: `${combination.length} tables specially arranged together for your party of ${partySize}`,
          isPerfectFit: totalCapacity >= partySize && totalCapacity <= partySize + 2,
          combinationInfo: {
            primaryTable: combination[0],
            secondaryTable: combination[1],
            additionalTables: combination.length > 2 ? combination.slice(2) : undefined,
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
      return null;
    }
  
    if (validTables.length === 0) {
      return null;
    }
  
    const tableOptions = this.createOptimizedTableOptions(validTables, partySize);
    
    if (tableOptions.length === 0) {
      return null;
    }
  
    const primaryOption = this.selectPrimaryOption(tableOptions, partySize);
    const result = {
      time,
      options: tableOptions,
      primaryOption,
    };
  
    this.tableOptionsCache.set(cacheKey, result);
    return result;
  }

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

    const batchSize = 10;
    for (let i = 0; i < baseSlots.length; i += batchSize) {
      const batch = baseSlots.slice(i, i + batchSize);
      const batchPromises = batch.map(async (slot) => {
        const startTime = new Date(`${dateStr}T${slot.time}:00`);
        
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

  private prefetchNextDay(
    restaurantId: string,
    currentDate: Date,
    partySize: number,
    userId?: string,
  ): void {
    const nextDay = new Date(currentDate);
    nextDay.setDate(currentDate.getDate() + 1);

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

  private async quickAvailabilityCheck(
    restaurantId: string,
    startTime: Date,
    endTime: Date,
    partySize: number,
  ): Promise<boolean> {
    try {
      // For large parties, always check combinations
      if (partySize > 6) {
        return await this.quickCombinationCheckForLargeParties(restaurantId, startTime, endTime, partySize);
      }

      const { data: availabilityCheck, error } = await supabase.rpc(
        "quick_availability_check",
        {
          p_restaurant_id: restaurantId,
          p_start_time: startTime.toISOString(),
          p_end_time: endTime.toISOString(),
          p_party_size: partySize,
        },
      );

      if (!error && availabilityCheck !== undefined) {
        return availabilityCheck;
      }

      const { data: singleTable } = await supabase.rpc("get_available_tables", {
        p_restaurant_id: restaurantId,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_party_size: partySize,
      });

      if (singleTable && singleTable.length > 0) {
        return true;
      }

      if (partySize > 2) {
        return await this.quickCombinationCheckForLargeParties(restaurantId, startTime, endTime, partySize);
      }

      return false;
    } catch (error) {
      console.error("Error in quick availability check:", error);
      return false;
    }
  }

  // NEW METHOD: Enhanced combination check for large parties
  private async quickCombinationCheckForLargeParties(
    restaurantId: string,
    startTime: Date,
    endTime: Date,
    partySize: number,
  ): Promise<boolean> {
    // Get all combinable tables
    const { data: combinableTables } = await supabase
      .from("restaurant_tables")
      .select("id, capacity")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .eq("is_combinable", true)
      .order("capacity", { ascending: false });

    if (!combinableTables || combinableTables.length < 2) return false;

    // For very large parties, check if we can combine multiple tables
    const requiredTables = Math.ceil(partySize / 6); // Assume average table capacity of 6
    
    if (combinableTables.length < requiredTables) return false;

    // Quick check: see if total capacity is sufficient
    const totalCapacity = combinableTables.reduce((sum, table) => sum + table.capacity, 0);
    if (totalCapacity < partySize) return false;

    // Try to find a combination that works
    const combination = await this.findQuickCombination(
      combinableTables,
      partySize,
      startTime,
      endTime,
      requiredTables
    );

    return combination !== null;
  }

  // NEW METHOD: Find quick combination for availability check
  private async findQuickCombination(
    tables: any[],
    partySize: number,
    startTime: Date,
    endTime: Date,
    maxTables: number
  ): Promise<any[] | null> {
    // Sort tables by capacity descending
    const sortedTables = [...tables].sort((a, b) => b.capacity - a.capacity);

    // Try greedy approach first
    let selectedTables: any[] = [];
    let currentCapacity = 0;

    for (const table of sortedTables) {
      if (selectedTables.length >= maxTables) break;
      
      selectedTables.push(table);
      currentCapacity += table.capacity;

      if (currentCapacity >= partySize) {
        // Check if this combination is available
        const tableIds = selectedTables.map(t => t.id);
        const { data: conflict } = await supabase.rpc("check_booking_overlap", {
          p_table_ids: tableIds,
          p_start_time: startTime.toISOString(),
          p_end_time: endTime.toISOString(),
        });

        if (!conflict) {
          return selectedTables;
        }

        // If conflict, try without the last table
        selectedTables.pop();
        currentCapacity -= table.capacity;
      }
    }

    return null;
  }

  // UPDATED METHOD: Support multi-table combinations for large parties
  private async findTableCombinationForLargeParties(
    restaurantId: string,
    startTime: Date,
    endTime: Date,
    partySize: number
  ): Promise<Table[] | null> {
    const cacheKey = `combination:${restaurantId}:${partySize}`;
    
    let cached = this.combinationCache.get(cacheKey);
    if (cached) {
      const tableIds = cached.map(t => t.id);
      const { data: conflict } = await supabase.rpc("check_booking_overlap", {
        p_table_ids: tableIds,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
      });

      if (!conflict) {
        return cached;
      }
    }

    // Get all combinable tables
    const { data: tables } = await supabase
      .from("restaurant_tables")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .eq("is_combinable", true)
      .order("capacity", { ascending: false });

    if (!tables || tables.length < 2) return null;

    // For large parties, we need multiple tables
    const requiredTables = Math.min(Math.ceil(partySize / 4), 5); // Max 5 tables

    // Try different combination strategies
    let combination = await this.findOptimalCombination(
      tables,
      startTime,
      endTime,
      partySize,
      requiredTables
    );

    if (combination) {
      this.combinationCache.set(cacheKey, combination);
    }

    return combination;
  }

  // NEW METHOD: Find optimal combination for large parties
  private async findOptimalCombination(
    tables: Table[],
    startTime: Date,
    endTime: Date,
    partySize: number,
    maxTables: number
  ): Promise<Table[] | null> {
    // Sort tables by capacity descending
    const sortedTables = [...tables].sort((a, b) => b.capacity - a.capacity);

    // Try greedy approach with backtracking
    const result = await this.findCombinationRecursive(
      sortedTables,
      [],
      0,
      partySize,
      maxTables,
      startTime,
      endTime,
      new Set()
    );

    return result;
  }

  // NEW METHOD: Recursive combination finder with memoization
  private async findCombinationRecursive(
    tables: Table[],
    currentCombination: Table[],
    currentCapacity: number,
    targetCapacity: number,
    maxTables: number,
    startTime: Date,
    endTime: Date,
    checkedCombinations: Set<string>
  ): Promise<Table[] | null> {
    // Base cases
    if (currentCapacity >= targetCapacity) {
      // Check if this combination is available
      const tableIds = currentCombination.map(t => t.id).sort();
      const combinationKey = tableIds.join(',');

      if (checkedCombinations.has(combinationKey)) {
        return null;
      }
      checkedCombinations.add(combinationKey);

      const { data: conflict } = await supabase.rpc("check_booking_overlap", {
        p_table_ids: tableIds,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
      });

      if (!conflict) {
        return currentCombination;
      }
      return null;
    }

    if (currentCombination.length >= maxTables) {
      return null;
    }

    // Try adding each remaining table
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      
      // Skip if already in combination
      if (currentCombination.some(t => t.id === table.id)) {
        continue;
      }

      // Skip if adding this table would exceed reasonable capacity
      if (currentCapacity + table.capacity > targetCapacity + 6) {
        continue;
      }

      const newCombination = [...currentCombination, table];
      const newCapacity = currentCapacity + table.capacity;

      const result = await this.findCombinationRecursive(
        tables,
        newCombination,
        newCapacity,
        targetCapacity,
        maxTables,
        startTime,
        endTime,
        checkedCombinations
      );

      if (result) {
        return result;
      }
    }

    return null;
  }

  private createOptimizedTableOptions(availableTables: Table[], partySize: number): TableOption[] {
    const exactCapacityTables = availableTables.filter(table => table.capacity === partySize);

    if (exactCapacityTables.length > 0) {
        const exactFitOptions = exactCapacityTables.map(table => {
            const experience = this.getTableExperience(table, partySize);
            return {
                tables: [table],
                requiresCombination: false,
                totalCapacity: table.capacity,
                tableTypes: [table.table_type],
                experienceTitle: experience.title,
                experienceDescription: experience.description,
                isPerfectFit: true,
            };
        });
        return exactFitOptions.sort((a, b) => {
            const scoreA = this.getExperienceScore(a.tableTypes[0], partySize);
            const scoreB = this.getExperienceScore(b.tableTypes[0], partySize);
            return scoreB - scoreA;
        });
    }

    const tablesByType = availableTables.reduce((groups, table) => {
      const type = table.table_type;
      if (!groups[type]) groups[type] = [];
      groups[type].push(table);
      return groups;
    }, {} as Record<string, Table[]>);

    const additionalOptions = this.createAdditionalOptions(
      tablesByType,
      partySize,
      []
    );

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

  private createAdditionalOptions(
    tablesByType: Record<string, Table[]>,
    partySize: number,
    existingTypes: string[],
  ): TableOption[] {
    const additionalOptions: TableOption[] = [];

    Object.entries(tablesByType).forEach(([tableType, tables]) => {
      if (existingTypes.includes(tableType)) return;

      // For large parties, be more lenient with capacity
      const maxOvercapacity = partySize > 8 ? 6 : 3;
      const reasonableTables = tables.filter(table => 
        table.capacity >= partySize && table.capacity <= partySize + maxOvercapacity
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

  private getTableExperience(table: Table, partySize: number): { title: string; description: string } {
    const tableType = table.table_type;
    const isCozy = partySize <= 2;
    const isGroup = partySize >= 6;
    const isLargeGroup = partySize >= 10;

    const experiences: Record<string, { title: string; description: string }> = {
      'booth': {
        title: isCozy ? 'Intimate Booth' : isGroup ? 'Large Booth Section' : 'Cozy Booth Seating',
        description: isCozy 
          ? 'Private and romantic booth perfect for intimate dining'
          : isGroup
          ? 'Spacious booth area ideal for group gatherings'
          : 'Comfortable booth seating with privacy and warmth'
      },
      'window': {
        title: isLargeGroup ? 'Window Area' : 'Window View',
        description: isLargeGroup
          ? 'Window seating area with beautiful views for your group'
          : isCozy
          ? 'Scenic window seating with natural light and views'
          : 'Bright window table with lovely views while you dine'
      },
      'patio': {
        title: isLargeGroup ? 'Outdoor Event Space' : 'Outdoor Dining',
        description: isLargeGroup
          ? 'Spacious outdoor area perfect for large group celebrations'
          : isCozy
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
        title: isLargeGroup ? 'Main Dining Area' : 'Classic Dining',
        description: isLargeGroup
          ? 'Central dining area with ample space for your party'
          : isCozy
          ? 'Traditional table setting in the heart of the restaurant'
          : 'Prime dining room seating with full restaurant atmosphere'
      }
    };

    return (
      experiences[tableType] || {
        title: "Restaurant Seating",
        description: "Quality dining table in a welcoming atmosphere",
      }
    );
  }

  private isUniqueExperience(tableType: string, existingTypes: string[]): boolean {
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

    // Updated size preferences for large groups
    const sizePreferences: Record<string, Record<number, number>> = {
      'booth': { 1: 5, 2: 15, 3: 8, 4: 12, 5: 3, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 },
      'window': { 1: 8, 2: 12, 3: 10, 4: 8, 5: 5, 6: 3, 7: 2, 8: 1, 9: 0, 10: 0, 11: 0, 12: 0 },
      'private': { 1: 0, 2: 3, 3: 5, 4: 8, 5: 12, 6: 15, 7: 18, 8: 20, 9: 22, 10: 25, 11: 25, 12: 25 },
      'bar': { 1: 10, 2: 8, 3: 3, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 },
      'patio': { 1: 5, 2: 12, 3: 8, 4: 10, 5: 6, 6: 4, 7: 2, 8: 5, 9: 8, 10: 10, 11: 10, 12: 10 },
      'standard': { 1: 6, 2: 8, 3: 10, 4: 10, 5: 8, 6: 6, 7: 4, 8: 2, 9: 5, 10: 8, 11: 8, 12: 8 },
    };

    const sizeBonus = sizePreferences[tableType]?.[Math.min(partySize, 12)] || 0;
    return score + sizeBonus;
  }

  private selectPrimaryOption(options: TableOption[], partySize: number): TableOption {
    const perfectFits = options.filter(opt => opt.isPerfectFit);
    if (perfectFits.length > 0) {
      return perfectFits[0];
    }
    
    return options[0];
  }

  private combinationCache = new EnhancedCache<Table[]>(30, 5 * 60 * 1000);
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

  // UPDATED METHOD: Better time slot generation for large parties
  private async generate15MinuteSlots(
    openTime: string,
    closeTime: string,
    restaurantId: string,
    partySize: number
  ): Promise<{ time: string }[]> {
    const slots: { time: string }[] = [];
    const [openHour, openMin] = openTime.split(":").map(Number);
    const [closeHour, closeMin] = closeTime.split(":").map(Number);

    let currentHour = openHour;
    let currentMin = openMin;

    currentMin = Math.ceil(currentMin / 15) * 15;
    if (currentMin === 60) {
      currentMin = 0;
      currentHour++;
    }

    const closeTimeInMinutes = closeHour * 60 + closeMin;
    
    // For large parties, get appropriate turn time
    const turnTimeForParty = this.getDefaultTurnTime(partySize);
    const maxTurnTime = Math.max(await this.getMaxTurnTime(restaurantId), turnTimeForParty);

    // Allow booking closer to closing time for large parties
    const bufferTime = partySize > 8 ? maxTurnTime - 30 : maxTurnTime;

    while (currentHour * 60 + currentMin <= closeTimeInMinutes - bufferTime) {
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

  private getDefaultTurnTime(partySize: number): number {
    if (partySize <= 2) return 90;
    if (partySize <= 4) return 120;
    if (partySize <= 6) return 150;
    if (partySize <= 8) return 180;
    if (partySize <= 10) return 210;
    return 240; // 4 hours for very large groups
  }

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
  
          if (tableOptions && tableOptions.primaryOption) {
            // Ensure all tables have valid IDs
            const validTables = tableOptions.primaryOption.tables.filter(t => t.id);
            
            if (validTables.length > 0) {
              return {
                time: timeSlot.time,
                available: true,
                tables: validTables,
                requiresCombination: tableOptions.primaryOption.requiresCombination,
                totalCapacity: tableOptions.primaryOption.totalCapacity,
              };
            }
          }
          return null;
        });
  
        const batchResults = await Promise.all(batchPromises);
        fullSlots.push(
          ...(batchResults.filter((slot) => slot !== null) as TimeSlot[]),
        );
      }
  
      console.log('Available slots with tables:', fullSlots.map(s => ({
        time: s.time,
        tableCount: s.tables?.length || 0,
        tableIds: s.tables?.map(t => t.id) || []
      })));
  
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

  async preloadPopularSlots(restaurantId: string, partySizes: number[] = [2, 4]): Promise<void> {
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
