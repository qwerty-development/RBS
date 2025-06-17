// app/(protected)/booking/group-create.tsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Share,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Users,
  Plus,
  Minus,
  UserPlus,
  Share2,
  Check,
  X,
  Info,
  Phone,
  Mail,
  Calendar,
  Clock,
  CreditCard,
  Gift,
  Sparkles,
  ChevronRight,
  UserCheck,
  AlertCircle,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Contacts from "expo-contacts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

// 1. Enhanced Type Definitions for Group Booking
interface GroupMember {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: "pending" | "accepted" | "declined" | "organizer";
  dietaryRestrictions?: string[];
  isRegistered?: boolean;
  userId?: string;
  avatar?: string;
  splitBillShare?: number;
  preOrderItems?: PreOrderItem[];
}

interface PreOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  specialInstructions?: string;
}

interface SplitBillOption {
  type: "equal" | "custom" | "items" | "percentage";
  customSplits?: { memberId: string; amount: number }[];
}

interface GroupBookingData {
  restaurantId: string;
  date: Date;
  time: string;
  totalPartySize: number;
  groupMembers: GroupMember[];
  splitBillOption: SplitBillOption;
  sharedDishes: PreOrderItem[];
  specialRequests?: string;
  occasion?: string;
  tablePreferences: string[];
  depositRequired?: boolean;
  depositAmount?: number;
}

// 2. Lebanese-Specific Group Features
const LEBANESE_GROUP_OCCASIONS = [
  { id: "family_gathering", label: "Family Gathering", icon: "👨‍👩‍👧‍👦", suggestedSize: 8 },
  { id: "birthday", label: "Birthday Celebration", icon: "🎂", suggestedSize: 10 },
  { id: "engagement", label: "Engagement Party", icon: "💍", suggestedSize: 20 },
  { id: "graduation", label: "Graduation", icon: "🎓", suggestedSize: 15 },
  { id: "business_lunch", label: "Business Lunch", icon: "💼", suggestedSize: 6 },
  { id: "friends_night", label: "Friends Night Out", icon: "🎉", suggestedSize: 8 },
  { id: "argileh_session", label: "Argileh Session", icon: "💨", suggestedSize: 4 },
];

const MEZZE_SHARING_OPTIONS = [
  { id: "traditional", label: "Traditional Mezze", description: "Hummus, Tabbouleh, Fattoush, Kibbeh" },
  { id: "premium", label: "Premium Selection", description: "Includes raw meat, special grills" },
  { id: "vegetarian", label: "Vegetarian Mezze", description: "All vegetarian options" },
  { id: "mixed", label: "Mixed Platter", description: "Best of everything" },
];

// 3. Validation Schema
const groupBookingSchema = z.object({
  groupName: z.string().min(3, "Group name must be at least 3 characters"),
  occasion: z.string(),
  totalPartySize: z.number().min(2).max(50),
  groupMembers: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  })).min(1),
  specialRequests: z.string().optional(),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: "You must accept the group booking terms",
  }),
});

