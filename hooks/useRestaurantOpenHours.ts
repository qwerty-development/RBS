// hooks/useRestaurantOpenHours.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/config/supabase";
import { format, addDays } from "date-fns";
import { Database } from "@/types/supabase";

type RestaurantOpenHours =
  Database["public"]["Tables"]["restaurant_open_hours"]["Row"];

interface OpenHours {
  day_of_week: string;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  service_type: string;
  accepts_walkins: boolean | null;
  name: string | null;
  notes: string | null;
}

interface AvailabilityStatus {
  isOpen: boolean;
  reason?: string;
  hours?: {
    open: string;
    close: string;
    service_type: string;
    accepts_walkins: boolean | null;
  }[];
  nextOpenTime?: {
    date: Date;
    time: string;
  };
}

export function useRestaurantOpenHours(restaurantId: string) {
  const [loading, setLoading] = useState(true);
  const [openHours, setOpenHours] = useState<OpenHours[]>([]);

  useEffect(() => {
    if (!restaurantId) return;

    fetchOpenHours();
  }, [restaurantId]);

  const fetchOpenHours = async (): Promise<void> => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("restaurant_open_hours")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("day_of_week")
        .order("open_time");

      if (error) {
        console.error("Error fetching restaurant open hours:", error);
        return;
      }

      if (data) {
        setOpenHours(data);
      }
    } catch (error) {
      console.error("Error fetching open hours:", error);
    } finally {
      setLoading(false);
    }
  };

  const findNextOpenTime = useCallback(
    (fromDate: Date): { date: Date; time: string } | undefined => {
      // Look up to 7 days ahead
      for (let i = 1; i <= 7; i++) {
        const checkDate = addDays(fromDate, i);
        const dayOfWeek = format(checkDate, "EEEE").toLowerCase();

        // Get open hours for this day
        const dayHours = openHours.filter(
          (h) => h.day_of_week === dayOfWeek && h.is_open && h.open_time,
        );

        if (dayHours.length > 0) {
          // Sort by open time and get the earliest
          const earliestHours = dayHours.sort((a, b) => {
            const aTime = a.open_time || "23:59";
            const bTime = b.open_time || "23:59";
            return aTime.localeCompare(bTime);
          })[0];

          if (earliestHours.open_time) {
            return {
              date: checkDate,
              time: earliestHours.open_time,
            };
          }
        }
      }

      return undefined;
    },
    [openHours],
  );

  const checkAvailability = useCallback(
    (date: Date, time?: string): AvailabilityStatus => {
      const dayOfWeek = format(date, "EEEE").toLowerCase();

      // Get all hours for this day
      const dayHours = openHours.filter(
        (h) => h.day_of_week === dayOfWeek && h.is_open,
      );

      if (dayHours.length === 0) {
        return {
          isOpen: false,
          reason: "Closed today",
          nextOpenTime: findNextOpenTime(date),
        };
      }

      // Filter hours with valid times
      const hoursWithTimes = dayHours.filter(
        (h) => h.open_time && h.close_time,
      );

      if (hoursWithTimes.length === 0) {
        return {
          isOpen: false,
          reason: "No operating hours available",
          nextOpenTime: findNextOpenTime(date),
        };
      }

      const currentHours = hoursWithTimes.map((h) => ({
        open: h.open_time!,
        close: h.close_time!,
        service_type: h.service_type,
        accepts_walkins: h.accepts_walkins,
      }));

      // If time is provided, check if it's within ANY shift
      if (time) {
        let isWithinAnyShift = false;

        for (const shift of currentHours) {
          if (isTimeWithinRange(time, shift.open, shift.close)) {
            isWithinAnyShift = true;
            break;
          }
        }

        return {
          isOpen: isWithinAnyShift,
          hours: currentHours,
          reason: !isWithinAnyShift
            ? "Restaurant is closed at this time"
            : undefined,
        };
      }

      // No specific time provided, return all shifts
      return {
        isOpen: true,
        hours: currentHours,
      };
    },
    [openHours, findNextOpenTime],
  );

  const formatDisplayHours = (): string => {
    const today = new Date();
    const status = checkAvailability(today);

    if (!status.isOpen) {
      return status.reason || "Closed";
    }

    if (status.hours) {
      return formatHoursDisplay(status.hours);
    }

    return "Open";
  };

  const getWeeklySchedule = () => {
    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];

    return days.map((day) => {
      // Get all hours for each day
      const dayHours = openHours.filter((h) => h.day_of_week === day);
      const openShifts = dayHours.filter(
        (h) => h.is_open && h.open_time && h.close_time,
      );

      return {
        day,
        isOpen: openShifts.length > 0,
        hours: openShifts.map((h) => ({
          open: h.open_time!,
          close: h.close_time!,
          service_type: h.service_type,
          accepts_walkins: h.accepts_walkins,
          name: h.name,
          notes: h.notes,
        })),
      };
    });
  };

  return {
    loading,
    openHours,
    checkAvailability,
    formatDisplayHours,
    getWeeklySchedule,
    findNextOpenTime,
    refreshOpenHours: fetchOpenHours,
  };
}

// Helper functions
function isTimeWithinRange(
  time: string,
  openTime: string,
  closeTime: string,
): boolean {
  const [hour, minute] = time.split(":").map(Number);
  const [openHour, openMinute] = openTime.split(":").map(Number);
  const [closeHour, closeMinute] = closeTime.split(":").map(Number);

  const currentMinutes = hour * 60 + minute;
  const openMinutes = openHour * 60 + openMinute;
  const closeMinutes = closeHour * 60 + closeMinute;

  if (closeMinutes < openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

function formatHoursDisplay(
  hours: {
    open: string;
    close: string;
    service_type: string;
    accepts_walkins: boolean | null;
  }[],
): string {
  const formatTime = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
  };

  if (hours.length === 0) return "Closed";

  if (hours.length === 1) {
    return `${formatTime(hours[0].open)} - ${formatTime(hours[0].close)}`;
  }

  // Multiple shifts format
  return hours
    .map((shift) => `${formatTime(shift.open)} - ${formatTime(shift.close)}`)
    .join(", ");
}
