// app/(protected)/offers.tsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  ScrollView,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Share,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Tag,
  Clock,
  Calendar,
  Users,
  Percent,
  ChevronRight,
  Filter,
  Star,
  MapPin,
  Info,
  Sparkles,
  TrendingUp,
  Gift,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

// 1. Type Definitions with Comprehensive Schema
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type SpecialOffer = Database["public"]["Tables"]["special_offers"]["Row"] & {
  restaurant: Restaurant;
  claimed?: boolean;
  used?: boolean;
};

// 2. Constants and Configuration
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const OFFER_CATEGORIES = [
  { id: "all", label: "All Offers", icon: Sparkles },
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "new", label: "New", icon: Gift },
  { id: "expiring", label: "Ending Soon", icon: Clock },
  { id: "claimed", label: "My Offers", icon: Tag },
];

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// 3. Filter State Interface
interface OfferFilters {
  category: string;
  minDiscount: number;
  cuisineTypes: string[];
  sortBy: "discount" | "expiry" | "newest" | "popular";
}

export default function SpecialOffersScreen() {
  // 4. Core State Management Architecture
  const router = useRouter();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  
  // 4.1 Data States
  const [offers, setOffers] = useState<SpecialOffer[]>([]);
  const [claimedOfferIds, setClaimedOfferIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingOfferId, setProcessingOfferId] = useState<string | null>(null);
  
  // 4.2 Filter and UI States
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<OfferFilters>({
    category: "all",
    minDiscount: 0,
    cuisineTypes: [],
    sortBy: "discount",
  });

  // 5. Data Fetching Implementation
  const fetchOffers = useCallback(async () => {
    if (!profile?.id) return;
    
    try {
      const now = new Date().toISOString();
      
      // 5.1 Fetch active offers with restaurant details
      let query = supabase
        .from("special_offers")
        .select(`
          *,
          restaurant:restaurants (*)
        `)
        .lte("valid_from", now)
        .gte("valid_until", now);
      
      // 5.2 Apply minimum discount filter
      if (filters.minDiscount > 0) {
        query = query.gte("discount_percentage", filters.minDiscount);
      }
      
      const { data: offersData, error: offersError } = await query;
      
      if (offersError) throw offersError;
      
      // 5.3 Fetch user's claimed offers
      const { data: claimedData, error: claimedError } = await supabase
        .from("user_offers")
        .select("offer_id, used_at")
        .eq("user_id", profile.id);
      
      if (claimedError) throw claimedError;
      
      // 5.4 Create claimed offers map
      const claimedMap = new Map(
        claimedData?.map((c) => [c.offer_id, { claimed: true, used: !!c.used_at }]) || []
      );
      
      // 5.5 Merge offer data with claimed status
      const enrichedOffers = (offersData || []).map((offer) => ({
        ...offer,
        claimed: claimedMap.has(offer.id),
        used: claimedMap.get(offer.id)?.used || false,
      }));
      
      // 5.6 Apply cuisine type filter
      let filteredOffers = enrichedOffers;
      if (filters.cuisineTypes.length > 0) {
        filteredOffers = filteredOffers.filter((offer) =>
          filters.cuisineTypes.includes(offer.restaurant.cuisine_type)
        );
      }
      
      // 5.7 Apply category filter
      switch (selectedCategory) {
        case "trending":
          // Mock implementation - would use analytics data
          filteredOffers = filteredOffers.filter((o) => o.discount_percentage >= 30);
          break;
        case "new":
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          filteredOffers = filteredOffers.filter(
            (o) => new Date(o.created_at) > weekAgo
          );
          break;
        case "expiring":
          const threeDaysFromNow = new Date();
          threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
          filteredOffers = filteredOffers.filter(
            (o) => new Date(o.valid_until) < threeDaysFromNow
          );
          break;
        case "claimed":
          filteredOffers = filteredOffers.filter((o) => o.claimed);
          break;
      }
      
      // 5.8 Sort offers
      const sortedOffers = [...filteredOffers].sort((a, b) => {
        switch (filters.sortBy) {
          case "discount":
            return b.discount_percentage - a.discount_percentage;
          case "expiry":
            return new Date(a.valid_until).getTime() - new Date(b.valid_until).getTime();
          case "newest":
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          case "popular":
            // Would use claim count from analytics
            return (b.restaurant.average_rating || 0) - (a.restaurant.average_rating || 0);
          default:
            return 0;
        }
      });
      
      setOffers(sortedOffers);
      setClaimedOfferIds(new Set(claimedData?.map((c) => c.offer_id) || []));
    } catch (error) {
      console.error("Error fetching offers:", error);
      Alert.alert("Error", "Failed to load special offers");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, selectedCategory, filters]);

  // 6. Claim Offer Implementation
  const claimOffer = useCallback(async (offerId: string) => {
    if (!profile?.id) return;
    
    setProcessingOfferId(offerId);
    
    try {
      // 6.1 Check if already claimed
      if (claimedOfferIds.has(offerId)) {
        Alert.alert("Already Claimed", "You have already claimed this offer");
        return;
      }
      
      // 6.2 Create user offer record
      const { error } = await supabase
        .from("user_offers")
        .insert({
          user_id: profile.id,
          offer_id: offerId,
        });
      
      if (error) throw error;
      
      // 6.3 Update local state
      setClaimedOfferIds((prev) => new Set([...prev, offerId]));
      setOffers((prev) =>
        prev.map((offer) =>
          offer.id === offerId ? { ...offer, claimed: true } : offer
        )
      );
      
      // 6.4 Haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        "Offer Claimed!",
        "This offer has been added to your account. Show it at the restaurant to redeem.",
        [{ text: "OK" }]
      );
    } catch (error: any) {
      console.error("Error claiming offer:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to claim offer. Please try again."
      );
    } finally {
      setProcessingOfferId(null);
    }
  }, [profile?.id, claimedOfferIds]);

  // 7. Share Offer Functionality
  const shareOffer = useCallback(async (offer: SpecialOffer) => {
    try {
      await Share.share({
        message: `Check out this ${offer.discount_percentage}% off deal at ${offer.restaurant.name}! 🎉\n\n${offer.title}\n\nValid until ${new Date(offer.valid_until).toLocaleDateString()}`,
        title: `Special Offer: ${offer.title}`,
      });
    } catch (error) {
      console.error("Error sharing offer:", error);
    }
  }, []);

  // 8. Navigation Handlers
  const navigateToRestaurant = useCallback((restaurantId: string, offerId: string) => {
    router.push({
      pathname: "/restaurant/[id]",
      params: { 
        id: restaurantId,
        highlightOfferId: offerId,
      },
    });
  }, [router]);

  const bookWithOffer = useCallback((offer: SpecialOffer) => {
    router.push({
      pathname: "/booking/create",
      params: {
        restaurantId: offer.restaurant_id,
        restaurantName: offer.restaurant.name,
        offerId: offer.id,
        offerTitle: offer.title,
      },
    });
  }, [router]);

  // 9. Lifecycle Management
  useEffect(() => {
    if (profile) {
      fetchOffers();
    }
  }, [profile, fetchOffers]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOffers();
  }, [fetchOffers]);

  // 10. Offer Card Component
  const OfferCard = ({ offer }: { offer: SpecialOffer }) => {
    const daysUntilExpiry = Math.ceil(
      (new Date(offer.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const isExpiringSoon = daysUntilExpiry <= 3;
    
    return (
      <Pressable
        onPress={() => navigateToRestaurant(offer.restaurant_id, offer.id)}
        className="bg-card rounded-xl overflow-hidden mb-4 shadow-sm"
      >
        {/* 10.1 Restaurant Header with Image */}
        <View className="relative">
          <Image
            source={{ uri: offer.restaurant.main_image_url }}
            className="w-full h-40"
            contentFit="cover"
          />
          
          {/* 10.2 Discount Badge */}
          <View className="absolute top-3 left-3 bg-primary rounded-lg px-3 py-2">
            <Text className="text-primary-foreground font-bold text-lg">
              {offer.discount_percentage}% OFF
            </Text>
          </View>
          
          {/* 10.3 Claimed Badge */}
          {offer.claimed && (
            <View className="absolute top-3 right-3 bg-green-500 rounded-lg px-3 py-1">
              <Text className="text-white text-sm font-medium">Claimed</Text>
            </View>
          )}
        </View>
        
        {/* 10.4 Offer Details */}
        <View className="p-4">
          <H3 className="mb-1">{offer.title}</H3>
          <P className="text-muted-foreground mb-3">{offer.restaurant.name}</P>
          
          {offer.description && (
            <P className="text-sm mb-3">{offer.description}</P>
          )}
          
          {/* 10.5 Offer Metadata */}
          <View className="flex-row flex-wrap gap-3 mb-3">
            <View className="flex-row items-center gap-1">
              <Calendar size={14} color="#666" />
              <Text className="text-xs text-muted-foreground">
                Valid until {new Date(offer.valid_until).toLocaleDateString()}
              </Text>
            </View>
            
            {isExpiringSoon && (
              <View className="flex-row items-center gap-1">
                <Clock size={14} color="#ef4444" />
                <Text className="text-xs text-red-600">
                  {daysUntilExpiry === 1 ? "Expires tomorrow" : `${daysUntilExpiry} days left`}
                </Text>
              </View>
            )}
            
            {offer.minimum_party_size > 1 && (
              <View className="flex-row items-center gap-1">
                <Users size={14} color="#666" />
                <Text className="text-xs text-muted-foreground">
                  Min {offer.minimum_party_size} people
                </Text>
              </View>
            )}
          </View>
          
          {/* 10.6 Valid Days */}
          {offer.applicable_days && offer.applicable_days.length < 7 && (
            <View className="mb-3">
              <Text className="text-xs font-medium mb-1">Valid on:</Text>
              <View className="flex-row gap-1">
                {offer.applicable_days.map((day) => (
                  <View
                    key={day}
                    className="bg-muted px-2 py-1 rounded"
                  >
                    <Text className="text-xs">{DAYS_OF_WEEK[day]}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          
          {/* 10.7 Terms & Conditions */}
          {offer.terms_conditions && offer.terms_conditions.length > 0 && (
            <Pressable
              onPress={() => {
                Alert.alert(
                  "Terms & Conditions",
                  offer.terms_conditions.join("\n\n")
                );
              }}
              className="flex-row items-center gap-1 mb-3"
            >
              <Info size={14} color="#666" />
              <Text className="text-xs text-primary">View terms</Text>
            </Pressable>
          )}
          
          {/* 10.8 Restaurant Info */}
          <View className="flex-row items-center justify-between pt-3 border-t border-border">
            <View className="flex-row items-center gap-3">
              <View className="flex-row items-center gap-1">
                <Star size={14} color="#f59e0b" fill="#f59e0b" />
                <Text className="text-sm font-medium">
                  {offer.restaurant.average_rating?.toFixed(1) || "N/A"}
                </Text>
              </View>
              
              <Text className="text-sm text-muted-foreground">
                {offer.restaurant.cuisine_type}
              </Text>
              
              <View className="flex-row items-center gap-1">
                <MapPin size={14} color="#666" />
                <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                  {offer.restaurant.address.split(",")[0]}
                </Text>
              </View>
            </View>
            
            <ChevronRight size={20} color="#666" />
          </View>
          
          {/* 10.9 Action Buttons */}
          <View className="flex-row gap-2 mt-4">
            {!offer.claimed ? (
              <Button
                variant="default"
                size="sm"
                onPress={(e) => {
                  e.stopPropagation();
                  claimOffer(offer.id);
                }}
                disabled={processingOfferId === offer.id}
                className="flex-1"
              >
                {processingOfferId === offer.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Tag size={16} />
                    <Text>Claim Offer</Text>
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onPress={(e) => {
                  e.stopPropagation();
                  bookWithOffer(offer);
                }}
                className="flex-1"
              >
                <Calendar size={16} />
                <Text>Book Now</Text>
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onPress={(e) => {
                e.stopPropagation();
                shareOffer(offer);
              }}
              className="px-3"
            >
              <Share2 size={16} />
            </Button>
          </View>
        </View>
      </Pressable>
    );
  };

  // 11. Category Tabs Component
  const CategoryTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-4"
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
    >
      {OFFER_CATEGORIES.map((category) => {
        const Icon = category.icon;
        const isActive = selectedCategory === category.id;
        
        return (
          <Pressable
            key={category.id}
            onPress={() => {
              setSelectedCategory(category.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className={`flex-row items-center gap-2 px-4 py-2 rounded-full ${
              isActive ? "bg-primary" : "bg-muted"
            }`}
          >
            <Icon
              size={16}
              color={isActive ? "#fff" : colorScheme === "dark" ? "#fff" : "#000"}
            />
            <Text
              className={`font-medium ${
                isActive ? "text-primary-foreground" : ""
              }`}
            >
              {category.label}
            </Text>
            {category.id === "claimed" && claimedOfferIds.size > 0 && (
              <View
                className={`px-2 py-0.5 rounded-full ${
                  isActive ? "bg-white/20" : "bg-primary"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    isActive ? "text-white" : "text-primary-foreground"
                  }`}
                >
                  {claimedOfferIds.size}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );

  // 12. Empty State Component
  const EmptyState = () => {
    const emptyMessages: Record<string, { title: string; subtitle: string }> = {
      all: {
        title: "No Offers Available",
        subtitle: "Check back soon for special deals from your favorite restaurants",
      },
      trending: {
        title: "No Trending Offers",
        subtitle: "Popular offers will appear here",
      },
      new: {
        title: "No New Offers",
        subtitle: "We'll notify you when new offers are added",
      },
      expiring: {
        title: "No Expiring Offers",
        subtitle: "All offers have plenty of time left",
      },
      claimed: {
        title: "No Claimed Offers",
        subtitle: "Browse available offers and claim your favorites",
      },
    };
    
    const message = emptyMessages[selectedCategory] || emptyMessages.all;
    
    return (
      <View className="flex-1 items-center justify-center py-20">
        <Gift size={64} color="#666" strokeWidth={1} />
        <H3 className="mt-4 text-center">{message.title}</H3>
        <Muted className="mt-2 text-center px-8">{message.subtitle}</Muted>
        {selectedCategory === "claimed" && (
          <Button
            variant="default"
            className="mt-6"
            onPress={() => setSelectedCategory("all")}
          >
            <Text>Browse Offers</Text>
          </Button>
        )}
      </View>
    );
  };

  // 13. Loading State
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
        </View>
      </SafeAreaView>
    );
  }

  // 14. Main Render
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* 14.1 Header */}
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <View>
          <H2>Special Offers</H2>
          <Muted className="text-sm">
            {offers.length} {offers.length === 1 ? "offer" : "offers"} available
          </Muted>
        </View>
        <Pressable
          onPress={() => setShowFilters(!showFilters)}
          className="p-2"
        >
          <Filter size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
        </Pressable>
      </View>
      
      {/* 14.2 Category Tabs */}
      <CategoryTabs />
      
      {/* 14.3 Offers List */}
      <FlatList
        data={offers}
        renderItem={({ item }) => <OfferCard offer={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ 
          padding: 16,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colorScheme === "dark" ? "#fff" : "#000"}
          />
        }
        ListEmptyComponent={<EmptyState />}
      />
    </SafeAreaView>
  );
}