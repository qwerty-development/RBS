// hooks/useOffers.ts
import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type SpecialOffer = Database["public"]["Tables"]["special_offers"]["Row"] & {
  restaurant: Restaurant;
};

export interface EnrichedOffer extends SpecialOffer {
  claimed?: boolean;
  used?: boolean;
  redemptionCode?: string;
  claimedAt?: string;
  usedAt?: string;
  expiresAt?: string;
  isExpired?: boolean;
  canUse?: boolean;
  daysUntilExpiry?: number;
}

export interface UserOfferData {
  id: string;
  user_id: string;
  offer_id: string;
  claimed_at: string;
  used_at?: string;
  booking_id?: string;
  expires_at?: string;
  metadata?: any;
}

export interface OfferFilters {
  category: string;
  minDiscount: number;
  cuisineTypes: string[];
  sortBy: "discount" | "expiry" | "newest" | "popular";
  location?: { latitude: number; longitude: number };
  maxDistance?: number; // in km
}

export const OFFER_CATEGORIES = [
  { id: "all", label: "All", icon: "Sparkles" },
  { id: "trending", label: "Trending", icon: "TrendingUp" },
  { id: "new", label: "New", icon: "Gift" },
  { id: "expiring", label: "Ending Soon", icon: "Clock" },
  { id: "claimed", label: "My Offers", icon: "Tag" },
  { id: "nearby", label: "Nearby", icon: "MapPin" },
];

