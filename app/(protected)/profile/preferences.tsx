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

import PreferencesScreenSkeleton from "@/components/skeletons/PreferencesScreenSkeleton";
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

// Default preferences object
const DEFAULT_PREFERENCES = {
  dietary_restrictions: [],
  allergies: [],
  favorite_cuisines: [],
  preferred_ambiance: [],
  preferred_party_size: 2,
  special_requirements: "",
};

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
  
  // 2. State Management with proper initialization
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<PreferencesData>(DEFAULT_PREFERENCES);
  
  // 3. Load Current Preferences with proper error handling
  useEffect(() => {
    const loadPreferences = () => {
      try {
        if (profile) {
          // Safely extract preferences with fallbacks
          const loadedPreferences: PreferencesData = {
            dietary_restrictions: profile.dietary_restrictions || DEFAULT_PREFERENCES.dietary_restrictions,
            allergies: profile.allergies || DEFAULT_PREFERENCES.allergies,
            favorite_cuisines: profile.favorite_cuisines || DEFAULT_PREFERENCES.favorite_cuisines,
            preferred_ambiance: profile.preferred_ambiance || DEFAULT_PREFERENCES.preferred_ambiance,
            preferred_party_size: profile.preferred_party_size || DEFAULT_PREFERENCES.preferred_party_size,
            special_requirements: profile.special_requirements || DEFAULT_PREFERENCES.special_requirements,
          };
          
          console.log("Loading preferences:", loadedPreferences);
          setPreferences(loadedPreferences);
        } else {
          // No profile yet, use defaults
          setPreferences(DEFAULT_PREFERENCES);
        }
      } catch (error) {
        console.error("Error loading preferences:", error);
        setPreferences(DEFAULT_PREFERENCES);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [profile]);

  // 4. Toggle Handlers with safety checks
  const toggleDietaryRestriction = useCallback((restriction: string) => {
    setPreferences((prev) => {
      if (!prev) return DEFAULT_PREFERENCES;
      
      const currentRestrictions = prev.dietary_restrictions || [];
      const newRestrictions = currentRestrictions.includes(restriction)
        ? currentRestrictions.filter((r) => r !== restriction)
        : [...currentRestrictions, restriction];
      
      return {
        ...prev,
        dietary_restrictions: newRestrictions,
      };
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggleAllergy = useCallback((allergy: string) => {
    setPreferences((prev) => {
      if (!prev) return DEFAULT_PREFERENCES;
      
      const currentAllergies = prev.allergies || [];
      const newAllergies = currentAllergies.includes(allergy)
        ? currentAllergies.filter((a) => a !== allergy)
        : [...currentAllergies, allergy];
      
      return {
        ...prev,
        allergies: newAllergies,
      };
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggleCuisine = useCallback((cuisine: string) => {
    setPreferences((prev) => {
      if (!prev) return DEFAULT_PREFERENCES;
      
      const currentCuisines = prev.favorite_cuisines || [];
      const newCuisines = currentCuisines.includes(cuisine)
        ? currentCuisines.filter((c) => c !== cuisine)
        : [...currentCuisines, cuisine];
      
      return {
        ...prev,
        favorite_cuisines: newCuisines,
      };
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggleAmbiance = useCallback((ambiance: string) => {
    setPreferences((prev) => {
      if (!prev) return DEFAULT_PREFERENCES;
      
      const currentAmbiance = prev.preferred_ambiance || [];
      const newAmbiance = currentAmbiance.includes(ambiance)
        ? currentAmbiance.filter((a) => a !== ambiance)
        : [...currentAmbiance, ambiance];
      
      return {
        ...prev,
        preferred_ambiance: newAmbiance,
      };
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const updatePartySize = useCallback((size: number) => {
    setPreferences((prev) => {
      if (!prev) return DEFAULT_PREFERENCES;
      
      return {
        ...prev,
        preferred_party_size: size,
      };
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // 5. Save Preferences Handler
  const handleSavePreferences = useCallback(async () => {
    if (!preferences) {
      Alert.alert("Error", "Preferences data is not available");
      return;
    }

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
  const hasChanges = React.useMemo(() => {
    if (!preferences || !profile) return false;
    
    const originalPreferences = {
      dietary_restrictions: profile.dietary_restrictions || [],
      allergies: profile.allergies || [],
      favorite_cuisines: profile.favorite_cuisines || [],
      preferred_ambiance: profile.preferred_ambiance || [],
      preferred_party_size: profile.preferred_party_size || 2,
      special_requirements: profile.special_requirements || "",
    };
    
    return JSON.stringify(preferences) !== JSON.stringify(originalPreferences);
  }, [preferences, profile]);

  // 7. Loading state


  // 8. Safety check for preferences
  if (!preferences) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <H3 className="text-center mb-2">Loading Error</H3>
          <P className="text-center text-muted-foreground mb-4">
            Unable to load your preferences. Please try again.
          </P>
          <Button
            variant="outline"
            onPress={() => router.back()}
            className="mt-4"
          >
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

    if (loading) {
    return <PreferencesScreenSkeleton />;
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
        {/* Why We Ask Section */}
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
        
        {/* Dietary Restrictions */}
        <View className="px-4 mt-6">
          <View className="flex-row items-center gap-2 mb-3">
            <Utensils size={20} />
            <H3>Dietary Restrictions</H3>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {DIETARY_RESTRICTIONS.map((restriction) => {
              const isSelected = (preferences.dietary_restrictions || []).includes(restriction.id);
              
              return (
                <Pressable
                  key={restriction.id}
                  onPress={() => toggleDietaryRestriction(restriction.id)}
                  className={`flex-row items-center gap-2 px-4 py-2 rounded-full border ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  <Text>{restriction.icon}</Text>
                  <Text
                    className={
                      isSelected
                        ? "text-primary-foreground"
                        : ""
                    }
                  >
                    {restriction.label}
                  </Text>
                  {isSelected && (
                    <Check size={16} color="#fff" />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
        
        {/* Allergies */}
        <View className="px-4 mt-6">
          <View className="flex-row items-center gap-2 mb-3">
            <AlertTriangle size={20} color="#ef4444" />
            <H3>Allergies & Intolerances</H3>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {ALLERGIES.map((allergy) => {
              const isSelected = (preferences.allergies || []).includes(allergy);
              
              return (
                <Pressable
                  key={allergy}
                  onPress={() => toggleAllergy(allergy)}
                  className={`px-4 py-2 rounded-full border ${
                    isSelected
                      ? "bg-red-100 dark:bg-red-900/20 border-red-500"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={
                      isSelected
                        ? "text-red-800 dark:text-red-200"
                        : ""
                    }
                  >
                    {allergy}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {preferences.allergies && preferences.allergies.length > 0 && (
            <View className="mt-2 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
              <Text className="text-sm text-red-800 dark:text-red-200">
                ⚠️ Restaurants will be notified of your allergies with every booking
              </Text>
            </View>
          )}
        </View>
        
        {/* Cuisine Preferences */}
        <View className="px-4 mt-6">
          <View className="flex-row items-center gap-2 mb-3">
            <Heart size={20} color="#ef4444" />
            <H3>Favorite Cuisines</H3>
          </View>
          <Muted className="mb-3">Select cuisines you enjoy most</Muted>
          
          {/* Popular Cuisines */}
          <Text className="font-medium mb-2">Popular in Lebanon</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {CUISINE_PREFERENCES.filter((c) => c.popular).map((cuisine) => {
              const isSelected = (preferences.favorite_cuisines || []).includes(cuisine.id);
              
              return (
                <Pressable
                  key={cuisine.id}
                  onPress={() => toggleCuisine(cuisine.id)}
                  className={`px-4 py-2 rounded-full border ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={
                      isSelected
                        ? "text-primary-foreground"
                        : ""
                    }
                  >
                    {cuisine.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          
          {/* Other Cuisines */}
          <Text className="font-medium mb-2">Other Cuisines</Text>
          <View className="flex-row flex-wrap gap-2">
            {CUISINE_PREFERENCES.filter((c) => !c.popular).map((cuisine) => {
              const isSelected = (preferences.favorite_cuisines || []).includes(cuisine.id);
              
              return (
                <Pressable
                  key={cuisine.id}
                  onPress={() => toggleCuisine(cuisine.id)}
                  className={`px-4 py-2 rounded-full border ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={
                      isSelected
                        ? "text-primary-foreground"
                        : ""
                    }
                  >
                    {cuisine.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        
        {/* Ambiance Preferences */}
        <View className="px-4 mt-6">
          <H3 className="mb-3">Preferred Ambiance</H3>
          <Muted className="mb-3">What type of atmosphere do you enjoy?</Muted>
          <View className="gap-2">
            {AMBIANCE_PREFERENCES.map((ambiance) => {
              const isSelected = (preferences.preferred_ambiance || []).includes(ambiance.id);
              
              return (
                <Pressable
                  key={ambiance.id}
                  onPress={() => toggleAmbiance(ambiance.id)}
                  className={`flex-row items-center justify-between p-4 rounded-lg border ${
                    isSelected
                      ? "bg-primary/10 border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <Text className="text-xl">{ambiance.icon}</Text>
                    <Text
                      className={`font-medium ${
                        isSelected
                          ? "text-primary"
                          : ""
                      }`}
                    >
                      {ambiance.label}
                    </Text>
                  </View>
                  {isSelected && (
                    <Check size={20} color={colorScheme === "dark" ? "#3b82f6" : "#2563eb"} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
        
        {/* Typical Party Size */}
        <View className="px-4 mt-6 mb-8">
          <View className="flex-row items-center gap-2 mb-3">
            <Users size={20} />
            <H3>Typical Party Size</H3>
          </View>
          <Muted className="mb-3">How many people do you usually dine with?</Muted>
          <View className="flex-row flex-wrap gap-2">
            {PARTY_SIZES.map((size) => {
              const isSelected = (preferences.preferred_party_size || 2) === size.value;
              
              return (
                <Pressable
                  key={size.value}
                  onPress={() => updatePartySize(size.value)}
                  className={`px-4 py-3 rounded-lg border min-w-[100px] items-center ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={`font-bold text-lg ${
                      isSelected
                        ? "text-primary-foreground"
                        : ""
                    }`}
                  >
                    {size.value}
                  </Text>
                  <Text
                    className={`text-xs ${
                      isSelected
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    }`}
                  >
                    {size.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
      
      {/* Save Button */}
      <View className="p-4 border-t border-border">
        <Button
          onPress={handleSavePreferences}
          disabled={saving || !hasChanges}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View className="flex-row items-center justify-center gap-2">
              <Save size={20} color="white" />
              <Text>Save Preferences</Text>
            </View>
          )}
        </Button>
      </View>
    </SafeAreaView>
  );
}