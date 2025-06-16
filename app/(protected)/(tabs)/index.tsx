import React, { useEffect, useState, useCallback, useRef } from "react";
import {
	ScrollView,
	View,
	RefreshControl,
	ActivityIndicator,
	Pressable,
	FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { MapPin, ChevronRight, Trophy, Sparkles } from "lucide-react-native";
import * as Location from "expo-location";

import { useAuth } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";

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
}

interface Booking {
	id: string;
	restaurant_id: string;
	booking_time: string;
	party_size: number;
	status: string;
	restaurant: Restaurant;
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
	latitude: number;
	longitude: number;
	city: string;
	district: string;
}

export default function HomeScreen() {
	// 1. State Management - Centralized state declarations
	const { profile } = useAuth();
	const { colorScheme } = useColorScheme();
	const router = useRouter();
	
	// 2. Core data states with explicit typing
	const [featuredRestaurants, setFeaturedRestaurants] = useState<Restaurant[]>([]);
	const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
	const [specialOffers, setSpecialOffers] = useState<SpecialOffer[]>([]);
	const [location, setLocation] = useState<LocationData | null>(null);
	
	// 3. UI state management
	const [refreshing, setRefreshing] = useState(false);
	const [loading, setLoading] = useState(true);
	const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
	
	// 4. Performance optimization refs
	const scrollViewRef = useRef<ScrollView>(null);
	const hasInitialLoad = useRef(false);

	// 5. Location Services Implementation
	const requestLocationPermission = useCallback(async () => {
		try {
			// 5.1 Request foreground location permission
			const { status } = await Location.requestForegroundPermissionsAsync();
			
			if (status !== "granted") {
				setLocationPermissionDenied(true);
				// 5.2 Fallback to default location (Beirut)
				setLocation({
					latitude: 33.8938,
					longitude: 35.5018,
					city: "Beirut",
					district: "Central District",
				});
				return false;
			}

			// 5.3 Get current position with high accuracy
			const locationData = await Location.getCurrentPositionAsync({
				accuracy: Location.Accuracy.Balanced,
			});

			// 5.4 Reverse geocode to get city and district
			const [address] = await Location.reverseGeocodeAsync({
				latitude: locationData.coords.latitude,
				longitude: locationData.coords.longitude,
			});

			setLocation({
				latitude: locationData.coords.latitude,
				longitude: locationData.coords.longitude,
				city: address.city || "Unknown",
				district: address.district || address.subregion || "Unknown",
			});

			return true;
		} catch (error) {
			console.error("Location error:", error);
			// 5.5 Error handling with graceful fallback
			setLocation({
				latitude: 33.8938,
				longitude: 35.5018,
				city: "Beirut",
				district: "Central District",
			});
			return false;
		}
	}, []);

	// 6. Data Fetching Functions with Error Handling
	const fetchFeaturedRestaurants = useCallback(async () => {
		try {
			// 6.1 Query with location-based sorting if available
			let query = supabase
				.from("restaurants")
				.select("*")
				.eq("featured", true)
				.gte("average_rating", 4.0)
				.order("average_rating", { ascending: false })
				.limit(10);

			// 6.2 Add distance-based filtering if location available
			if (location) {
				// Note: Requires PostGIS extension in Supabase
				// query = query.order(
				//   `location <-> 'POINT(${location.longitude} ${location.latitude})'::geography`
				// );
			}

			const { data, error } = await query;

			if (error) throw error;
			setFeaturedRestaurants(data || []);
		} catch (error) {
			console.error("Error fetching featured restaurants:", error);
			// 6.3 Implement retry logic or show error state
		}
	}, [location]);

	const fetchRecentBookings = useCallback(async () => {
		if (!profile?.id) return;

		try {
			// 6.4 Fetch last 4 completed bookings with restaurant details
			const { data, error } = await supabase
				.from("bookings")
				.select(`
					*,
					restaurant:restaurants (*)
				`)
				.eq("user_id", profile.id)
				.eq("status", "completed")
				.order("booking_time", { ascending: false })
				.limit(4);

			if (error) throw error;
			setRecentBookings(data || []);
		} catch (error) {
			console.error("Error fetching recent bookings:", error);
		}
	}, [profile?.id]);

	const fetchSpecialOffers = useCallback(async () => {
		try {
			// 6.5 Fetch active offers with complex date filtering
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
			setSpecialOffers(data || []);
		} catch (error) {
			console.error("Error fetching special offers:", error);
		}
	}, []);

	// 7. Unified Data Loading Function
	const loadAllData = useCallback(async () => {
		setLoading(true);
		
		// 7.1 Parallel data fetching for performance
		await Promise.all([
			fetchFeaturedRestaurants(),
			fetchRecentBookings(),
			fetchSpecialOffers(),
		]);
		
		setLoading(false);
	}, [fetchFeaturedRestaurants, fetchRecentBookings, fetchSpecialOffers]);

	// 8. Lifecycle Management
	useEffect(() => {
		// 8.1 Initial load sequence
		const initializeHome = async () => {
			if (!hasInitialLoad.current) {
				await requestLocationPermission();
				hasInitialLoad.current = true;
			}
		};

		initializeHome();
	}, [requestLocationPermission]);

	useEffect(() => {
		// 8.2 Load data when location is available
		if (location && profile) {
			loadAllData();
		}
	}, [location, profile, loadAllData]);

	// 9. User Interaction Handlers
	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		await loadAllData();
		setRefreshing(false);
	}, [loadAllData]);

	const handleLocationPress = useCallback(() => {
		// 9.1 Navigate to location selector modal
		router.push("/location-selector");
	}, [router]);

	const handleRestaurantPress = useCallback((restaurantId: string) => {
		// 9.2 Navigate with proper parameters
		router.push({
			pathname: "/restaurant/[id]",
			params: { id: restaurantId },
		});
	}, [router]);

	const handleBookAgain = useCallback((restaurant: Restaurant) => {
		// 9.3 Quick booking flow for repeat customers
		router.push({
			pathname: "/booking/create",
			params: {
				restaurantId: restaurant.id,
				restaurantName: restaurant.name,
				quickBook: "true",
			},
		});
	}, [router]);

	// 10. Time-based Greeting Logic
	const getGreeting = useCallback(() => {
		const hour = new Date().getHours();
		if (hour < 12) return "Good Morning";
		if (hour < 18) return "Good Afternoon";
		return "Good Evening";
	}, []);

	// 11. Component Render Functions
	const renderFeaturedCard = ({ item }: { item: Restaurant }) => (
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
				<View className="p-4">
					<H3 className="mb-1">{item.name}</H3>
					<P className="text-muted-foreground mb-2">{item.cuisine_type}</P>
					<View className="flex-row items-center justify-between">
						<View className="flex-row items-center gap-1">
							<Text className="text-yellow-500">★</Text>
							<Text className="font-medium">{item.average_rating.toFixed(1)}</Text>
							<Text className="text-muted-foreground">({item.total_reviews})</Text>
						</View>
						<Text className="text-muted-foreground">
							{"$".repeat(item.price_range)}
						</Text>
					</View>
					{item.tags.length > 0 && (
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

	const renderBookAgainCard = ({ item }: { item: Booking }) => (
		<Pressable
			onPress={() => handleBookAgain(item.restaurant)}
			className="mr-3 w-64"
		>
			<View className="bg-card rounded-lg p-3 flex-row items-center gap-3">
				<Image
					source={{ uri: item.restaurant.main_image_url }}
					className="w-16 h-16 rounded-lg"
					contentFit="cover"
				/>
				<View className="flex-1">
					<Text className="font-semibold">{item.restaurant.name}</Text>
					<Muted className="text-sm">
						Last visited {new Date(item.booking_time).toLocaleDateString()}
					</Muted>
					<Button
						size="sm"
						variant="secondary"
						className="mt-2"
					>
						<Text>Book Again</Text>
					</Button>
				</View>
			</View>
		</Pressable>
	);

	// 12. Loading State Component
	if (loading) {
		return (
			<View className="flex-1 items-center justify-center bg-background">
				<ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
				<Muted className="mt-4">Loading your personalized experience...</Muted>
			</View>
		);
	}

	// 13. Main Render
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
			{/* 14. Header Section with Location */}
			<View className="px-4 pt-6 pb-4">
				<H2>{getGreeting()}, {profile?.full_name?.split(" ")[0]}!</H2>
				<Pressable
					onPress={handleLocationPress}
					className="flex-row items-center gap-2 mt-2"
				>
					<MapPin size={16} color="#666" />
					<Text className="text-muted-foreground">
						{location?.district}, {location?.city}
					</Text>
					<ChevronRight size={16} color="#666" />
				</Pressable>
			</View>

			{/* 15. Special Offers Banner */}
			{specialOffers.length > 0 && (
				<View className="mb-6">
					<View className="px-4 mb-3 flex-row items-center justify-between">
						<View className="flex-row items-center gap-2">
							<Sparkles size={20} color={colorScheme === "dark" ? "#fbbf24" : "#f59e0b"} />
							<H3>Special Offers</H3>
						</View>
						<Pressable onPress={() => router.push("/offers")}>
							<Text className="text-primary text-sm">View All</Text>
						</Pressable>
					</View>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{ paddingHorizontal: 16 }}
					>
						{specialOffers.map((offer) => (
							<Pressable
								key={offer.id}
								onPress={() => handleRestaurantPress(offer.restaurant.id)}
								className="mr-3 w-72"
							>
								<View className="bg-primary/10 border border-primary/20 rounded-lg p-4">
									<Text className="font-bold text-primary mb-1">
										{offer.discount_percentage}% OFF
									</Text>
									<Text className="font-semibold mb-1">{offer.title}</Text>
									<Muted className="text-sm mb-2">{offer.restaurant.name}</Muted>
									<Text className="text-xs text-muted-foreground">
										Valid until {new Date(offer.valid_until).toLocaleDateString()}
									</Text>
								</View>
							</Pressable>
						))}
					</ScrollView>
				</View>
			)}

			{/* 16. Featured Restaurants */}
			<View className="mb-6">
				<View className="px-4 mb-3 flex-row items-center justify-between">
					<View>
						<H3>Featured This Week</H3>
						<Muted className="text-sm">Hand-picked restaurants just for you</Muted>
					</View>
					<Pressable onPress={() => router.push("/search")}>
						<Text className="text-primary text-sm">See All</Text>
					</Pressable>
				</View>
				<FlatList
					horizontal
					data={featuredRestaurants}
					renderItem={renderFeaturedCard}
					keyExtractor={(item) => item.id}
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={{ paddingHorizontal: 16 }}
				/>
			</View>

			{/* 17. Book Again Section */}
			{recentBookings.length > 0 && (
				<View className="mb-6">
					<View className="px-4 mb-3">
						<H3>Book Again</H3>
						<Muted className="text-sm">Your recent favorites</Muted>
					</View>
					<FlatList
						horizontal
						data={recentBookings}
						renderItem={renderBookAgainCard}
						keyExtractor={(item) => item.id}
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{ paddingHorizontal: 16 }}
					/>
				</View>
			)}

			{/* 18. Cuisine Categories */}
			<View className="px-4 mb-6">
				<H3 className="mb-3">Explore by Cuisine</H3>
				<View className="flex-row flex-wrap gap-2">
					{["Lebanese", "Italian", "Japanese", "French", "Mexican", "Indian"].map((cuisine) => (
						<Pressable
							key={cuisine}
							onPress={() => router.push({
								pathname: "/search",
								params: { cuisine }
							})}
							className="bg-muted px-4 py-2 rounded-full"
						>
							<Text>{cuisine}</Text>
						</Pressable>
					))}
				</View>
			</View>

			{/* 19. Loyalty Points Widget */}
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

			{/* 20. Bottom Padding for Tab Bar */}
			<View className="h-20" />
		</ScrollView>
	);
}