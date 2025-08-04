// components/restaurant/RestaurantHoursDisplay.tsx
import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import {
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Calendar,
  Info,
} from "lucide-react-native";
import { format, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";
import { useRestaurantAvailability } from "@/hooks/useRestaurantAvailability";

interface RestaurantHoursDisplayProps {
  restaurantId: string;
  className?: string;
}

export const RestaurantHoursDisplay: React.FC<RestaurantHoursDisplayProps> = ({
  restaurantId,
  className,
}) => {
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const {
    loading,
    checkAvailability,
    getWeeklySchedule,
    specialHours,
    closures,
    formatOperatingHours,
  } = useRestaurantAvailability(restaurantId);

  if (loading) {
    return (
      <View className={cn("p-4 bg-card rounded-lg", className)}>
        <Text className="text-muted-foreground">Loading hours...</Text>
      </View>
    );
  }

  const todayStatus = checkAvailability(new Date());
  const weeklySchedule = getWeeklySchedule();
  const currentHours = formatOperatingHours();

  // Format day name
  const formatDayName = (day: string) => {
    return day.charAt(0).toUpperCase() + day.slice(1);
  };

  // Get upcoming special events
  const upcomingEvents = [
    ...specialHours.map(s => ({
      type: 'special' as const,
      date: new Date(s.date),
      reason: s.reason,
      isClosed: s.is_closed,
      hours: s.is_closed ? null : {
        open: s.open_time!,
        close: s.close_time!
      }
    })),
    ...closures.map(c => ({
      type: 'closure' as const,
      date: new Date(c.start_date),
      endDate: new Date(c.end_date),
      reason: c.reason,
      isClosed: true,
      hours: null
    }))
  ].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 3);

  return (
    <View className={cn("bg-card rounded-lg p-4", className)}>
      {/* Current Status */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Clock size={20} color="#666" />
          <Text className="text-base font-medium">Hours</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View
            className={cn(
              "w-2 h-2 rounded-full",
              todayStatus.isOpen ? "bg-green-500" : "bg-red-500"
            )}
          />
          <Text
            className={cn(
              "text-sm font-medium",
              todayStatus.isOpen ? "text-green-600" : "text-red-600"
            )}
          >
            {todayStatus.isOpen ? `Open • ${currentHours}` : `Closed • ${todayStatus.reason}`}
          </Text>
        </View>
      </View>

      {/* Next open time if currently closed */}
      {!todayStatus.isOpen && todayStatus.nextOpenTime && (
        <View className="bg-muted/50 rounded-lg p-3 mb-3">
          <Text className="text-sm">
            Next open:{" "}
            <Text className="font-medium">
              {isToday(todayStatus.nextOpenTime.date)
                ? `Today at ${formatTime(todayStatus.nextOpenTime.time)}`
                : isTomorrow(todayStatus.nextOpenTime.date)
                ? `Tomorrow at ${formatTime(todayStatus.nextOpenTime.time)}`
                : `${format(todayStatus.nextOpenTime.date, "EEEE")} at ${formatTime(
                    todayStatus.nextOpenTime.time
                  )}`}
            </Text>
          </Text>
        </View>
      )}

      {/* Upcoming Special Events */}
      {upcomingEvents.length > 0 && (
        <View className="mb-3">
          <Text className="text-sm font-medium mb-2 text-muted-foreground">
            Upcoming Changes
          </Text>
          {upcomingEvents.map((event, index) => (
            <View
              key={index}
              className={cn(
                "flex-row items-center gap-2 p-2 rounded-lg mb-1",
                event.isClosed
                  ? "bg-red-50 dark:bg-red-900/20"
                  : "bg-amber-50 dark:bg-amber-900/20"
              )}
            >
              {event.type === 'closure' ? (
                <AlertTriangle size={14} color="#ef4444" />
              ) : (
                <Calendar size={14} color="#f59e0b" />
              )}
              <View className="flex-1">
                <Text className={cn(
                  "text-xs font-medium",
                  event.isClosed
                    ? "text-red-700 dark:text-red-300"
                    : "text-amber-700 dark:text-amber-300"
                )}>
                  {event.type === 'closure' && event.endDate
                    ? `${format(event.date, "MMM d")} - ${format(event.endDate, "MMM d")}`
                    : format(event.date, "EEE, MMM d")
                  }
                  {event.reason && ` • ${event.reason}`}
                </Text>
                {event.hours && (
                  <Text className="text-xs text-amber-600 dark:text-amber-400">
                    {formatTime(event.hours.open)} - {formatTime(event.hours.close)}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Weekly Schedule Toggle */}
      <Pressable
        onPress={() => setShowFullSchedule(!showFullSchedule)}
        className="flex-row items-center justify-between py-2"
      >
        <Text className="text-sm text-primary">
          {showFullSchedule ? "Hide" : "View"} weekly schedule
        </Text>
        {showFullSchedule ? (
          <ChevronUp size={16} color="#3b82f6" />
        ) : (
          <ChevronDown size={16} color="#3b82f6" />
        )}
      </Pressable>

      {/* Full Weekly Schedule */}
      {showFullSchedule && (
        <View className="mt-3 pt-3 border-t border-border">
          {weeklySchedule.map(({ day, isOpen, hours }) => (
            <View
              key={day}
              className="flex-row items-center justify-between py-2"
            >
              <Text
                className={cn(
                  "text-sm capitalize",
                  !isOpen && "text-muted-foreground"
                )}
              >
                {formatDayName(day)}
              </Text>
              <Text
                className={cn(
                  "text-sm",
                  isOpen ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {isOpen && hours
                  ? `${formatTime(hours.open)} - ${formatTime(hours.close)}`
                  : "Closed"}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// Helper function to format time
function formatTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
}