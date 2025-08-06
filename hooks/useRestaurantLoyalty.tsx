// hooks/useRestaurantLoyalty.ts
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";

type RestaurantLoyaltyBalance = {
  id: string;
  restaurant_id: string;
  total_purchased: number;
  current_balance: number;
  last_purchase_at: string | null;
};

type RestaurantLoyaltyRule = {
  id: string;
  restaurant_id: string;
  rule_name: string;
  points_to_award: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string | null;
  applicable_days: number[];
  start_time_minutes: number | null;
  end_time_minutes: number | null;
  minimum_party_size: number;
  maximum_party_size: number | null;
  max_uses_total: number | null;
  current_uses: number;
  max_uses_per_user: number | null;
  priority: number;
};

type LoyaltyTransaction = {
  id: string;
  restaurant_id: string;
  transaction_type: "purchase" | "deduction" | "refund" | "adjustment";
  points: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  booking_id: string | null;
  user_id: string | null;
  created_at: string;
};

export interface PotentialLoyaltyPoints {
  ruleId: string;
  ruleName: string;
  pointsToAward: number;
  available: boolean;
  reason?: string;
}

export interface LoyaltyRuleDetails {
  id: string;
  rule_name: string;
  points_to_award: number;
  restaurant_id: string;
}

export const useRestaurantLoyalty = (restaurantId?: string) => {
  const [balance, setBalance] = useState<RestaurantLoyaltyBalance | null>(null);
  const [rules, setRules] = useState<RestaurantLoyaltyRule[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true); // Start with true
  const [error, setError] = useState<string | null>(null);
  const [hasLoyaltyProgram, setHasLoyaltyProgram] = useState(false);

  // Fetch restaurant loyalty balance
  const fetchBalance = useCallback(async () => {
    if (!restaurantId) return;

    try {
      const { data, error } = await supabase
        .from("restaurant_loyalty_balance")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No balance record - restaurant hasn't set up loyalty
          setBalance(null);
          setHasLoyaltyProgram(false);
        } else {
          throw error;
        }
      } else {
        setBalance(data);
        // Only has loyalty program if they've purchased points
        setHasLoyaltyProgram(data.total_purchased > 0);
      }
    } catch (err: any) {
      console.error("Error fetching restaurant loyalty balance:", err);
      setError(err.message);
      setHasLoyaltyProgram(false);
    }
  }, [restaurantId]);

  // Fetch active loyalty rules - only if has loyalty program
  const fetchRules = useCallback(async () => {
    if (!restaurantId || !hasLoyaltyProgram) {
      setRules([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("restaurant_loyalty_rules")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("priority", { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (err: any) {
      console.error("Error fetching loyalty rules:", err);
      setError(err.message);
      setRules([]);
    }
  }, [restaurantId, hasLoyaltyProgram]);

  // Fetch recent transactions
  const fetchTransactions = useCallback(
    async (limit = 10) => {
      if (!restaurantId || !hasLoyaltyProgram) {
        setTransactions([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("restaurant_loyalty_transactions")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;
        setTransactions(data || []);
      } catch (err: any) {
        console.error("Error fetching loyalty transactions:", err);
        setError(err.message);
      }
    },
    [restaurantId, hasLoyaltyProgram],
  );

  // Check potential points
  const checkPotentialPoints = useCallback(
    async (
      bookingTime: Date,
      partySize: number,
      userId: string,
    ): Promise<PotentialLoyaltyPoints | null> => {
      // Early returns for invalid states
      if (!restaurantId || !hasLoyaltyProgram || !balance) {
        return null;
      }

      // If no balance or zero balance, no points available
      if (balance.current_balance <= 0) {
        return {
          ruleId: "",
          ruleName: "No Points Available",
          pointsToAward: 0,
          available: false,
          reason: "The restaurant has run out of loyalty points",
        };
      }

      // If no rules, no points available
      if (rules.length === 0) {
        return null;
      }

      try {
        // Get day of week and time in minutes
        const dayOfWeek = bookingTime.getDay();
        const timeMinutes =
          bookingTime.getHours() * 60 + bookingTime.getMinutes();

        // Filter applicable rules
        const applicableRules = rules.filter((rule) => {
          // Check if rule is within valid date range
          const validFrom = new Date(rule.valid_from);
          const validUntil = rule.valid_until
            ? new Date(rule.valid_until)
            : null;

          if (validFrom > bookingTime) return false;
          if (validUntil && validUntil < bookingTime) return false;

          // Check day of week
          if (!rule.applicable_days.includes(dayOfWeek)) return false;

          // Check time range
          if (
            rule.start_time_minutes !== null &&
            rule.end_time_minutes !== null
          ) {
            if (
              timeMinutes < rule.start_time_minutes ||
              timeMinutes > rule.end_time_minutes
            ) {
              return false;
            }
          }

          // Check party size
          if (partySize < rule.minimum_party_size) return false;
          if (rule.maximum_party_size && partySize > rule.maximum_party_size)
            return false;

          // Check if restaurant has enough balance
          if (rule.points_to_award > balance.current_balance) return false;

          // Check total usage limit
          if (rule.max_uses_total && rule.current_uses >= rule.max_uses_total)
            return false;

          return true;
        });

        if (applicableRules.length === 0) {
          return null;
        }

        // Get the highest priority rule with most points
        const bestRule = applicableRules[0];

        // Check user-specific usage
        if (bestRule.max_uses_per_user) {
          const { data: usageData, error: usageError } = await supabase
            .from("user_loyalty_rule_usage")
            .select("id")
            .eq("user_id", userId)
            .eq("rule_id", bestRule.id);

          if (usageError) throw usageError;

          if (usageData && usageData.length >= bestRule.max_uses_per_user) {
            return {
              ruleId: bestRule.id,
              ruleName: bestRule.rule_name,
              pointsToAward: bestRule.points_to_award,
              available: false,
              reason:
                "You have already used this offer the maximum number of times",
            };
          }
        }

        return {
          ruleId: bestRule.id,
          ruleName: bestRule.rule_name,
          pointsToAward: bestRule.points_to_award,
          available: true,
        };
      } catch (err: any) {
        console.error("Error checking potential points:", err);
        return null;
      }
    },
    [restaurantId, hasLoyaltyProgram, balance, rules],
  );

  // Format time range for display
  const formatTimeRange = useCallback(
    (startMinutes: number | null, endMinutes: number | null) => {
      if (startMinutes === null || endMinutes === null) return "All day";

      const formatTime = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const period = hours >= 12 ? "PM" : "AM";
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        return `${displayHours}:${mins.toString().padStart(2, "0")} ${period}`;
      };

      return `${formatTime(startMinutes)} - ${formatTime(endMinutes)}`;
    },
    [],
  );

  // Format days for display
  const formatDays = useCallback((days: number[]) => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    if (days.length === 7) return "Every day";
    if (days.length === 0) return "No days";

    // Check for weekdays/weekends
    const weekdays = [1, 2, 3, 4, 5];
    const weekends = [0, 6];

    if (days.length === 5 && days.every((d) => weekdays.includes(d))) {
      return "Weekdays";
    }
    if (days.length === 2 && days.every((d) => weekends.includes(d))) {
      return "Weekends";
    }

    return days.map((d) => dayNames[d]).join(", ");
  }, []);

  // Initial fetch - sequential to check if has loyalty first
  useEffect(() => {
    if (restaurantId) {
      const init = async () => {
        setLoading(true);
        await fetchBalance(); // This sets hasLoyaltyProgram
        setLoading(false);
      };
      init();
    }
  }, [restaurantId, fetchBalance]);

  // Fetch rules and transactions only if has loyalty program
  useEffect(() => {
    if (hasLoyaltyProgram) {
      Promise.all([fetchRules(), fetchTransactions()]);
    }
  }, [hasLoyaltyProgram, fetchRules, fetchTransactions]);

  // Subscribe to real-time updates only if has loyalty program
  useEffect(() => {
    if (!restaurantId || !hasLoyaltyProgram) return;

    const balanceSubscription = supabase
      .channel(`restaurant_loyalty_balance:${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurant_loyalty_balance",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            setBalance(payload.new as RestaurantLoyaltyBalance);
          }
        },
      )
      .subscribe();

    const rulesSubscription = supabase
      .channel(`restaurant_loyalty_rules:${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurant_loyalty_rules",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          fetchRules();
        },
      )
      .subscribe();

    return () => {
      balanceSubscription.unsubscribe();
      rulesSubscription.unsubscribe();
    };
  }, [restaurantId, hasLoyaltyProgram, fetchRules]);

  return {
    balance,
    rules,
    transactions,
    loading,
    error,
    hasLoyaltyProgram, // New field to check if restaurant has loyalty
    checkPotentialPoints,
    formatTimeRange,
    formatDays,
    refetch: () => {
      fetchBalance();
      if (hasLoyaltyProgram) {
        fetchRules();
        fetchTransactions();
      }
    },
  };
};
