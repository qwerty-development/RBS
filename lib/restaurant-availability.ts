// lib/restaurant-availability.ts
import { supabase } from '@/config/supabase'
import { format } from 'date-fns'

export interface RestaurantHours {
  id: string
  restaurant_id: string
  day_of_week: string
  is_open: boolean
  open_time: string | null
  close_time: string | null
}

export interface SpecialHours {
  id: string
  restaurant_id: string
  date: string
  is_closed: boolean
  open_time: string | null
  close_time: string | null
  reason: string | null
}

export interface Closure {
  id: string
  restaurant_id: string
  start_date: string
  end_date: string
  reason: string
}

export class RestaurantAvailability {

  private cache = new Map<string, { data: any; timestamp: number }>()
  private cacheTimeout = 5 * 60 * 1000 // 5 minutes

  /**
   * Check if a restaurant is open at a specific date and time (MULTIPLE SHIFTS SUPPORT)
   */
  async isRestaurantOpen(
    restaurantId: string,
    date: Date,
    time?: string // Format: "HH:mm"
  ): Promise<{
    isOpen: boolean
    reason?: string
    hours?: { open: string; close: string }[]  // UPDATED: Array for multiple shifts
  }> {
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayOfWeek = format(date, 'EEEE').toLowerCase()
      const cacheKey = `${restaurantId}-${dateStr}-${time || 'all'}`

      // Check cache
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data
      }

      // Check for closures first
      const { data: closures, error: closureError } = await supabase
        .from('restaurant_closures')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .lte('start_date', dateStr)
        .gte('end_date', dateStr)
        .maybeSingle()  // Still use maybeSingle for closures

      if (closureError && closureError.code !== 'PGRST116') {
        console.error('Error checking closures:', closureError)
        throw new Error('Failed to check restaurant availability')
      }

      if (closures) {
        const result = {
          isOpen: false,
          reason: closures.reason || 'Temporarily closed'
        }
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
        return result
      }

