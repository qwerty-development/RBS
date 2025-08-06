// hooks/useRestaurantAvailability.ts
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/config/supabase'
import { format, addDays, startOfDay } from 'date-fns'

interface RestaurantHours {
  day_of_week: string
  is_open: boolean
  open_time: string | null
  close_time: string | null
}

interface SpecialHours {
  date: string
  is_closed: boolean
  open_time: string | null
  close_time: string | null
  reason: string | null
}

interface Closure {
  start_date: string
  end_date: string
  reason: string
}

interface AvailabilityStatus {
  isOpen: boolean
  reason?: string
  hours?: Array<{  // UPDATED: Array for multiple shifts
    open: string
    close: string
  }>
  nextOpenTime?: {
    date: Date
    time: string
  }
}

export function useRestaurantAvailability(restaurantId: string) {
 
  const [loading, setLoading] = useState(true)
  const [regularHours, setRegularHours] = useState<RestaurantHours[]>([])
  const [specialHours, setSpecialHours] = useState<SpecialHours[]>([])
  const [closures, setClosures] = useState<Closure[]>([])

  useEffect(() => {
    if (!restaurantId) return

    fetchAvailabilityData()
  }, [restaurantId])

  const fetchAvailabilityData = async () => {
    try {
      setLoading(true)
      const today = format(new Date(), 'yyyy-MM-dd')

      const [regularRes, specialRes, closuresRes] = await Promise.all([
        supabase
          .from('restaurant_hours')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .order('day_of_week')
          .order('open_time'),  // UPDATED: Order by open time for multiple shifts
        supabase
          .from('restaurant_special_hours')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .gte('date', today),
        supabase
          .from('restaurant_closures')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .gte('end_date', today)
      ])

      if (regularRes.data) setRegularHours(regularRes.data)
      if (specialRes.data) setSpecialHours(specialRes.data)
      if (closuresRes.data) setClosures(closuresRes.data)
    } catch (error) {
      console.error('Error fetching availability:', error)
    } finally {
      setLoading(false)
    }
  }

  const findNextOpenTime = useCallback((fromDate: Date): { date: Date; time: string } | undefined => {
    // Look up to 7 days ahead
    for (let i = 1; i <= 7; i++) {
      const checkDate = addDays(fromDate, i)
      const dateStr = format(checkDate, 'yyyy-MM-dd')
      const dayOfWeek = format(checkDate, 'EEEE').toLowerCase()

      // Check closures first
      const closure = closures.find(c => 
        dateStr >= c.start_date && dateStr <= c.end_date
      )
      if (closure) {
        continue // Skip this day
      }

      // Check special hours
      const special = specialHours.find(s => s.date === dateStr)
      if (special) {
        if (special.is_closed) {
          continue // Skip this day
        }
        
        if (special.open_time && special.close_time) {
          return {
            date: checkDate,
            time: special.open_time
          }
        }
      }

      // UPDATED: Check regular hours (get first shift of the day)
      const regularShifts = regularHours.filter(h => 
        h.day_of_week === dayOfWeek && h.is_open && h.open_time
      )
      
      if (regularShifts.length > 0) {
        // Sort by open time and get the earliest shift
        const earliestShift = regularShifts.sort((a, b) => {
          const aTime = a.open_time || '23:59'
          const bTime = b.open_time || '23:59'
          return aTime.localeCompare(bTime)
        })[0]
        
        if (earliestShift.open_time) {
          return {
            date: checkDate,
            time: earliestShift.open_time
          }
        }
      }
    }
    
    return undefined
  }, [regularHours, specialHours, closures])

  const checkAvailability = useCallback((date: Date, time?: string): AvailabilityStatus => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayOfWeek = format(date, 'EEEE').toLowerCase()

    // Check closures first
    const closure = closures.find(c => 
      dateStr >= c.start_date && dateStr <= c.end_date
    )
    if (closure) {
      return {
        isOpen: false,
        reason: closure.reason || 'Temporarily closed'
      }
    }

    // Check special hours
    const special = specialHours.find(s => s.date === dateStr)
    if (special) {
      if (special.is_closed) {
        return {
          isOpen: false,
          reason: special.reason || 'Closed for special occasion'
        }
      }
      
      if (special.open_time && special.close_time) {
        const isWithinHours = time ? 
          isTimeWithinRange(time, special.open_time, special.close_time) : true
        
        return {
          isOpen: isWithinHours,
          hours: [{
            open: special.open_time,
            close: special.close_time
          }]
        }
      }
    }

    // UPDATED: Check ALL regular hour shifts for the day
    const regularShifts = regularHours.filter(h => 
      h.day_of_week === dayOfWeek && h.is_open
    )
    
    if (regularShifts.length === 0) {
      return {
        isOpen: false,
        reason: 'Closed today',
        nextOpenTime: findNextOpenTime(date)
      }
    }

    // Collect all shifts for the day
    const shiftsWithTimes = regularShifts.filter(h => h.open_time && h.close_time)
    
    if (shiftsWithTimes.length === 0) {
      return {
        isOpen: false,
        reason: 'No operating hours available',
        nextOpenTime: findNextOpenTime(date)
      }
    }

    const dayShifts = shiftsWithTimes.map(h => ({
      open: h.open_time!,
      close: h.close_time!
    }))

    // If time is provided, check if it's within ANY shift
    if (time) {
      let isWithinAnyShift = false
      
      for (const shift of dayShifts) {
        if (isTimeWithinRange(time, shift.open, shift.close)) {
          isWithinAnyShift = true
          break
        }
      }
      
      return {
        isOpen: isWithinAnyShift,
        hours: dayShifts,
        reason: !isWithinAnyShift ? 'Restaurant is closed at this time' : undefined
      }
    }

    // No specific time provided, return all shifts
    return {
      isOpen: true,
      hours: dayShifts
    }
  }, [regularHours, specialHours, closures, findNextOpenTime])

  const getAvailableTimeSlots = (
    date: Date,
    slotDuration: number = 30
  ): string[] => {
    const availability = checkAvailability(date)
    
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

      for (let minutes = startMinutes; minutes <= endMinutes - mealDuration; minutes += slotDuration) {
        const hour = Math.floor(minutes / 60)
        const min = minutes % 60
        slots.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`)
      }
    }

    // Remove duplicates and sort
    return [...new Set(slots)].sort()
  }

  const formatOperatingHours = (): string => {
    const today = new Date()
    const status = checkAvailability(today)
    
    if (!status.isOpen) {
      return status.reason || 'Closed'
    }
    
    if (status.hours) {
      return formatHoursDisplay(status.hours)
    }
    
    return 'Open'
  }

  const getWeeklySchedule = () => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    
    return days.map(day => {
      // UPDATED: Get ALL shifts for each day
      const dayShifts = regularHours.filter(h => h.day_of_week === day)
      const openShifts = dayShifts.filter(h => h.is_open && h.open_time && h.close_time)
      
      return {
        day,
        isOpen: openShifts.length > 0,
        hours: openShifts.map(h => ({
          open: h.open_time!,
          close: h.close_time!
        }))
      }
    })
  }

  return {
    loading,
    checkAvailability,
    getAvailableTimeSlots,
    formatOperatingHours,
    getWeeklySchedule,
    specialHours,
    closures,
    regularHours,
    refreshAvailability: fetchAvailabilityData
  }
}

// Helper functions
function isTimeWithinRange(
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

  if (closeMinutes < openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes
  }

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes
}

// UPDATED: Format hours display for multiple shifts
function formatHoursDisplay(hours: Array<{ open: string; close: string }>): string {
  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number)
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
  }

  if (hours.length === 0) return 'Closed'
  
  if (hours.length === 1) {
    return `${formatTime(hours[0].open)} - ${formatTime(hours[0].close)}`
  }

  // Multiple shifts format
  return hours.map(shift => 
    `${formatTime(shift.open)} - ${formatTime(shift.close)}`
  ).join(', ')
}