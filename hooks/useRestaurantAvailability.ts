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
  hours?: {
    open: string
    close: string
  }
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
          .eq('restaurant_id', restaurantId),
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

      // Check closures first (without calling checkAvailability to avoid recursion)
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

      // Check regular hours
      const regular = regularHours.find(h => h.day_of_week === dayOfWeek)
      if (regular && regular.is_open && regular.open_time) {
        return {
          date: checkDate,
          time: regular.open_time
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
          hours: {
            open: special.open_time,
            close: special.close_time
          }
        }
      }
    }

    // Check regular hours
    const regular = regularHours.find(h => h.day_of_week === dayOfWeek)
    if (!regular || !regular.is_open) {
      return {
        isOpen: false,
        reason: 'Closed today',
        nextOpenTime: findNextOpenTime(date)
      }
    }

    if (regular.open_time && regular.close_time) {
      const isWithinHours = time ? 
        isTimeWithinRange(time, regular.open_time, regular.close_time) : true
      
      return {
        isOpen: isWithinHours,
        hours: {
          open: regular.open_time,
          close: regular.close_time
        }
      }
    }

    return { isOpen: true }
  }, [regularHours, specialHours, closures])

  const getAvailableTimeSlots = (
    date: Date,
    slotDuration: number = 30
  ): string[] => {
    const availability = checkAvailability(date)
    
    if (!availability.isOpen || !availability.hours) {
      return []
    }

    const slots: string[] = []
    const [openHour, openMin] = availability.hours.open.split(':').map(Number)
    const [closeHour, closeMin] = availability.hours.close.split(':').map(Number)

    const startMinutes = openHour * 60 + openMin
    const endMinutes = closeHour * 60 + closeMin
    const mealDuration = 90 // Assume 90 minutes for a meal

    for (let minutes = startMinutes; minutes <= endMinutes - mealDuration; minutes += slotDuration) {
      const hour = Math.floor(minutes / 60)
      const min = minutes % 60
      slots.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`)
    }

    return slots
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
      const hours = regularHours.find(h => h.day_of_week === day)
      return {
        day,
        isOpen: hours?.is_open || false,
        hours: hours?.is_open && hours.open_time && hours.close_time ? {
          open: hours.open_time,
          close: hours.close_time
        } : null
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

function formatHoursDisplay(hours: { open: string; close: string }): string {
  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number)
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
  }

  return `${formatTime(hours.open)} - ${formatTime(hours.close)}`
}