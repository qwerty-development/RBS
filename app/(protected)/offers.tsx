// app/(protected)/offers.tsx
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Share,
  Dimensions,
  Modal,
  ScrollView,
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
  Share2,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Slider from '@react-native-community/slider'; // Assuming you have this for the filter sheet
import { useSafeAreaInsets } from "react-native-safe-area-context"; // <-- For safe area

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

// --- (Your Type Definitions, Constants, and Filter State remain the same) ---
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
  { id: "all", label: "All", icon: Sparkles },
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
  // --- (Your Core State Management, Data Fetching, Claim/Share/Navigation logic remains the same) ---
  const router = useRouter();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  
  // States
  const [offers, setOffers] = useState<SpecialOffer[]>([]);
  const [claimedOfferIds, setClaimedOfferIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingOfferId, setProcessingOfferId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<OfferFilters>({
    category: "all",
    minDiscount: 0,
    cuisineTypes: [],
    sortBy: "discount",
  });

  // Your Data Fetching & Business Logic (fetchOffers, claimOffer, etc.)
  // This logic is solid, so we keep it as is.
  const fetchOffers = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const now = new Date().toISOString();
      let query = supabase.from("special_offers").select(`*, restaurant:restaurants (*)`).lte("valid_from", now).gte("valid_until", now);
      if (filters.minDiscount > 0) { query = query.gte("discount_percentage", filters.minDiscount); }
      const { data: offersData, error: offersError } = await query;
      if (offersError) throw offersError;
      const { data: claimedData, error: claimedError } = await supabase.from("user_offers").select("offer_id, used_at").eq("user_id", profile.id);
      if (claimedError) throw claimedError;
      const claimedMap = new Map(claimedData?.map((c) => [c.offer_id, { claimed: true, used: !!c.used_at }]) || []);
      const enrichedOffers = (offersData || []).map((offer) => ({ ...offer, claimed: claimedMap.has(offer.id), used: claimedMap.get(offer.id)?.used || false }));
      let filteredOffers = enrichedOffers;
      if (filters.cuisineTypes.length > 0) { filteredOffers = filteredOffers.filter((offer) => filters.cuisineTypes.includes(offer.restaurant.cuisine_type)); }
      switch (selectedCategory) {
        case "trending": filteredOffers = filteredOffers.filter((o) => o.discount_percentage >= 30); break;
        case "new": const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7); filteredOffers = filteredOffers.filter((o) => new Date(o.created_at) > weekAgo); break;
        case "expiring": const threeDaysFromNow = new Date(); threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3); filteredOffers = filteredOffers.filter((o) => new Date(o.valid_until) < threeDaysFromNow); break;
        case "claimed": filteredOffers = filteredOffers.filter((o) => o.claimed); break;
      }
      const sortedOffers = [...filteredOffers].sort((a, b) => {
        switch (filters.sortBy) {
          case "discount": return b.discount_percentage - a.discount_percentage;
          case "expiry": return new Date(a.valid_until).getTime() - new Date(b.valid_until).getTime();
          case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          case "popular": return (b.restaurant.average_rating || 0) - (a.restaurant.average_rating || 0);
          default: return 0;
        }
      });
      setOffers(sortedOffers);
      setClaimedOfferIds(new Set(claimedData?.map((c) => c.offer_id) || []));
    } catch (error) { console.error("Error fetching offers:", error); Alert.alert("Error", "Failed to load special offers");
    } finally { setLoading(false); setRefreshing(false); }
  }, [profile?.id, selectedCategory, filters]);
  const claimOffer = useCallback(async (offerId: string) => { if (!profile?.id) return; setProcessingOfferId(offerId); try { if (claimedOfferIds.has(offerId)) { Alert.alert("Already Claimed", "You have already claimed this offer"); return; } const { error } = await supabase.from("user_offers").insert({ user_id: profile.id, offer_id: offerId }); if (error) throw error; setClaimedOfferIds((prev) => new Set([...prev, offerId])); setOffers((prev) => prev.map((offer) => offer.id === offerId ? { ...offer, claimed: true } : offer)); await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); Alert.alert("Offer Claimed!", "This offer has been added to your account. Show it at the restaurant to redeem.", [{ text: "OK" }]); } catch (error: any) { console.error("Error claiming offer:", error); Alert.alert("Error", error.message || "Failed to claim offer. Please try again."); } finally { setProcessingOfferId(null); } }, [profile?.id, claimedOfferIds]);
  const shareOffer = useCallback(async (offer: SpecialOffer) => { try { await Share.share({ message: `Check out this ${offer.discount_percentage}% off deal at ${offer.restaurant.name}! 🎉\n\n${offer.title}\n\nValid until ${new Date(offer.valid_until).toLocaleDateString()}`, title: `Special Offer: ${offer.title}` }); } catch (error) { console.error("Error sharing offer:", error); } }, []);
  const navigateToRestaurant = useCallback((restaurantId: string, offerId: string) => { router.push({ pathname: "/restaurant/[id]", params: { id: restaurantId, highlightOfferId: offerId } }); }, [router]);
  const bookWithOffer = useCallback((offer: SpecialOffer) => { router.push({ pathname: "/booking/create", params: { restaurantId: offer.restaurant_id, restaurantName: offer.restaurant.name, offerId: offer.id, offerTitle: offer.title } }); }, [router]);
  useEffect(() => { if (profile) { fetchOffers(); } }, [profile, fetchOffers]);
  const handleRefresh = useCallback(() => { setRefreshing(true); fetchOffers(); }, [fetchOffers]);
  const handleApplyFilters = useCallback((newFilters: OfferFilters) => { setFilters(newFilters); setShowFilters(false); }, []);

  // ====================================================================
  // 1. SLEEK REDESIGNED OFFER CARD
  // ====================================================================
  const OfferCard = ({ offer }: { offer: SpecialOffer }) => {
    return (
      <Pressable
        onPress={() => navigateToRestaurant(offer.restaurant_id, offer.id)}
        className="bg-card border border-gray-200 rounded-2xl overflow-hidden mb-6 shadow-lg shadow-black/5"
      >
        {/* Restaurant Image */}
        <View className="relative">
          <Image source={{ uri: offer.restaurant.main_image_url }} className="w-full h-44" contentFit="cover" />
        </View>

        {/* Offer Details */}
        <View className="p-4">
            {/* Discount Badge - Overlapping */}
            <View className="absolute -top-8 right-4 bg-primary h-16 w-16 rounded-full items-center justify-center border-4 border-card">
              <Text className="text-primary-foreground font-extrabold text-2xl">{offer.discount_percentage}</Text>
              <Text className="text-primary-foreground font-bold text-xs -mt-1">%</Text>
            </View>

          {/* Restaurant Info */}
          <Pressable onPress={() => router.push(`/restaurant/${offer.restaurant_id}`)} className="flex-row items-center mb-3 mt-1">
                <Text className="font-bold text-2xl">{offer.restaurant.name}</Text>
          </Pressable>

          <Text className="mb-2 text-l w-4/5">{offer.title}</Text>
          {offer.description && <P className="text-sm text-muted-foreground mb-4" numberOfLines={2}>{offer.description}</P>}

          {/* Metadata Chips */}
          <View className="flex-row flex-wrap mb-4">
              <View className="flex-row items-center bg-muted/50 rounded-full px-3 py-1 mr-2 mb-2">
                <Calendar size={14} color={colorScheme === 'dark' ? '#a1a1aa' : '#3f3f46'} />
                <Text className="text-xs text-muted-foreground ml-1.5">Ends {new Date(offer.valid_until).toLocaleDateString()}</Text>
              </View>
              {offer.minimum_party_size > 1 && (
                <View className="flex-row items-center bg-muted/50 rounded-full px-3 py-1 mr-2 mb-2">
                  <Users size={14} color={colorScheme === 'dark' ? '#a1a1aa' : '#3f3f46'} />
                  <Text className="text-xs text-muted-foreground ml-1.5">{offer.minimum_party_size}+ People</Text>
                </View>
              )}
          </View>
          
          {/* Action Buttons */}
          <View className="flex-row mt-2 gap-3">
            {!offer.claimed ? (
              <Button variant="default" onPress={(e) => { e.stopPropagation(); claimOffer(offer.id); }} disabled={processingOfferId === offer.id} className="flex-1 h-12">
                {processingOfferId === offer.id ? <ActivityIndicator size="small" color="#fff" /> : <><Tag size={18} className="mr-2" /><Text className="font-bold text-base">Claim Offer</Text></>}
              </Button>
            ) : (
              <Button variant="default" onPress={(e) => { e.stopPropagation(); bookWithOffer(offer); }} className="flex-1 h-12  active:bg-green-700">
                <Calendar size={18} className="mr-2" /><Text className="font-bold text-base">Book with Offer</Text>
              </Button>
            )}
            <Button variant="outline" onPress={(e) => { e.stopPropagation(); shareOffer(offer); }} className="w-12 h-12">
              <Share2 size={18} />
            </Button>
          </View>
        </View>
      </Pressable>
    );
  };
  
  // ====================================================================
  // 2. MODERN UNDERLINE CATEGORY TABS
  // ====================================================================
  const CategoryTabs = () => (
    <View className="bg-background">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {OFFER_CATEGORIES.map((category) => {
          const isActive = selectedCategory === category.id;
          return (
            <Pressable
              key={category.id}
              onPress={() => { setSelectedCategory(category.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              className={`flex-row items-center py-3 px-4 border-b-2 ${ isActive ? "border-primary" : "border-transparent" }`}
            >
              <Text className={`font-semibold text-base ${ isActive ? "text-primary" : "text-muted-foreground" }`}>
                {category.label}
              </Text>
              {category.id === "claimed" && claimedOfferIds.size > 0 && (
                <View className="px-2 py-0.5 rounded-full ml-2 bg-primary">
                  <Text className="text-xs font-medium text-primary-foreground">{claimedOfferIds.size}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const EmptyState = () => {/* ... same as before ... */};

  // ====================================================================
  // 3. SLEEK FILTER BOTTOM SHEET
  // ====================================================================
  const FilterSheet = ({ isVisible, onClose, onApply, currentFilters }: { isVisible: boolean, onClose: () => void, onApply: (f: OfferFilters) => void, currentFilters: OfferFilters }) => {
    const [localFilters, setLocalFilters] = useState(currentFilters);
    const Cuisines = ["Italian", "Lebanese", "Japanese", "Indian", "French", "American"]; // Example cuisines

    useEffect(() => { setLocalFilters(currentFilters) }, [currentFilters]);

    const toggleCuisine = (cuisine: string) => {
        setLocalFilters(prev => {
            const newCuisines = new Set(prev.cuisineTypes);
            if (newCuisines.has(cuisine)) {
                newCuisines.delete(cuisine);
            } else {
                newCuisines.add(cuisine);
            }
            return { ...prev, cuisineTypes: Array.from(newCuisines) };
        });
    }

    return(
        <Modal
            animationType="slide"
            transparent={true}
            visible={isVisible}
            onRequestClose={onClose}
        >
            <Pressable onPress={onClose} className="flex-1 bg-black/50 justify-end">
                <Pressable className="bg-card rounded-t-2xl p-6" style={{paddingBottom: insets.bottom + 24 }}>
                    <View className="flex-row justify-between items-center mb-6">
                        <H3>Filters</H3>
                        <Pressable onPress={onClose} className="p-1"><X size={24} color={colorScheme === 'dark' ? '#fff' : '#000'} /></Pressable>
                    </View>

                    {/* Sort By */}
                    <Text className="font-semibold mb-3">Sort By</Text>
                    <View className="flex-row justify-between mb-6">
                       {['discount', 'popular', 'newest', 'expiry'].map(type => (
                           <Button key={type} variant={localFilters.sortBy === type ? 'default' : 'outline'} onPress={() => setLocalFilters(f => ({...f, sortBy: type as any}))} className="px-3">
                               <Text className="capitalize">{type}</Text>
                           </Button>
                       ))}
                    </View>

                    {/* Minimum Discount */}
                    <Text className="font-semibold mb-2">Minimum Discount: {localFilters.minDiscount}%</Text>
                    <Slider
                        style={{ width: '100%', height: 40 }}
                        minimumValue={0}
                        maximumValue={50}
                        step={5}
                        value={localFilters.minDiscount}
                        onValueChange={val => setLocalFilters(f => ({...f, minDiscount: val}))}
                        minimumTrackTintColor={colorScheme === 'dark' ? '#3b82f6' : '#2563eb'}
                        maximumTrackTintColor={colorScheme === 'dark' ? '#4b5563' : '#d1d5db'}
                        thumbTintColor={colorScheme === 'dark' ? '#3b82f6' : '#2563eb'}
                    />
                    
                    {/* Cuisine Types */}
                    <Text className="font-semibold mb-3 mt-4">Cuisine</Text>
                    <View className="flex-row flex-wrap">
                        {Cuisines.map(cuisine => (
                            <Button key={cuisine} variant={localFilters.cuisineTypes.includes(cuisine) ? 'default' : 'outline'} onPress={() => toggleCuisine(cuisine)} className="mr-2 mb-2">
                                <Text>{cuisine}</Text>
                            </Button>
                        ))}
                    </View>

                    {/* Apply Button */}
                    <Button onPress={() => onApply(localFilters)} size="lg" className="mt-8">
                        <Text className="font-bold text-lg">Apply Filters</Text>
                    </Button>
                </Pressable>
            </Pressable>
        </Modal>
    )
  }

  if (loading) { 
    return (
      <SafeAreaView className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-muted-foreground">Loading offers...</Text>
      </SafeAreaView>
    );
  }

  // ====================================================================
  // 4. MAIN RENDER WITH STATIC HEADER
  // ====================================================================
  return (
    <SafeAreaView className="flex-1 bg-background" edges={[]}>
      {/* Static Header */}
      <View 
        style={{ paddingTop: insets.top }}
        className="bg-background border-b border-border/50"
      >
        {/* Header Content */}
        <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <H2>Special Offers</H2>
            <Muted>{offers.length} deals available</Muted>
          </View>
          <Pressable onPress={() => setShowFilters(true)} className="p-2">
            <Filter size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
          </Pressable>
        </View>
        
        {/* Category Tabs */}
        <CategoryTabs />
      </View>

      {/* Content */}
      <FlatList
        data={offers}
        renderItem={({ item }) => <OfferCard offer={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ 
          paddingHorizontal: 16,
          paddingTop: 16,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colorScheme === 'dark' ? '#fff' : '#000'}
          />
        }
      />

      <FilterSheet 
        isVisible={showFilters} 
        onClose={() => setShowFilters(false)}
        currentFilters={filters}
        onApply={handleApplyFilters}
      />
    </SafeAreaView>
  );
}