// app/(protected)/profile/preferences.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  Save,
  Utensils,
  AlertTriangle,
  Heart,
  Users,
  Info,
  Check,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";

// 1. Lebanese Market-Specific Preferences
const DIETARY_RESTRICTIONS = [
  { id: "vegetarian", label: "Vegetarian", icon: "🥗" },
  { id: "vegan", label: "Vegan", icon: "🌱" },
  { id: "halal", label: "Halal Only", icon: "🥩" },
  { id: "gluten_free", label: "Gluten-Free", icon: "🌾" },
  { id: "dairy_free", label: "Dairy-Free", icon: "🥛" },
  { id: "nut_allergy", label: "Nut Allergy", icon: "🥜" },
  { id: "shellfish_allergy", label: "Shellfish Allergy", icon: "🦐" },
  { id: "kosher", label: "Kosher", icon: "✡️" },
  { id: "low_carb", label: "Low Carb", icon: "🍞" },
  { id: "diabetic", label: "Diabetic Friendly", icon: "💉" },
];

const ALLERGIES = [
  "Peanuts",
  "Tree Nuts",
  "Milk",
  "Eggs",
  "Wheat",
  "Soy",
  "Fish",
  "Shellfish",
  "Sesame",
  "Sulfites",
];

const CUISINE_PREFERENCES = [
  { id: "lebanese", label: "Lebanese", popular: true },
  { id: "mediterranean", label: "Mediterranean", popular: true },
  { id: "italian", label: "Italian", popular: true },
  { id: "french", label: "French" },
  { id: "japanese", label: "Japanese", popular: true },
  { id: "chinese", label: "Chinese" },
  { id: "indian", label: "Indian" },
  { id: "mexican", label: "Mexican" },
  { id: "american", label: "American" },
  { id: "seafood", label: "Seafood" },
  { id: "steakhouse", label: "Steakhouse" },
  { id: "fusion", label: "Fusion" },
  { id: "vegetarian", label: "Vegetarian/Vegan" },
  { id: "cafe", label: "Café & Bakery" },
];

const AMBIANCE_PREFERENCES = [
  { id: "quiet", label: "Quiet & Intimate", icon: "🤫" },
  { id: "lively", label: "Lively & Social", icon: "🎉" },
  { id: "romantic", label: "Romantic", icon: "💕" },
  { id: "business", label: "Business Friendly", icon: "💼" },
  { id: "family", label: "Family Friendly", icon: "👨‍👩‍👧‍👦" },
  { id: "outdoor", label: "Outdoor Seating", icon: "🌳" },
  { id: "view", label: "Great Views", icon: "🌅" },
  { id: "traditional", label: "Traditional", icon: "🏛️" },
  { id: "modern", label: "Modern & Trendy", icon: "✨" },
];

const PARTY_SIZES = [
  { value: 1, label: "Solo Dining" },
  { value: 2, label: "Couple" },
  { value: 4, label: "Small Group" },
  { value: 6, label: "Medium Group" },
  { value: 8, label: "Large Group" },
];

interface PreferencesData {
  dietary_restrictions: string[];
  allergies: string[];
  favorite_cuisines: string[];
  preferred_ambiance: string[];
  preferred_party_size: number;
  special_requirements: string;
}