      // Check for special hours
      const { data: specialHours, error: specialError } = await supabase
        .from('restaurant_special_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('date', dateStr)
        .maybeSingle()  // Still use maybeSingle for special hours (one per date)

      if (specialError && specialError.code !== 'PGRST116') {
        console.error('Error checking special hours:', specialError)
        throw new Error('Failed to check restaurant availability')
      }

      if (specialHours) {
        if (specialHours.is_closed) {
          const result = {
            isOpen: false,
            reason: specialHours.reason || 'Closed for special occasion'
          }
          this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
          return result
        }

        // If time is provided, check if it's within special hours
        if (time && specialHours.open_time && specialHours.close_time) {
          const isWithinHours = this.isTimeWithinRange(
            time,
            specialHours.open_time,
            specialHours.close_time
          )
          const result = {
            isOpen: isWithinHours,
            hours: [{
              open: specialHours.open_time,
              close: specialHours.close_time
            }]
          }
          this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
          return result
        }

        const result = {
          isOpen: true,
          hours: specialHours.open_time && specialHours.close_time ? [{
            open: specialHours.open_time,
            close: specialHours.close_time
          }] : undefined
        }
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
        return result
      }

      // UPDATED: Check ALL regular hour shifts for the day
      const { data: regularHours, error: regularError } = await supabase
        .from('restaurant_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_open', true)
        .order('open_time', { ascending: true })  // Order by opening time

      if (regularError) {
        console.error('Error checking regular hours:', regularError)
        throw new Error('Failed to check restaurant availability')
      }

      if (!regularHours || regularHours.length === 0) {
        const result = {
          isOpen: false,
          reason: 'Closed today'
        }
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
        return result
      }

      // UPDATED: Collect all shifts
      const shifts = regularHours
        .filter(shift => shift.open_time && shift.close_time)
        .map(shift => ({
          open: shift.open_time!,
          close: shift.close_time!
        }))

      // If time is provided, check if it's within ANY shift
      if (time) {
        let isWithinAnyShift = false
        let currentShift = null

        for (const shift of shifts) {
          if (this.isTimeWithinRange(time, shift.open, shift.close)) {
            isWithinAnyShift = true
            currentShift = shift
            break
          }
        }

        const result = {
          isOpen: isWithinAnyShift,
          hours: currentShift ? [currentShift] : shifts,
          reason: !isWithinAnyShift ? 'Restaurant is closed at this time' : undefined
        }
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
        return result
      }

      // If no specific time, return all shifts
      const result = {
        isOpen: true,
        hours: shifts
      }
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
      return result
    } catch (error) {
      console.error('Error in isRestaurantOpen:', error)
      // Fallback to basic availability
      return {
        isOpen: true,
        reason: 'Unable to verify hours'
      }
    }
  }

  /**
   * Clear cache for a specific restaurant
   */
  clearCache(restaurantId?: string) {
    if (restaurantId) {
      // Clear specific restaurant cache
      Array.from(this.cache.keys())
        .filter(key => key.startsWith(restaurantId))
        .forEach(key => this.cache.delete(key))
    } else {
      // Clear all cache
      this.cache.clear()
    }
  }

  /**
   * Get available time slots for a specific date (MULTIPLE SHIFTS SUPPORT)
   */
  async getAvailableTimeSlots(
    restaurantId: string,
    date: Date,
    partySize: number,
    slotDuration: number = 30 // minutes
  ): Promise<string[]> {
    const availability = await this.isRestaurantOpen(restaurantId, date)
    
    if (!availability.isOpen || !availability.hours) {
      return []
    }

    const slots: string[] = []
    const mealDuration = 90 // Assume 90 minutes for a meal

    // UPDATED: Generate slots for ALL shifts
    for (const shift of availability.hours) {
      const [openHour, openMin] = shift.open.split(':').map(Number)
      const [closeHour, closeMin] = shift.close.split(':').map(Number)

      const startMinutes = openHour * 60 + openMin
      const endMinutes = closeHour * 60 + closeMin

      // Generate slots for this shift
      for (let minutes = startMinutes; minutes < endMinutes; minutes += slotDuration) {
        const hour = Math.floor(minutes / 60)
        const min = minutes % 60
        const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
        
        // Check if there's enough time before closing for a typical meal
        if (minutes + mealDuration <= endMinutes) {
          slots.push(timeStr)
        }
      }
    }

    // Remove duplicates and sort
    return [...new Set(slots)].sort()
  }

  /**
   * Get restaurant hours for a week (MULTIPLE SHIFTS SUPPORT)
   */
  async getWeeklyHours(restaurantId: string): Promise<RestaurantHours[]> {
    const { data, error } = await supabase
      .from('restaurant_hours')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('day_of_week')
      .order('open_time')  // UPDATED: Also order by open time for multiple shifts

    if (error) {
      console.error('Error fetching weekly hours:', error)
      return []
    }

    return data || []
  }

  /**
   * Get restaurant shifts grouped by day
   */
  async getWeeklyShifts(restaurantId: string): Promise<Record<string, RestaurantHours[]>> {
    const hours = await this.getWeeklyHours(restaurantId)
    const shiftsByDay: Record<string, RestaurantHours[]> = {}

    for (const hour of hours) {
      if (!shiftsByDay[hour.day_of_week]) {
        shiftsByDay[hour.day_of_week] = []
      }
      shiftsByDay[hour.day_of_week].push(hour)
    }

    return shiftsByDay
  }

  /**
   * Get upcoming special hours and closures
   */
  async getUpcomingSpecialSchedule(restaurantId: string) {
    const today = format(new Date(), 'yyyy-MM-dd')

    const [specialHours, closures] = await Promise.all([
      supabase
        .from('restaurant_special_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('date', today)
        .order('date', { ascending: true }),
      supabase
        .from('restaurant_closures')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('end_date', today)
        .order('start_date', { ascending: true })
    ])

    return {
      specialHours: specialHours.data || [],
      closures: closures.data || []
    }
  }

  /**
   * Helper function to check if a time is within a range
   */
  private isTimeWithinRange(
    time: string,
    openTime: string,
    closeTime: string
  ): boolean {
    const [hour, minute] = time.split(':').map(Number)
    const [openHour, openMinute] = openTime.split(':').map(Number)
    const [closeHour, closeMinute] = closeTime.split(':').map(Number)

    const currentMinutes = hour * 60 + minute
    const openMinutes = openHour * 60 + openMinute
    const closeMinutes = closeHour * 60 + closeMinute

    // Handle cases where closing time is after midnight
    if (closeMinutes < openMinutes) {
      // Restaurant closes after midnight
      return currentMinutes >= openMinutes || currentMinutes < closeMinutes
    }

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  }

  /**
   * Format hours for display (MULTIPLE SHIFTS SUPPORT)
   */
  formatHoursDisplay(hours: { open: string; close: string } | { open: string; close: string }[]): string {
    const formatTime = (time: string) => {
      const [hour, minute] = time.split(':').map(Number)
      const period = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
    }

    // Handle single shift (backward compatibility)
    if (!Array.isArray(hours)) {
      return `${formatTime(hours.open)} - ${formatTime(hours.close)}`
    }

    // Handle multiple shifts
    if (hours.length === 0) return 'Closed'
    if (hours.length === 1) {
      return `${formatTime(hours[0].open)} - ${formatTime(hours[0].close)}`
    }

    // Multiple shifts format
    return hours.map(shift => 
      `${formatTime(shift.open)} - ${formatTime(shift.close)}`
    ).join(', ')
  }
}