export function useOffers() {
  const { profile } = useAuth();
  
  // State
  const [offers, setOffers] = useState<EnrichedOffer[]>([]);
  const [userOffers, setUserOffers] = useState<Map<string, UserOfferData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [filters, setFilters] = useState<OfferFilters>({
    category: "all",
    minDiscount: 0,
    cuisineTypes: [],
    sortBy: "discount",
  });

  // Calculate offer expiry
  const calculateExpiryDate = useCallback((claimedAt: string, offerValidUntil: string) => {
    const claimDate = new Date(claimedAt);
    const offerExpiry = new Date(offerValidUntil);
    const thirtyDaysFromClaim = new Date(claimDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Return whichever is sooner: 30 days from claim or offer expiry
    return new Date(Math.min(thirtyDaysFromClaim.getTime(), offerExpiry.getTime()));
  }, []);

  // Enrich offer with user data
  const enrichOffer = useCallback((offer: SpecialOffer, userData?: UserOfferData): EnrichedOffer => {
    if (!userData) {
      return {
        ...offer,
        claimed: false,
        used: false,
        isExpired: false,
        canUse: false,
        daysUntilExpiry: 0,
      };
    }

    const expiryDate = calculateExpiryDate(userData.claimed_at, offer.valid_until);
    const now = new Date();
    const isExpired = now > expiryDate;
    const canUse = !isExpired && !userData.used_at;
    const daysUntilExpiry = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

    return {
      ...offer,
      claimed: true,
      used: !!userData.used_at,
      redemptionCode: userData.id,
      claimedAt: userData.claimed_at,
      usedAt: userData.used_at,
      expiresAt: expiryDate.toISOString(),
      isExpired,
      canUse,
      daysUntilExpiry,
    };
  }, [calculateExpiryDate]);

  // Fetch all offers
  const fetchOffers = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      setError(null);

      const now = new Date().toISOString();
      
      // Build query with filters
      let query = supabase
        .from("special_offers")
        .select(`
          *,
          restaurant:restaurants (*)
        `)
        .lte("valid_from", now)
        .gte("valid_until", now);

      // Apply discount filter
      if (filters.minDiscount > 0) {
        query = query.gte("discount_percentage", filters.minDiscount);
      }

      // Apply cuisine filter
      if (filters.cuisineTypes.length > 0) {
        query = query.in("restaurant.cuisine_type", filters.cuisineTypes);
      }

      const { data: offersData, error: offersError } = await query;
      if (offersError) throw offersError;

      // Fetch user's claimed offers
      const { data: userOffersData, error: userOffersError } = await supabase
        .from("user_offers")
        .select("*")
        .eq("user_id", profile.id);

      if (userOffersError) throw userOffersError;

      // Create user offers map
      const userOffersMap = new Map(
        userOffersData?.map((uo) => [uo.offer_id, uo]) || []
      );
      setUserOffers(userOffersMap);

      // Enrich offers with user data
      let enrichedOffers = (offersData || []).map((offer) => 
        enrichOffer(offer, userOffersMap.get(offer.id))
      );

      // Apply category filters
      enrichedOffers = applyCategoryFilter(enrichedOffers, selectedCategory);

      // Sort offers
      enrichedOffers = [...enrichedOffers].sort((a, b) => {
        switch (filters.sortBy) {
          case "discount":
            return b.discount_percentage - a.discount_percentage;
          case "expiry":
            return new Date(a.valid_until).getTime() - new Date(b.valid_until).getTime();
          case "newest":
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          case "popular":
            return (b.restaurant.average_rating || 0) - (a.restaurant.average_rating || 0);
          default:
            return 0;
        }
      });

      setOffers(enrichedOffers);
    } catch (err: any) {
      console.error("Error fetching offers:", err);
      setError(err.message || "Failed to load offers");
    } finally {
      setLoading(false);
    }
  }, [profile?.id, filters, selectedCategory, enrichOffer]);

  // Apply category filters
  const applyCategoryFilter = useCallback((offers: EnrichedOffer[], category: string): EnrichedOffer[] => {
    switch (category) {
      case "trending":
        return offers.filter((o) => o.discount_percentage >= 30);
      case "new":
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return offers.filter((o) => new Date(o.created_at) > weekAgo);
      case "expiring":
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
        return offers.filter((o) => new Date(o.valid_until) < threeDaysFromNow);
      case "claimed":
        return offers.filter((o) => o.claimed);
      case "nearby":
        // TODO: Implement location-based filtering
        return offers;
      default:
        return offers;
    }
  }, []);

  // Sort offers
  const sortOffers = useCallback((offers: EnrichedOffer[], sortBy: string): EnrichedOffer[] => {
    return [...offers].sort((a, b) => {
      switch (sortBy) {
        case "discount":
          return b.discount_percentage - a.discount_percentage;
        case "expiry":
          return new Date(a.valid_until).getTime() - new Date(b.valid_until).getTime();
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "popular":
          return (b.restaurant.average_rating || 0) - (a.restaurant.average_rating || 0);
        default:
          return 0;
      }
    });
  }, []);

  // Claim offer
  const claimOffer = useCallback(async (offerId: string) => {
    if (!profile?.id) return false;

    try {
      const offer = offers.find(o => o.id === offerId);
      if (!offer) throw new Error("Offer not found");

      if (offer.claimed) {
        throw new Error("Offer already claimed");
      }

      // Check if offer is still valid
      const now = new Date();
      const validUntil = new Date(offer.valid_until);
      if (now > validUntil) {
        throw new Error("Offer has expired");
      }

      const claimDate = now.toISOString();
      const expiryDate = calculateExpiryDate(claimDate, offer.valid_until);

      // Insert user offer
      const { data, error } = await supabase
        .from("user_offers")
        .insert({
          user_id: profile.id,
          offer_id: offerId,
          claimed_at: claimDate,
          expires_at: expiryDate.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      const newUserOffer: UserOfferData = {
        id: data.id,
        user_id: profile.id,
        offer_id: offerId,
        claimed_at: claimDate,
        expires_at: expiryDate.toISOString(),
      };

      setUserOffers(prev => new Map(prev.set(offerId, newUserOffer)));
      setOffers(prev => prev.map(o => 
        o.id === offerId ? enrichOffer(o, newUserOffer) : o
      ));

      return true;
    } catch (err: any) {
      console.error("Error claiming offer:", err);
      throw err;
    }
  }, [profile?.id, offers, enrichOffer, calculateExpiryDate]);

  // Use offer (mark as used)
  const useOffer = useCallback(async (offerId: string, bookingId?: string) => {
    if (!profile?.id) return false;

    try {
      const offer = offers.find(o => o.id === offerId);
      if (!offer || !offer.claimed || !offer.redemptionCode) {
        throw new Error("Invalid offer or not claimed");
      }

      if (offer.used) {
        throw new Error("Offer already used");
      }

      if (offer.isExpired) {
        throw new Error("Offer has expired");
      }

      const usedAt = new Date().toISOString();

      const { error } = await supabase
        .from("user_offers")
        .update({ 
          used_at: usedAt,
          booking_id: bookingId || null,
        })
        .eq("id", offer.redemptionCode)
        .eq("user_id", profile.id);

      if (error) throw error;

      // Update local state
      const updatedUserOffer = userOffers.get(offerId);
      if (updatedUserOffer) {
        const newUserOffer = { ...updatedUserOffer, used_at: usedAt, booking_id };
        setUserOffers(prev => new Map(prev.set(offerId, newUserOffer)));
        setOffers(prev => prev.map(o => 
          o.id === offerId ? enrichOffer(o, newUserOffer) : o
        ));
      }

      return true;
    } catch (err: any) {
      console.error("Error using offer:", err);
      throw err;
    }
  }, [profile?.id, offers, userOffers, enrichOffer]);

  // Get user's claimed offers
  const getClaimedOffers = useCallback(() => {
    return offers.filter(offer => offer.claimed);
  }, [offers]);

  // Get active offers (claimed but not used/expired)
  const getActiveOffers = useCallback(() => {
    return offers.filter(offer => offer.canUse);
  }, [offers]);

  // Get expired offers
  const getExpiredOffers = useCallback(() => {
    return offers.filter(offer => offer.claimed && offer.isExpired);
  }, [offers]);

  // Get used offers
  const getUsedOffers = useCallback(() => {
    return offers.filter(offer => offer.used);
  }, [offers]);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<OfferFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Update category
  const updateCategory = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  // Check if offer can be claimed
  const canClaimOffer = useCallback((offer: EnrichedOffer) => {
    if (offer.claimed) return { canClaim: false, reason: "already_claimed" };
    
    const now = new Date();
    const validUntil = new Date(offer.valid_until);
    if (now > validUntil) return { canClaim: false, reason: "expired" };
    
    return { canClaim: true, reason: null };
  }, []);

  // Get offer statistics
  const getOfferStats = useCallback(() => {
    const claimed = getClaimedOffers();
    const active = getActiveOffers();
    const used = getUsedOffers();
    const expired = getExpiredOffers();

    return {
      total: offers.length,
      claimed: claimed.length,
      active: active.length,
      used: used.length,
      expired: expired.length,
      availableToRedeem: offers.filter(o => !o.claimed).length,
    };
  }, [offers, getClaimedOffers, getActiveOffers, getUsedOffers, getExpiredOffers]);

  // Auto-expire old offers
  const expireOldOffers = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const now = new Date().toISOString();
      
      // This would be better as a database function, but for now we can handle it client-side
      const expiredOffers = offers.filter(offer => 
        offer.claimed && !offer.used && offer.expiresAt && new Date(offer.expiresAt) < new Date()
      );

      // Update local state
      if (expiredOffers.length > 0) {
        setOffers(prev => prev.map(offer => 
          expiredOffers.some(exp => exp.id === offer.id)
            ? { ...offer, isExpired: true, canUse: false }
            : offer
        ));
      }

      return expiredOffers.length;
    } catch (err) {
      console.error("Error expiring old offers:", err);
      return 0;
    }
  }, [profile?.id, offers]);

  // Load offers on mount and when dependencies change
  useEffect(() => {
    if (profile) {
      fetchOffers();
    }
  }, [profile, fetchOffers]);

  // Auto-expire offers periodically
  useEffect(() => {
    const interval = setInterval(expireOldOffers, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [expireOldOffers]);

  return {
    // Data
    offers,
    userOffers,
    selectedCategory,
    filters,
    
    // State
    loading,
    error,
    
    // Actions
    fetchOffers,
    claimOffer,
    useOffer,
    updateFilters,
    updateCategory,
    
    // Getters
    getClaimedOffers,
    getActiveOffers,
    getUsedOffers,
    getExpiredOffers,
    getOfferStats,
    
    // Utilities
    canClaimOffer,
    enrichOffer,
    expireOldOffers,
    
    // Constants
    OFFER_CATEGORIES,
  };
}