export default function DiningPreferencesScreen() {
  const { profile, updateProfile } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  
  // 2. State Management
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<PreferencesData>({
    dietary_restrictions: [],
    allergies: [],
    favorite_cuisines: [],
    preferred_ambiance: [],
    preferred_party_size: 2,
    special_requirements: "",
  });
  
  // 3. Load Current Preferences
  useEffect(() => {
    if (profile) {
      setPreferences({
        dietary_restrictions: profile.dietary_restrictions || [],
        allergies: profile.allergies || [],
        favorite_cuisines: profile.favorite_cuisines || [],
        preferred_ambiance: profile.preferred_ambiance || [],
        preferred_party_size: profile.preferred_party_size || 2,
        special_requirements: profile.special_requirements || "",
      });
      setLoading(false);
    }
  }, [profile]);

  // 4. Toggle Handlers
  const toggleDietaryRestriction = useCallback((restriction: string) => {
    setPreferences((prev) => ({
      ...prev,
      dietary_restrictions: prev.dietary_restrictions.includes(restriction)
        ? prev.dietary_restrictions.filter((r) => r !== restriction)
        : [...prev.dietary_restrictions, restriction],
    }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggleAllergy = useCallback((allergy: string) => {
    setPreferences((prev) => ({
      ...prev,
      allergies: prev.allergies.includes(allergy)
        ? prev.allergies.filter((a) => a !== allergy)
        : [...prev.allergies, allergy],
    }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggleCuisine = useCallback((cuisine: string) => {
    setPreferences((prev) => ({
      ...prev,
      favorite_cuisines: prev.favorite_cuisines.includes(cuisine)
        ? prev.favorite_cuisines.filter((c) => c !== cuisine)
        : [...prev.favorite_cuisines, cuisine],
    }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggleAmbiance = useCallback((ambiance: string) => {
    setPreferences((prev) => ({
      ...prev,
      preferred_ambiance: prev.preferred_ambiance.includes(ambiance)
        ? prev.preferred_ambiance.filter((a) => a !== ambiance)
        : [...prev.preferred_ambiance, ambiance],
    }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // 5. Save Preferences Handler
  const handleSavePreferences = useCallback(async () => {
    setSaving(true);
    
    try {
      await updateProfile({
        dietary_restrictions: preferences.dietary_restrictions,
        allergies: preferences.allergies,
        favorite_cuisines: preferences.favorite_cuisines,
        preferred_ambiance: preferences.preferred_ambiance,
        preferred_party_size: preferences.preferred_party_size,
        special_requirements: preferences.special_requirements,
      });
      
      Alert.alert(
        "Preferences Saved",
        "Your dining preferences have been updated successfully",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      console.error("Error saving preferences:", error);
      Alert.alert("Error", "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }, [preferences, updateProfile, router]);

  // 6. Check if preferences have changed
  const hasChanges = JSON.stringify(preferences) !== JSON.stringify({
    dietary_restrictions: profile?.dietary_restrictions || [],
    allergies: profile?.allergies || [],
    favorite_cuisines: profile?.favorite_cuisines || [],
    preferred_ambiance: profile?.preferred_ambiance || [],
    preferred_party_size: profile?.preferred_party_size || 2,
    special_requirements: profile?.special_requirements || "",
  });

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </Pressable>
        <H2>Dining Preferences</H2>
        <View className="w-10" />
      </View>
      
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* 7. Why We Ask Section */}
        <View className="mx-4 mt-4 p-4 bg-primary/10 rounded-lg">
          <View className="flex-row items-start gap-3">
            <Info size={20} color={colorScheme === "dark" ? "#3b82f6" : "#2563eb"} />
            <View className="flex-1">
              <Text className="font-medium mb-1">Why we ask for preferences</Text>
              <Text className="text-sm text-muted-foreground">
                Your preferences help us recommend restaurants that match your taste and dietary needs. 
                Restaurants will also be notified of your requirements when you make a booking.
              </Text>
            </View>
          </View>
        </View>
        
        {/* 8. Dietary Restrictions */}
        <View className="px-4 mt-6">
          <View className="flex-row items-center gap-2 mb-3">
            <Utensils size={20} />
            <H3>Dietary Restrictions</H3>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {DIETARY_RESTRICTIONS.map((restriction) => (
              <Pressable
                key={restriction.id}
                onPress={() => toggleDietaryRestriction(restriction.id)}
                className={`flex-row items-center gap-2 px-4 py-2 rounded-full border ${
                  preferences.dietary_restrictions.includes(restriction.id)
                    ? "bg-primary border-primary"
                    : "bg-background border-border"
                }`}
              >
                <Text>{restriction.icon}</Text>
                <Text
                  className={
                    preferences.dietary_restrictions.includes(restriction.id)
                      ? "text-primary-foreground"
                      : ""
                  }
                >
                  {restriction.label}
                </Text>
                {preferences.dietary_restrictions.includes(restriction.id) && (
                  <Check size={16} color="#fff" />
                )}
              </Pressable>
            ))}
          </View>
        </View>
        
        {/* 9. Allergies */}
        <View className="px-4 mt-6">
          <View className="flex-row items-center gap-2 mb-3">
            <AlertTriangle size={20} color="#ef4444" />
            <H3>Allergies & Intolerances</H3>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {ALLERGIES.map((allergy) => (
              <Pressable
                key={allergy}
                onPress={() => toggleAllergy(allergy)}
                className={`px-4 py-2 rounded-full border ${
                  preferences.allergies.includes(allergy)
                    ? "bg-red-100 dark:bg-red-900/20 border-red-500"
                    : "bg-background border-border"
                }`}
              >
                <Text
                  className={
                    preferences.allergies.includes(allergy)
                      ? "text-red-800 dark:text-red-200"
                      : ""
                  }
                >
                  {allergy}
                </Text>
              </Pressable>
            ))}
          </View>
          {preferences.allergies.length > 0 && (
            <View className="mt-2 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
              <Text className="text-sm text-red-800 dark:text-red-200">
                ⚠️ Restaurants will be notified of your allergies with every booking
              </Text>
            </View>
          )}
        </View>
        
        {/* 10. Cuisine Preferences */}
        <View className="px-4 mt-6">
          <View className="flex-row items-center gap-2 mb-3">
            <Heart size={20} color="#ef4444" />
            <H3>Favorite Cuisines</H3>
          </View>
          <Muted className="mb-3">Select cuisines you enjoy most</Muted>
          
          {/* Popular Cuisines */}
          <Text className="font-medium mb-2">Popular in Lebanon</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {CUISINE_PREFERENCES.filter((c) => c.popular).map((cuisine) => (
              <Pressable
                key={cuisine.id}
                onPress={() => toggleCuisine(cuisine.id)}
                className={`px-4 py-2 rounded-full border ${
                  preferences.favorite_cuisines.includes(cuisine.id)
                    ? "bg-primary border-primary"
                    : "bg-background border-border"
                }`}
              >
                <Text
                  className={
                    preferences.favorite_cuisines.includes(cuisine.id)
                      ? "text-primary-foreground"
                      : ""
                  }
                >
                  {cuisine.label}
                </Text>
              </Pressable>
            ))}
          </View>
          
          {/* Other Cuisines */}
          <Text className="font-medium mb-2">Other Cuisines</Text>
          <View className="flex-row flex-wrap gap-2">
            {CUISINE_PREFERENCES.filter((c) => !c.popular).map((cuisine) => (
              <Pressable
                key={cuisine.id}
                onPress={() => toggleCuisine(cuisine.id)}
                className={`px-4 py-2 rounded-full border ${
                  preferences.favorite_cuisines.includes(cuisine.id)
                    ? "bg-primary border-primary"
                    : "bg-background border-border"
                }`}
              >
                <Text
                  className={
                    preferences.favorite_cuisines.includes(cuisine.id)
                      ? "text-primary-foreground"
                      : ""
                  }
                >
                  {cuisine.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        
        {/* 11. Ambiance Preferences */}
        <View className="px-4 mt-6">
          <H3 className="mb-3">Preferred Ambiance</H3>
          <Muted className="mb-3">What type of atmosphere do you enjoy?</Muted>
          <View className="gap-2">
            {AMBIANCE_PREFERENCES.map((ambiance) => (
              <Pressable
                key={ambiance.id}
                onPress={() => toggleAmbiance(ambiance.id)}
                className={`flex-row items-center justify-between p-4 rounded-lg border ${
                  preferences.preferred_ambiance.includes(ambiance.id)
                    ? "bg-primary/10 border-primary"
                    : "bg-background border-border"
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <Text className="text-xl">{ambiance.icon}</Text>
                  <Text
                    className={`font-medium ${
                      preferences.preferred_ambiance.includes(ambiance.id)
                        ? "text-primary"
                        : ""
                    }`}
                  >
                    {ambiance.label}
                  </Text>
                </View>
                {preferences.preferred_ambiance.includes(ambiance.id) && (
                  <Check size={20} color={colorScheme === "dark" ? "#3b82f6" : "#2563eb"} />
                )}
              </Pressable>
            ))}
          </View>
        </View>
        
        {/* 12. Typical Party Size */}
        <View className="px-4 mt-6 mb-8">
          <View className="flex-row items-center gap-2 mb-3">
            <Users size={20} />
            <H3>Typical Party Size</H3>
          </View>
          <Muted className="mb-3">How many people do you usually dine with?</Muted>
          <View className="flex-row flex-wrap gap-2">
            {PARTY_SIZES.map((size) => (
              <Pressable
                key={size.value}
                onPress={() => {
                  setPreferences({ ...preferences, preferred_party_size: size.value });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`px-4 py-3 rounded-lg border min-w-[100px] items-center ${
                  preferences.preferred_party_size === size.value
                    ? "bg-primary border-primary"
                    : "bg-background border-border"
                }`}
              >
                <Text
                  className={`font-bold text-lg ${
                    preferences.preferred_party_size === size.value
                      ? "text-primary-foreground"
                      : ""
                  }`}
                >
                  {size.value}
                </Text>
                <Text
                  className={`text-xs ${
                    preferences.preferred_party_size === size.value
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground"
                  }`}
                >
                  {size.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
      
      {/* 13. Save Button */}
      <View className="p-4 border-t border-border">
        <Button
          onPress={handleSavePreferences}
          disabled={saving || !hasChanges}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Save size={20} />
              <Text>Save Preferences</Text>
            </>
          )}
        </Button>
      </View>
    </SafeAreaView>
  );
}