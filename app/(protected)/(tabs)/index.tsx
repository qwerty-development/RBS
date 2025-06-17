import React, { useEffect, useState, useCallback, useRef } from "react";
import {
	ScrollView,
	View,
	RefreshControl,
	ActivityIndicator,
	Pressable,
	FlatList,
	Alert,
	Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { 
	MapPin, 
	ChevronRight, 
	Trophy, 
	Sparkles, 
	TrendingUp,
	Clock,
	Star,
	DollarSign,
	Calendar,
	Users,
	Award,
	Zap,
	Heart,
	Search,
	Filter
} from "lucide-react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Type definitions for strict type safety
interface Restaurant {
	id: string;
	name: string;
	cuisine_type: string;
	main_image_url: string;
	tags: string[];
	average_rating: number;
	total_reviews: number;
	address: string;
	price_range: number;
	booking_policy: 'instant' | 'request';
	created_at?: string;
	featured?: boolean;
}

interface SpecialOffer {
	id: string;
	title: string;
	description: string;
	discount_percentage: number;
	restaurant: Restaurant;
	valid_until: string;
}

interface LocationData {
	latitude?: number;
	longitude?: number;
	city: string;
	district: string;
}

interface QuickFilter {
	id: string;
	label: string;
	icon: any;
	color: string;
	params: Record<string, string>;
}

const QUICK_FILTERS: QuickFilter[] = [
	{
		id: "instant_book",
		label: "Instant Book",
		icon: Zap,
		color: "#10b981",
		params: { bookingPolicy: "instant" }
	},
	{
		id: "top_rated",
		label: "Top Rated",
		icon: Star,
		color: "#f59e0b",
		params: { minRating: "4.5" }
	},
	{
		id: "fine_dining",
		label: "Fine Dining",
		icon: Award,
		color: "#8b5cf6",
		params: { priceRange: "4" }
	},
	{
		id: "outdoor",
		label: "Outdoor",
		icon: MapPin,
		color: "#06b6d4",
		params: { feature: "outdoor_seating" }
	},
	{
		id: "trending",
		label: "Trending",
		icon: TrendingUp,
		color: "#ef4444",
		params: { trending: "true" }
	}
];

const CUISINE_CATEGORIES = [
	{ id: "lebanese", label: "Lebanese", emoji: "🥙", popular: true },
	{ id: "italian", label: "Italian", emoji: "🍝", popular: true },
	{ id: "japanese", label: "Japanese", emoji: "🍣", popular: true },
	{ id: "french", label: "French", emoji: "🥐" },
	{ id: "chinese", label: "Chinese", emoji: "🥢" },
	{ id: "indian", label: "Indian", emoji: "🍛" },
	{ id: "mexican", label: "Mexican", emoji: "🌮" },
	{ id: "seafood", label: "Seafood", emoji: "🦞" },
];

export default function HomeScreen() {
	// 1. State Management
	const { profile } = useAuth();
	const { colorScheme } = useColorScheme();
	const router = useRouter();
	
	// 2. Core data states
	const [featuredRestaurants, setFeaturedRestaurants] = useState<Restaurant[]>([]);
	const [newRestaurants, setNewRestaurants] = useState<Restaurant[]>([]);
	const [topRatedRestaurants, setTopRatedRestaurants] = useState<Restaurant[]>([]);
	const [trendingRestaurants, setTrendingRestaurants] = useState<Restaurant[]>([]);
	const [specialOffers, setSpecialOffers] = useState<SpecialOffer[]>([]);
	const [nearbyRestaurants, setNearbyRestaurants] = useState<Restaurant[]>([]);
	const [location, setLocation] = useState<LocationData | null>(null);
	
	// 3. UI state management
	const [refreshing, setRefreshing] = useState(false);
	const [loading, setLoading] = useState(true);
	const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
	
	// 4. Performance optimization refs
	const scrollViewRef = useRef<ScrollView>(null);
	const hasInitialLoad = useRef(false);

	// 5. Load Location from Storage or GPS
	const loadLocation = useCallback(async () => {
		try {
			const savedLocation = await AsyncStorage.getItem("@selected_location");
			
			if (savedLocation) {
				const parsedLocation = JSON.parse(savedLocation);
				console.log("Using saved location:", parsedLocation);
				setLocation(parsedLocation);
				return;
			}

			const { status } = await Location.requestForegroundPermissionsAsync();
			
			if (status !== "granted") {
				setLocationPermissionDenied(true);
				const defaultLocation = {
					city: "Beirut",
					district: "Central District",
				};
				setLocation(defaultLocation);
				return;
			}

			const locationData = await Location.getCurrentPositionAsync({
				accuracy: Location.Accuracy.Balanced,
			});

			const [address] = await Location.reverseGeocodeAsync({
				latitude: locationData.coords.latitude,
				longitude: locationData.coords.longitude,
			});

			const gpsLocation = {
				latitude: locationData.coords.latitude,
				longitude: locationData.coords.longitude,
				city: address.city || "Beirut",
				district: address.district || address.subregion || "Central District",
			};

			console.log("Using GPS location:", gpsLocation);
			setLocation(gpsLocation);

		} catch (error) {
			console.error("Location error:", error);
			const fallbackLocation = {
				city: "Beirut",
				district: "Central District",
			};
			setLocation(fallbackLocation);
		}
	}, []);

	// 6. Listen for location changes
	const checkForLocationUpdates = useCallback(async () => {
		try {
			const savedLocation = await AsyncStorage.getItem("@selected_location");
			if (savedLocation) {
				const parsedLocation = JSON.parse(savedLocation);
				
				if (!location || 
					location.city !== parsedLocation.city || 
					location.district !== parsedLocation.district) {
					console.log("Location updated:", parsedLocation);
					setLocation(parsedLocation);
				}
			}
		} catch (error) {
			console.error("Error checking for location updates:", error);
		}
	}, [location]);

	// 7. Data Fetching Functions
	const fetchFeaturedRestaurants = useCallback(async () => {
		try {
			const { data, error } = await supabase
				.from("restaurants")
				.select("*")
				.eq("featured", true)
				.gte("average_rating", 4.0)
				.order("average_rating", { ascending: false })
				.limit(8);

			if (error) throw error;
			setFeaturedRestaurants(data || []);
		} catch (error) {
			console.error("Error fetching featured restaurants:", error);
		}
	}, []);

	const fetchNewRestaurants = useCallback(async () => {
		try {
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

			const { data, error } = await supabase
				.from("restaurants")
				.select("*")
				.gte("created_at", thirtyDaysAgo.toISOString())
				.order("created_at", { ascending: false })
				.limit(6);

			if (error) throw error;
			setNewRestaurants(data || []);
		} catch (error) {
			console.error("Error fetching new restaurants:", error);
		}
	}, []);

	const fetchTopRatedRestaurants = useCallback(async () => {
		try {
			const { data, error } = await supabase
				.from("restaurants")
				.select("*")
				.gte("average_rating", 4.5)
				.gte("total_reviews", 10)
				.order("average_rating", { ascending: false })
				.order("total_reviews", { ascending: false })
				.limit(6);

			if (error) throw error;
			setTopRatedRestaurants(data || []);
		} catch (error) {
			console.error("Error fetching top rated restaurants:", error);
		}
	}, []);

	const fetchTrendingRestaurants = useCallback(async () => {
		try {
			// Simulate trending by combining recent bookings and high ratings
			const { data, error } = await supabase
				.from("restaurants")
				.select("*")
				.gte("average_rating", 4.0)
				.gte("total_reviews", 5)
				.order("total_reviews", { ascending: false })
				.limit(6);

			if (error) throw error;
			setTrendingRestaurants(data || []);
		} catch (error) {
			console.error("Error fetching trending restaurants:", error);
		}
	}, []);

	const fetchNearbyRestaurants = useCallback(async () => {
		try {
			// For now, fetch restaurants without location filtering
			// In production, this would use PostGIS distance queries
			const { data, error } = await supabase
				.from("restaurants")
				.select("*")
				.order("average_rating", { ascending: false })
				.limit(6);

			if (error) throw error;
			setNearbyRestaurants(data || []);
		} catch (error) {
			console.error("Error fetching nearby restaurants:", error);
		}
	}, [location]);

	const fetchSpecialOffers = useCallback(async () => {
		try {
			const now = new Date().toISOString();
			const { data, error } = await supabase
				.from("special_offers")
				.select(`
					*,
					restaurant:restaurants (*)
				`)
				.lte("valid_from", now)
				.gte("valid_until", now)
				.order("discount_percentage", { ascending: false })
				.limit(5);

			if (error) throw error;
			
			const validOffers = (data || []).filter((offer) => {
				return offer.restaurant && offer.restaurant.id;
			});
			
			setSpecialOffers(validOffers);
		} catch (error) {
			console.error("Error fetching special offers:", error);
		}
	}, []);

	// 8. Unified Data Loading Function
	const loadAllData = useCallback(async () => {
		setLoading(true);
		
		await Promise.all([
			fetchFeaturedRestaurants(),
			fetchNewRestaurants(),
			fetchTopRatedRestaurants(),
			fetchTrendingRestaurants(),
			fetchNearbyRestaurants(),
			fetchSpecialOffers(),
		]);
		
		setLoading(false);
	}, [
		fetchFeaturedRestaurants,
		fetchNewRestaurants,
		fetchTopRatedRestaurants,
		fetchTrendingRestaurants,
		fetchNearbyRestaurants,
		fetchSpecialOffers
	]);

	// 9. Lifecycle Management
	useEffect(() => {
		const initializeHome = async () => {
			if (!hasInitialLoad.current) {
				await loadLocation();
				hasInitialLoad.current = true;
			}
		};

		initializeHome();
	}, [loadLocation]);

	useEffect(() => {
		if (location && profile) {
			loadAllData();
		}
	}, [location, profile, loadAllData]);

	useEffect(() => {
		const unsubscribe = router.addListener?.('focus', () => {
			checkForLocationUpdates();
		});

		return unsubscribe;
	}, [router, checkForLocationUpdates]);

	// 10. User Interaction Handlers
	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		await checkForLocationUpdates();
		await loadAllData();
		setRefreshing(false);
	}, [loadAllData, checkForLocationUpdates]);

	const handleLocationPress = useCallback(() => {
		router.push("/location-selector");
	}, [router]);

	const handleRestaurantPress = useCallback((restaurantId: string) => {
		if (!restaurantId || typeof restaurantId !== 'string' || restaurantId.trim() === '') {
			console.error('Invalid restaurant ID provided:', restaurantId);
			Alert.alert('Error', 'Restaurant information is not available. Please try again.');
			return;
		}

		try {
			router.push({
				pathname: "/restaurant/[id]",
				params: { id: restaurantId.trim() },
			});
		} catch (error) {
			console.error('Navigation error:', error);
			Alert.alert('Error', 'Unable to open restaurant details. Please try again.');
		}
	}, [router]);

	const handleQuickFilter = useCallback((filter: QuickFilter) => {
		router.push({
			pathname: "/search",
			params: filter.params,
		});
	}, [router]);

	const handleCuisinePress = useCallback((cuisine: string) => {
		router.push({
			pathname: "/search",
			params: { cuisine },
		});
	}, [router]);

	const handleOfferPress = useCallback((offer: SpecialOffer) => {
		if (!offer?.restaurant?.id) {
			console.error('Invalid offer or restaurant data:', offer);
			Alert.alert('Error', 'Offer information is not available. Please try again.');
			return;
		}

		try {
			router.push({
				pathname: "/restaurant/[id]",
				params: { 
					id: offer.restaurant.id,
					highlightOfferId: offer.id,
				},
			});
		} catch (error) {
			console.error('Offer navigation error:', error);
			Alert.alert('Error', 'Unable to open restaurant details. Please try again.');
		}
	}, [router]);

	// 11. Time-based Greeting Logic
	const getGreeting = useCallback(() => {
		const hour = new Date().getHours();
		if (hour < 12) return "Good Morning";
		if (hour < 18) return "Good Afternoon";
		return "Good Evening";
	}, []);

	// 12. Component Render Functions
	const renderRestaurantCard = ({ item, variant = "default" }: { item: Restaurant; variant?: "default" | "compact" | "featured" }) => {
		if (!item || !item.id) {
			console.warn('Invalid restaurant item:', item);
			return null;
		}

		if (variant === "compact") {
			return (
				<Pressable
					onPress={() => handleRestaurantPress(item.id)}
					className="mr-3 w-64"
				>
					<View className="bg-card rounded-xl overflow-hidden shadow-sm">
						<Image
							source={{ uri: item.main_image_url }}
							className="w-full h-32"
							contentFit="cover"
						/>
						<View className="p-3">
							<Text className="font-semibold text-sm mb-1" numberOfLines={1}>
								{item.name}
							</Text>
							<Text className="text-xs text-muted-foreground mb-2" numberOfLines={1}>
								{item.cuisine_type}
							</Text>
							<View className="flex-row items-center justify-between">
								<View className="flex-row items-center gap-1">
									<Star size={12} color="#f59e0b" fill="#f59e0b" />
									<Text className="text-xs font-medium">{item.average_rating?.toFixed(1) || "N/A"}</Text>
								</View>
								<Text className="text-xs text-muted-foreground">
									{"$".repeat(item.price_range || 1)}
								</Text>
							</View>
						</View>
					</View>
				</Pressable>
			);
		}

		return (
			<Pressable
				onPress={() => handleRestaurantPress(item.id)}
				className="mr-4 w-72"
			>
				<View className="bg-card rounded-xl overflow-hidden shadow-sm">
					<Image
						source={{ uri: item.main_image_url }}
						className="w-full h-48"
						contentFit="cover"
					/>
					{variant === "featured" && (
						<View className="absolute top-3 left-3 bg-primary px-2 py-1 rounded-full">
							<Text className="text-xs text-primary-foreground font-medium">Featured</Text>
						</View>
					)}
					<View className="p-4">
						<H3 className="mb-1">{item.name}</H3>
						<P className="text-muted-foreground mb-2">{item.cuisine_type}</P>
						<View className="flex-row items-center justify-between">
							<View className="flex-row items-center gap-1">
								<Star size={16} color="#f59e0b" fill="#f59e0b" />
								<Text className="font-medium">{item.average_rating?.toFixed(1) || "N/A"}</Text>
								<Text className="text-muted-foreground">({item.total_reviews || 0})</Text>
							</View>
							<Text className="text-muted-foreground">
								{"$".repeat(item.price_range || 1)}
							</Text>
						</View>
						{item.tags && item.tags.length > 0 && (
							<View className="flex-row gap-2 mt-2">
								{item.tags.slice(0, 2).map((tag) => (
									<View
										key={tag}
										className="bg-muted px-2 py-1 rounded-full"
									>
										<Text className="text-xs">{tag}</Text>
									</View>
								))}
							</View>
						)}
					</View>
				</View>
			</Pressable>
		);
	};

	const renderSectionHeader = (title: string, subtitle: string, actionLabel?: string, onAction?: () => void) => (
		<View className="px-4 mb-3 flex-row items-center justify-between">
			<View>
				<H3>{title}</H3>
				<Muted className="text-sm">{subtitle}</Muted>
			</View>
			{actionLabel && onAction && (
				<Pressable onPress={onAction}>
					<Text className="text-primary text-sm">{actionLabel}</Text>
				</Pressable>
			)}
		</View>
	);

	// 13. Loading State Component
	if (loading) {
		return (
			<View className="flex-1 items-center justify-center bg-background">
				<ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
				<Muted className="mt-4">Loading your personalized experience...</Muted>
			</View>
		);
	}

	// 14. Main Render
	return (
		<ScrollView
			ref={scrollViewRef}
			className="flex-1 bg-background"
			showsVerticalScrollIndicator={false}
			refreshControl={
				<RefreshControl
					refreshing={refreshing}
					onRefresh={handleRefresh}
					tintColor={colorScheme === "dark" ? "#fff" : "#000"}
				/>
			}
		>
			{/* Header Section with Location */}
			<View className="px-4 pt-12 pb-4">
				{/* <H2>{getGreeting()}, {profile?.full_name?.split(" ")[0] || "User"}!</H2> */}
				<Pressable
					onPress={handleLocationPress}
					className="flex-row items-center gap-2 mt-2"
				>
					<MapPin size={16} color="#666" />
					<Text className="text-muted-foreground">
						{location?.district || "Unknown"}, {location?.city || "Unknown"}
					</Text>
					<ChevronRight size={16} color="#666" />
				</Pressable>
			</View>

			<View className="mb-6">
        <View className="px-4 mb-3">
          <H3>Explore Cuisines</H3>
          <Muted className="text-sm">What are you craving today?</Muted>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          className="pl-4"
        >
          <View className="flex-row gap-3 pr-4">
            {CUISINE_CATEGORIES.map((cuisine) => (
              <Pressable
                key={cuisine.id}
                onPress={() => handleCuisinePress(cuisine.id)}
                className="items-center"
              >
                <View className="w-16 h-16 bg-muted rounded-full items-center justify-center mb-2">
                  <Text className="text-3xl">{cuisine.emoji}</Text>
                </View>
                <Text className="text-sm font-medium">{cuisine.label}</Text>
                
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>



			{/* Special Offers Banner */}
			{specialOffers.length > 0 && (
				<View className="mb-6">
					{renderSectionHeader(
						"Special Offers", 
						"Limited time deals", 
						"View All", 
						() => router.push("/offers")
					)}
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{ paddingHorizontal: 16 }}
					>
						{specialOffers.map((offer) => (
							<Pressable
								key={offer.id}
								onPress={() => handleOfferPress(offer)}
								className="mr-3 w-72"
							>
								<View className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 rounded-lg p-4">
									<View className="flex-row items-center gap-2 mb-2">
										<View className="bg-primary px-2 py-1 rounded-full">
											<Text className="text-primary-foreground font-bold text-sm">
												{offer.discount_percentage}% OFF
											</Text>
										</View>
										<Sparkles size={16} color="#f59e0b" />
									</View>
									<Text className="font-semibold mb-1">{offer.title}</Text>
									<Text className="text-sm text-muted-foreground mb-2">{offer.restaurant.name}</Text>
									<Text className="text-xs text-muted-foreground">
										Valid until {new Date(offer.valid_until).toLocaleDateString()}
									</Text>
								</View>
							</Pressable>
						))}
					</ScrollView>
				</View>
			)}

			{/* Featured Restaurants */}
			{featuredRestaurants.length > 0 && (
				<View className="mb-6">
					{renderSectionHeader(
						"Featured This Week", 
						"Hand-picked restaurants just for you", 
						"See All", 
						() => router.push("/search")
					)}
					<FlatList
						horizontal
						data={featuredRestaurants}
						renderItem={({ item }) => renderRestaurantCard({ item, variant: "featured" })}
						keyExtractor={(item) => item.id}
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{ paddingHorizontal: 16 }}
					/>
				</View>
			)}

			{/* New Restaurants */}
			{newRestaurants.length > 0 && (
				<View className="mb-6">
					{renderSectionHeader(
						"New to the Platform", 
						"Recently added restaurants", 
						"Explore", 
						() => router.push({ pathname: "/search", params: { sortBy: "newest" } })
					)}
					<FlatList
						horizontal
						data={newRestaurants}
						renderItem={({ item }) => renderRestaurantCard({ item, variant: "compact" })}
						keyExtractor={(item) => item.id}
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{ paddingHorizontal: 16 }}
					/>
				</View>
			)}

			{/* Top Rated */}
			{topRatedRestaurants.length > 0 && (
				<View className="mb-6">
					{renderSectionHeader(
						"Top Rated", 
						"Highest rated by diners", 
						"View All", 
						() => router.push({ pathname: "/search", params: { sortBy: "rating" } })
					)}
					<FlatList
						horizontal
						data={topRatedRestaurants}
						renderItem={({ item }) => renderRestaurantCard({ item, variant: "compact" })}
						keyExtractor={(item) => item.id}
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{ paddingHorizontal: 16 }}
					/>
				</View>
			)}



		

			{/* Loyalty Points Widget */}
			{profile?.loyalty_points && profile.loyalty_points > 0 && (
				<Pressable
					onPress={() => router.push("/profile/loyalty")}
					className="mx-4 mb-6 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20"
				>
					<View className="flex-row items-center justify-between">
						<View>
							<View className="flex-row items-center gap-2 mb-1">
								<Trophy size={20} color={colorScheme === "dark" ? "#fbbf24" : "#f59e0b"} />
								<Text className="font-bold text-lg">{profile.loyalty_points} Points</Text>
							</View>
							<Muted className="text-sm">
								{1000 - (profile.loyalty_points % 1000)} points to next reward
							</Muted>
						</View>
						<ChevronRight size={20} color="#666" />
					</View>
				</Pressable>
			)}

		</ScrollView>
	);
}