export default function GroupBookingCreateScreen() {
  // 4. Core State Management
  const router = useRouter();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  const params = useLocalSearchParams();
  const { restaurantId, date, time } = params;

  // 4.1 Form State
  const form = useForm<z.infer<typeof groupBookingSchema>>({
    resolver: zodResolver(groupBookingSchema),
    defaultValues: {
      groupName: "",
      occasion: "",
      totalPartySize: 2,
      groupMembers: [{
        name: profile?.full_name || "",
        email: profile?.email || "",
        phone: profile?.phone_number || "",
      }],
      specialRequests: "",
      acceptTerms: false,
    },
  });

  // 4.2 Component States
  const [restaurant, setRestaurant] = useState<Database["public"]["Tables"]["restaurants"]["Row"] | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([
    {
      id: "organizer",
      name: profile?.full_name || "",
      email: profile?.email || "",
      phone: profile?.phone_number || "",
      status: "organizer",
      isRegistered: true,
      userId: profile?.id,
    },
  ]);
  const [selectedOccasion, setSelectedOccasion] = useState<string>("");
  const [mezzeOption, setMezzeOption] = useState<string>("traditional");
  const [splitBillOption, setSplitBillOption] = useState<SplitBillOption>({
    type: "equal",
  });
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 5. Fetch Restaurant Details
  const fetchRestaurant = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .single();

      if (error) throw error;
      setRestaurant(data);
    } catch (error) {
      console.error("Error fetching restaurant:", error);
      Alert.alert("Error", "Failed to load restaurant details");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // 6. Add Group Member Function
  const addGroupMember = useCallback(async () => {
    const newMember: GroupMember = {
      id: Date.now().toString(),
      name: "",
      email: "",
      phone: "",
      status: "pending",
      isRegistered: false,
    };
    
    setGroupMembers((prev) => [...prev, newMember]);
    setShowMemberModal(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // 7. Import Contacts Function
  const importFromContacts = useCallback(async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    
    if (status !== "granted") {
      Alert.alert("Permission Denied", "We need contacts permission to import friends");
      return;
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
    });

    if (data.length > 0) {
      // Show contact picker modal (implementation needed)
      Alert.alert("Select Contacts", "Contact picker implementation needed");
    }
  }, []);

  // 8. Calculate Split Bill
  const calculateSplitBill = useCallback((estimatedTotal: number) => {
    const activeMembersCount = groupMembers.filter(
      (m) => m.status === "accepted" || m.status === "organizer"
    ).length;

    switch (splitBillOption.type) {
      case "equal":
        return estimatedTotal / activeMembersCount;
      case "custom":
        // Return custom splits
        return splitBillOption.customSplits;
      case "items":
        // Calculate based on individual pre-orders
        return groupMembers.map((member) => {
          const memberTotal = member.preOrderItems?.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          ) || 0;
          const sharedPortion = estimatedTotal * 0.3 / activeMembersCount; // 30% shared items
          return memberTotal + sharedPortion;
        });
      default:
        return estimatedTotal / activeMembersCount;
    }
  }, [groupMembers, splitBillOption]);

  // 9. Share Group Booking Link
  const shareGroupBooking = useCallback(async (bookingId: string) => {
    const shareLink = `https://lebanesebites.app/join-group/${bookingId}`;
    const message = `You're invited to join our group booking at ${restaurant?.name}!\n\n` +
      `📅 ${new Date(date as string).toLocaleDateString()}\n` +
      `🕐 ${time}\n` +
      `👥 ${groupMembers.length} people\n\n` +
      `Join here: ${shareLink}`;

    try {
      await Share.share({
        message,
        title: `Group Booking Invitation - ${restaurant?.name}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  }, [restaurant, date, time, groupMembers]);

  // 10. Submit Group Booking
  const submitGroupBooking = useCallback(async (data: z.infer<typeof groupBookingSchema>) => {
    if (!restaurant || !profile) return;

    setSubmitting(true);
    try {
      // 10.1 Create main booking
      const { data: mainBooking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          user_id: profile.id,
          restaurant_id: restaurant.id,
          booking_time: new Date(`${date} ${time}`).toISOString(),
          party_size: groupMembers.length,
          status: restaurant.booking_policy === "instant" ? "confirmed" : "pending",
          special_requests: data.specialRequests,
          occasion: selectedOccasion,
          is_group_booking: true,
          group_booking_data: {
            groupName: data.groupName,
            organizer: profile.id,
            members: groupMembers,
            splitBillOption,
            mezzeOption,
          },
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // 10.2 Create shared booking entries for each member
      const sharedBookings = groupMembers
        .filter((m) => m.userId && m.status !== "organizer")
        .map((member) => ({
          booking_id: mainBooking.id,
          shared_with_user_id: member.userId,
          accepted: member.status === "accepted",
        }));

      if (sharedBookings.length > 0) {
        const { error: sharedError } = await supabase
          .from("shared_bookings")
          .insert(sharedBookings);

        if (sharedError) console.error("Error creating shared bookings:", sharedError);
      }

      // 10.3 Send invitations to non-registered members
      const nonRegisteredMembers = groupMembers.filter((m) => !m.isRegistered && m.email);
      
      // This would trigger email invitations through a serverless function
      if (nonRegisteredMembers.length > 0) {
        // await sendGroupInvitations(mainBooking.id, nonRegisteredMembers);
      }

      // 10.4 Share booking link
      await shareGroupBooking(mainBooking.id);

      // 10.5 Navigate to success
      router.replace({
        pathname: "/booking/group-success",
        params: {
          bookingId: mainBooking.id,
          groupSize: groupMembers.length.toString(),
        },
      });

    } catch (error: any) {
      console.error("Error creating group booking:", error);
      Alert.alert("Booking Failed", error.message || "Failed to create group booking");
    } finally {
      setSubmitting(false);
    }
  }, [restaurant, profile, groupMembers, splitBillOption, mezzeOption, selectedOccasion, date, time, router]);

  // 11. Member Management Modal
  const MemberModal = () => (
    <Modal
      visible={showMemberModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowMemberModal(false)}
    >
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 p-4">
          <View className="flex-row justify-between items-center mb-6">
            <H2>Add Group Members</H2>
            <Pressable onPress={() => setShowMemberModal(false)}>
              <X size={24} />
            </Pressable>
          </View>

          <Button
            variant="outline"
            onPress={importFromContacts}
            className="mb-4 flex-row items-center"
          >
            <UserPlus size={18} className="mr-2" />
            <Text>Import from Contacts</Text>
          </Button>

          <ScrollView>
            {groupMembers.map((member, index) => (
              <View key={member.id} className="mb-4 p-4 bg-muted rounded-lg">
                <FormInput
                  placeholder="Name"
                  value={member.name}
                  onChangeText={(text) => {
                    const updated = [...groupMembers];
                    updated[index].name = text;
                    setGroupMembers(updated);
                  }}
                  className="mb-2"
                />
                <FormInput
                  placeholder="Email (optional)"
                  value={member.email}
                  onChangeText={(text) => {
                    const updated = [...groupMembers];
                    updated[index].email = text;
                    setGroupMembers(updated);
                  }}
                  keyboardType="email-address"
                  className="mb-2"
                />
                <FormInput
                  placeholder="Phone (optional)"
                  value={member.phone}
                  onChangeText={(text) => {
                    const updated = [...groupMembers];
                    updated[index].phone = text;
                    setGroupMembers(updated);
                  }}
                  keyboardType="phone-pad"
                />
              </View>
            ))}
          </ScrollView>

          <Button onPress={() => setShowMemberModal(false)} className="mt-4">
            <Text>Done</Text>
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );

  // 12. Lifecycle
  useEffect(() => {
    fetchRestaurant();
  }, [fetchRestaurant]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // 13. Main Render
  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1">
          {/* Header */}
          <View className="p-4 border-b border-border">
            <H1>Create Group Booking</H1>
            <Muted>{restaurant?.name}</Muted>
          </View>

          {/* Occasion Selection */}
          <View className="p-4">
            <H3 className="mb-3">What's the occasion?</H3>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {LEBANESE_GROUP_OCCASIONS.map((occasion) => (
                <Pressable
                  key={occasion.id}
                  onPress={() => {
                    setSelectedOccasion(occasion.id);
                    form.setValue("occasion", occasion.id);
                    form.setValue("totalPartySize", occasion.suggestedSize);
                  }}
                  className={`mr-3 p-4 rounded-lg border ${
                    selectedOccasion === occasion.id
                      ? "border-primary bg-primary/10"
                      : "border-border"
                  }`}
                >
                  <Text className="text-2xl mb-1">{occasion.icon}</Text>
                  <Text className="font-semibold">{occasion.label}</Text>
                  <Muted className="text-xs">~{occasion.suggestedSize} people</Muted>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Group Details */}
          <View className="p-4">
            <H3 className="mb-3">Group Details</H3>
            <FormField
              control={form.control}
              name="groupName"
              render={({ field }) => (
                <FormInput
                  {...field}
                  placeholder="Give your group a name"
                  className="mb-4"
                />
              )}
            />

            {/* Group Members */}
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="font-semibold">Group Members ({groupMembers.length})</Text>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={addGroupMember}
                  className="flex-row items-center"
                >
                  <Plus size={16} className="mr-1" />
                  <Text>Add</Text>
                </Button>
              </View>

              {groupMembers.map((member) => (
                <View
                  key={member.id}
                  className="flex-row items-center p-3 bg-muted rounded-lg mb-2"
                >
                  <View className="flex-1">
                    <Text className="font-medium">{member.name}</Text>
                    {member.email && <Muted className="text-xs">{member.email}</Muted>}
                  </View>
                  <View className={`px-2 py-1 rounded-full ${
                    member.status === "organizer" ? "bg-primary/20" :
                    member.status === "accepted" ? "bg-green-500/20" :
                    member.status === "declined" ? "bg-red-500/20" :
                    "bg-yellow-500/20"
                  }`}>
                    <Text className="text-xs capitalize">{member.status}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Mezze Selection */}
          <View className="p-4">
            <H3 className="mb-3">Mezze Sharing</H3>
            <Text className="text-sm text-muted-foreground mb-3">
              Pre-select mezze platters to share with the group
            </Text>
            {MEZZE_SHARING_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => setMezzeOption(option.id)}
                className={`p-4 rounded-lg border mb-2 ${
                  mezzeOption === option.id
                    ? "border-primary bg-primary/10"
                    : "border-border"
                }`}
              >
                <Text className="font-semibold mb-1">{option.label}</Text>
                <Muted className="text-sm">{option.description}</Muted>
              </Pressable>
            ))}
          </View>

          {/* Split Bill Options */}
          <View className="p-4">
            <H3 className="mb-3">Bill Splitting</H3>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setSplitBillOption({ type: "equal" })}
                className={`flex-1 p-3 rounded-lg border ${
                  splitBillOption.type === "equal"
                    ? "border-primary bg-primary/10"
                    : "border-border"
                }`}
              >
                <Text className="text-center">Split Equally</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowSplitModal(true)}
                className={`flex-1 p-3 rounded-lg border ${
                  splitBillOption.type === "custom"
                    ? "border-primary bg-primary/10"
                    : "border-border"
                }`}
              >
                <Text className="text-center">Custom Split</Text>
              </Pressable>
            </View>
          </View>

          {/* Special Requests */}
          <View className="p-4">
            <FormField
              control={form.control}
              name="specialRequests"
              render={({ field }) => (
                <FormTextarea
                  {...field}
                  placeholder="Any special requests for the group?"
                  numberOfLines={3}
                />
              )}
            />
          </View>

          {/* Terms */}
          <View className="p-4">
            <FormField
              control={form.control}
              name="acceptTerms"
              render={({ field }) => (
                <View className="flex-row items-start">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mr-2 mt-1"
                  />
                  <Text className="flex-1 text-sm">
                    I understand that group bookings may require a deposit and have
                    specific cancellation policies
                  </Text>
                </View>
              )}
            />
          </View>

          {/* Submit Button */}
          <View className="p-4 pb-8">
            <Button
              onPress={form.handleSubmit(submitGroupBooking)}
              disabled={submitting}
              className="w-full"
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text>Create Group Booking</Text>
              )}
            </Button>
          </View>
        </ScrollView>

        {/* Modals */}
        <MemberModal />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}