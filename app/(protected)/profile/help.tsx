// app/(protected)/profile/help.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  HelpCircle,
  MessageCircle,
  Phone,
  Mail,
  ExternalLink,
  Search,
  ChevronRight,
  ChevronDown,
  Book,
  CreditCard,
  Calendar,
  Star,
  Shield,
  Users,
  Settings,
  Smartphone,
  Globe,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react-native";
import { FontAwesome } from "@expo/vector-icons";

import HelpScreenSkeleton from "@/components/skeletons/HelpScreenSkeleton";
import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { getRefreshControlColor } from "@/lib/utils";

// 1. Type Definitions for Help System
interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  helpful_count: number;
  tags: string[];
}

interface HelpCategory {
  id: string;
  name: string;
  icon: any;
  description: string;
  faqCount: number;
}

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  created_at: string;
  updated_at: string;
}

interface ContactMethod {
  id: string;
  type: "email" | "phone" | "chat" | "whatsapp";
  title: string;
  subtitle: string;
  value: string;
  icon: any;
  available: boolean;
  hours?: string;
}

// 2. Help System Configuration
const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: "booking",
    name: "Bookings & Reservations",
    icon: Calendar,
    description: "Making, modifying, and managing restaurant reservations",
    faqCount: 12,
  },
  {
    id: "payments",
    name: "Payments & Billing",
    icon: CreditCard,
    description: "Payment methods, billing issues, and refunds",
    faqCount: 8,
  },
  {
    id: "account",
    name: "Account & Profile",
    icon: Users,
    description: "Managing your profile, preferences, and settings",
    faqCount: 15,
  },
  {
    id: "reviews",
    name: "Reviews & Ratings",
    icon: Star,
    description: "Writing reviews, ratings, and feedback guidelines",
    faqCount: 6,
  },
  {
    id: "app",
    name: "App Features",
    icon: Smartphone,
    description: "App functionality, navigation, and troubleshooting",
    faqCount: 10,
  },
  {
    id: "privacy",
    name: "Privacy & Security",
    icon: Shield,
    description: "Data protection, privacy settings, and security",
    faqCount: 7,
  },
];

const CONTACT_METHODS: ContactMethod[] = [
  {
    id: "chat",
    type: "chat",
    title: "Live Chat",
    subtitle: "Chat with our support team",
    value: "chat",
    icon: MessageCircle,
    available: true,
    hours: "9 AM - 11 PM daily",
  },
  {
    id: "email",
    type: "email",
    title: "Email Support",
    subtitle: "Get help via email",
    value: "support@tablereserve.com",
    icon: Mail,
    available: true,
    hours: "Response within 24 hours",
  },
  {
    id: "phone",
    type: "phone",
    title: "Phone Support",
    subtitle: "Call our support line",
    value: "+1 (555) 123-4567",
    icon: Phone,
    available: true,
    hours: "9 AM - 9 PM daily",
  },
  {
    id: "whatsapp",
    type: "whatsapp",
    title: "WhatsApp",
    subtitle: "Message us on WhatsApp",
    value: "+1 (555) 987-6543",
    icon: MessageCircle,
    available: true,
    hours: "24/7 automated responses",
  },
];

const SAMPLE_FAQS: FAQItem[] = [
  {
    id: "1",
    category: "booking",
    question: "How do I make a restaurant reservation?",
    answer:
      "To make a reservation, browse restaurants, select your preferred date and time, choose party size, and confirm your booking. You'll receive a confirmation email and reminder notifications.",
    helpful_count: 45,
    tags: ["reservation", "booking", "how-to"],
  },
  {
    id: "2",
    category: "booking",
    question: "Can I modify or cancel my reservation?",
    answer:
      "Yes! You can modify or cancel reservations up to 2 hours before your booking time. Go to 'My Bookings' in your profile, select the reservation, and choose 'Modify' or 'Cancel'.",
    helpful_count: 38,
    tags: ["cancel", "modify", "change"],
  },
  {
    id: "3",
    category: "payments",
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, MasterCard, American Express), debit cards, PayPal, Apple Pay, and Google Pay. Some restaurants may require a deposit at booking.",
    helpful_count: 22,
    tags: ["payment", "credit-card", "methods"],
  },
  {
    id: "4",
    category: "account",
    question: "How do I update my profile information?",
    answer:
      "Go to your Profile tab, tap 'Edit Profile', update your information, and save changes. You can update your name, email, phone number, dietary preferences, and profile picture.",
    helpful_count: 31,
    tags: ["profile", "edit", "update"],
  },
  {
    id: "5",
    category: "reviews",
    question: "How do I leave a review for a restaurant?",
    answer:
      "After dining, you'll receive a notification to review your experience. You can also go to 'My Bookings', find your completed reservation, and tap 'Write Review'.",
    helpful_count: 28,
    tags: ["review", "rating", "feedback"],
  },
];

export default function HelpScreen() {
  // 3. State Management Architecture
  const { profile, user } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  // 3.1 FAQ and Search State
  const [faqs, setFaqs] = useState<FAQItem[]>(SAMPLE_FAQS);
  const [filteredFaqs, setFilteredFaqs] = useState<FAQItem[]>(SAMPLE_FAQS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedFaqs, setExpandedFaqs] = useState<Set<string>>(new Set());

  // 3.2 Support Ticket State
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);

  // 3.3 UI State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"faq" | "contact" | "tickets">(
    "faq",
  );

  // 4. FAQ Search and Filtering
  const searchFAQs = useCallback(
    (query: string, category?: string) => {
      let filtered = faqs;

      if (category) {
        filtered = filtered.filter((faq) => faq.category === category);
      }

      if (query.trim()) {
        const searchTerm = query.toLowerCase();
        filtered = filtered.filter(
          (faq) =>
            faq.question.toLowerCase().includes(searchTerm) ||
            faq.answer.toLowerCase().includes(searchTerm) ||
            faq.tags.some((tag) => tag.toLowerCase().includes(searchTerm)),
        );
      }

      setFilteredFaqs(filtered);
    },
    [faqs],
  );

  useEffect(() => {
    searchFAQs(searchQuery, selectedCategory || undefined);
  }, [searchQuery, selectedCategory, searchFAQs]);

  // 5. FAQ Management
  const toggleFAQ = useCallback((faqId: string) => {
    setExpandedFaqs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(faqId)) {
        newSet.delete(faqId);
      } else {
        newSet.add(faqId);
      }
      return newSet;
    });
  }, []);

  const markFAQHelpful = useCallback(async (faqId: string) => {
    try {
      // Update local state immediately
      setFaqs((prev) =>
        prev.map((faq) =>
          faq.id === faqId
            ? { ...faq, helpful_count: faq.helpful_count + 1 }
            : faq,
        ),
      );

      // In a real app, this would update the backend
      console.log(`Marked FAQ ${faqId} as helpful`);
    } catch (error) {
      console.error("Error marking FAQ as helpful:", error);
    }
  }, []);

  // 6. Support Ticket Management
  const submitSupportTicket = useCallback(async () => {
    if (!contactSubject.trim() || !contactMessage.trim()) {
      Alert.alert("Error", "Please fill in both subject and message");
      return;
    }

    setSubmittingTicket(true);
    try {
      const newTicket: SupportTicket = {
        id: Date.now().toString(),
        subject: contactSubject,
        description: contactMessage,
        status: "open",
        priority: "medium",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // In a real app, this would be sent to the backend
      setSupportTickets((prev) => [newTicket, ...prev]);
      setContactSubject("");
      setContactMessage("");
      setShowContactForm(false);

      Alert.alert(
        "Ticket Submitted",
        "Your support request has been submitted. We'll get back to you within 24 hours.",
        [{ text: "OK", onPress: () => setActiveTab("tickets") }],
      );
    } catch (error) {
      console.error("Error submitting support ticket:", error);
      Alert.alert("Error", "Failed to submit support ticket");
    } finally {
      setSubmittingTicket(false);
    }
  }, [contactSubject, contactMessage]);

  // 7. Contact Method Handlers
  const handleContactMethod = useCallback(async (method: ContactMethod) => {
    try {
      switch (method.type) {
        case "email":
          await Linking.openURL(`mailto:${method.value}`);
          break;
        case "phone":
          await Linking.openURL(`tel:${method.value}`);
          break;
        case "whatsapp":
          await Linking.openURL(
            `whatsapp://send?phone=${method.value.replace(/\D/g, "")}`,
          );
          break;
        case "chat":
          // Open in-app chat
          Alert.alert("Live Chat", "Opening live chat...");
          break;
        default:
          Alert.alert(
            "Coming Soon",
            "This contact method will be available soon",
          );
      }
    } catch (error) {
      console.error("Error opening contact method:", error);
      Alert.alert("Error", "Unable to open this contact method");
    }
  }, []);

  // 8. Data Fetching
  const fetchHelpData = useCallback(async () => {
    try {
      // In a real app, fetch FAQs and support tickets from backend
      // For now, we'll use the sample data
      setFaqs(SAMPLE_FAQS);
      setFilteredFaqs(SAMPLE_FAQS);
    } catch (error) {
      console.error("Error fetching help data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 9. Lifecycle Management
  useEffect(() => {
    fetchHelpData();
  }, [fetchHelpData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHelpData();
  }, [fetchHelpData]);

  // 10. Render Components
  const renderFAQItem = (faq: FAQItem) => {
    const isExpanded = expandedFaqs.has(faq.id);

    return (
      <View
        key={faq.id}
        className="bg-card mx-4 mb-3 rounded-xl overflow-hidden"
      >
        <Pressable
          onPress={() => toggleFAQ(faq.id)}
          className="p-4 flex-row items-center justify-between"
        >
          <View className="flex-1 pr-3">
            <Text className="font-medium">{faq.question}</Text>
            <View className="flex-row items-center gap-2 mt-1">
              <Muted className="text-xs">
                {faq.helpful_count} people found this helpful
              </Muted>
            </View>
          </View>
          <View
            className={`transform ${isExpanded ? "rotate-180" : "rotate-0"}`}
          >
            <ChevronDown size={20} color="#666" />
          </View>
        </Pressable>

        {isExpanded && (
          <View className="px-4 pb-4 border-t border-border">
            <P className="text-sm mt-3 mb-4">{faq.answer}</P>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">
                Was this helpful?
              </Text>
              <Pressable
                onPress={() => markFAQHelpful(faq.id)}
                className="flex-row items-center gap-1 bg-primary/10 px-3 py-1 rounded-full"
              >
                <CheckCircle size={14} color="#3b82f6" />
                <Text className="text-xs text-primary">Yes, helpful</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderContactMethod = (method: ContactMethod) => (
    <Pressable
      key={method.id}
      onPress={() => handleContactMethod(method)}
      className="bg-card mx-4 mb-3 rounded-xl p-4 flex-row items-center"
    >
      <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center">
        {method.type === "whatsapp" ? (
          <FontAwesome name="whatsapp" size={24} color="#25D366" />
        ) : (
          <method.icon size={24} color="#3b82f6" />
        )}
      </View>
      <View className="flex-1 ml-3">
        <Text className="font-medium">{method.title}</Text>
        <Muted className="text-sm">{method.subtitle}</Muted>
        {method.hours && <Muted className="text-xs mt-1">{method.hours}</Muted>}
      </View>
      <View className="flex-row items-center gap-2">
        {method.available && (
          <View className="w-2 h-2 bg-green-500 rounded-full" />
        )}
        <ChevronRight size={20} color="#666" />
      </View>
    </Pressable>
  );

  const renderSupportTicket = (ticket: SupportTicket) => {
    const statusColors = {
      open: "#f59e0b",
      in_progress: "#3b82f6",
      resolved: "#10b981",
      closed: "#6b7280",
    };

    return (
      <View key={ticket.id} className="bg-card mx-4 mb-3 rounded-xl p-4">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1">
            <Text className="font-medium">{ticket.subject}</Text>
            <Muted className="text-sm mt-1">{ticket.description}</Muted>
          </View>
          <View className="flex-row items-center gap-1 bg-muted px-2 py-1 rounded-full">
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusColors[ticket.status] }}
            />
            <Text className="text-xs capitalize">
              {ticket.status.replace("_", " ")}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <Muted className="text-xs">
            Created {new Date(ticket.created_at).toLocaleDateString()}
          </Muted>
          <Pressable className="flex-row items-center gap-1">
            <Text className="text-xs text-primary">View Details</Text>
            <ChevronRight size={14} color="#3b82f6" />
          </Pressable>
        </View>
      </View>
    );
  };

  if (loading) {
    return <HelpScreenSkeleton />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* 11.1 Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft
            size={24}
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
        </Pressable>
        <H2>Help & Support</H2>
        <View className="w-10" />
      </View>

      {/* 11.2 Tab Navigation */}
      <View className="flex-row bg-muted mx-4 mt-4 rounded-lg p-1">
        {[
          { id: "faq", label: "FAQ", icon: HelpCircle },
          { id: "contact", label: "Contact", icon: MessageCircle },
          { id: "tickets", label: "My Tickets", icon: Clock },
        ].map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex-row items-center justify-center py-2 px-3 rounded-md ${
              activeTab === tab.id ? "bg-background shadow-sm" : ""
            }`}
          >
            <tab.icon
              size={16}
              color={
                activeTab === tab.id
                  ? colorScheme === "dark"
                    ? "#fff"
                    : "#000"
                  : "#666"
              }
            />
            <Text
              className={`ml-2 text-sm ${
                activeTab === tab.id ? "font-medium" : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={getRefreshControlColor(colorScheme)}
          />
        }
      >
        {/* 11.3 FAQ Tab */}
        {activeTab === "faq" && (
          <>
            {/* Search Bar */}
            <View className="mx-4 mt-4 mb-3">
              <View className="flex-row items-center bg-card rounded-lg px-3 py-2 border border-border">
                <Search size={20} color="#666" />
                <TextInput
                  placeholder="Search for help..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  className="flex-1 ml-3 text-foreground"
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            {/* Category Filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
              contentContainerStyle={{ paddingHorizontal: 16 }}
            >
              <Pressable
                onPress={() => setSelectedCategory(null)}
                className={`mr-3 px-4 py-2 rounded-full ${
                  !selectedCategory
                    ? "bg-primary"
                    : "bg-card border border-border"
                }`}
              >
                <Text
                  className={`text-sm ${
                    !selectedCategory
                      ? "text-primary-foreground font-medium"
                      : "text-foreground"
                  }`}
                >
                  All
                </Text>
              </Pressable>
              {HELP_CATEGORIES.map((category) => (
                <Pressable
                  key={category.id}
                  onPress={() => setSelectedCategory(category.id)}
                  className={`mr-3 px-4 py-2 rounded-full ${
                    selectedCategory === category.id
                      ? "bg-primary"
                      : "bg-card border border-border"
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      selectedCategory === category.id
                        ? "text-primary-foreground font-medium"
                        : "text-foreground"
                    }`}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Help Categories */}
            {!searchQuery && !selectedCategory && (
              <>
                <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mb-3">
                  Browse by Category
                </Text>
                {HELP_CATEGORIES.map((category) => (
                  <Pressable
                    key={category.id}
                    onPress={() => setSelectedCategory(category.id)}
                    className="bg-card mx-4 mb-3 rounded-xl p-4 flex-row items-center"
                  >
                    <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center">
                      <category.icon size={24} color="#3b82f6" />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text className="font-medium">{category.name}</Text>
                      <Muted className="text-sm">{category.description}</Muted>
                      <Muted className="text-xs mt-1">
                        {category.faqCount} articles
                      </Muted>
                    </View>
                    <ChevronRight size={20} color="#666" />
                  </Pressable>
                ))}
              </>
            )}

            {/* FAQ Results */}
            {(searchQuery || selectedCategory) && (
              <>
                <View className="flex-row items-center justify-between px-4 mb-3">
                  <Text className="text-sm font-semibold text-muted-foreground uppercase">
                    {selectedCategory
                      ? HELP_CATEGORIES.find((c) => c.id === selectedCategory)
                          ?.name
                      : "Search Results"}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {filteredFaqs.length}{" "}
                    {filteredFaqs.length === 1 ? "result" : "results"}
                  </Text>
                </View>
                {filteredFaqs.map(renderFAQItem)}
                {filteredFaqs.length === 0 && (
                  <View className="items-center py-12">
                    <AlertCircle size={48} color="#666" strokeWidth={1} />
                    <Text className="mt-4 text-center font-medium">
                      No results found
                    </Text>
                    <Muted className="mt-2 text-center px-8">
                      Try adjusting your search terms or browse categories above
                    </Muted>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* 11.4 Contact Tab */}
        {activeTab === "contact" && (
          <>
            <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mt-6 mb-3">
              Get in Touch
            </Text>
            {CONTACT_METHODS.map(renderContactMethod)}

            {/* Contact Form */}
            <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mt-6 mb-3">
              Send us a Message
            </Text>
            <View className="bg-card mx-4 mb-6 rounded-xl p-4">
              <TextInput
                placeholder="Subject"
                value={contactSubject}
                onChangeText={setContactSubject}
                className="border border-border rounded-lg px-3 py-3 mb-3 text-foreground"
                placeholderTextColor="#666"
              />
              <TextInput
                placeholder="Describe your issue or question..."
                value={contactMessage}
                onChangeText={setContactMessage}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                className="border border-border rounded-lg px-3 py-3 mb-4 text-foreground"
                placeholderTextColor="#666"
              />
              <Button
                onPress={submitSupportTicket}
                disabled={
                  submittingTicket ||
                  !contactSubject.trim() ||
                  !contactMessage.trim()
                }
              >
                <View className="flex-row items-center justify-center gap-2">
                  <Send size={16} color="white" />
                  <Text className="text-primary-foreground">
                    {submittingTicket ? "Sending..." : "Send Message"}
                  </Text>
                </View>
              </Button>
            </View>
          </>
        )}

        {/* 11.5 Support Tickets Tab */}
        {activeTab === "tickets" && (
          <>
            <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mt-6 mb-3">
              Your Support Requests
            </Text>
            {supportTickets.length > 0 ? (
              supportTickets.map(renderSupportTicket)
            ) : (
              <View className="items-center py-12">
                <Clock size={48} color="#666" strokeWidth={1} />
                <Text className="mt-4 text-center font-medium">
                  No support tickets
                </Text>
                <Muted className="mt-2 text-center px-8">
                  When you contact support, your tickets will appear here
                </Muted>
                <Button
                  variant="outline"
                  className="mt-4"
                  onPress={() => setActiveTab("contact")}
                >
                  <Text>Contact Support</Text>
                </Button>
              </View>
            )}
          </>
        )}

        {/* 11.6 Legal Documents */}
        <View className="mt-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mb-3">
            Legal Documents
          </Text>

          {[
            {
              title: "Privacy Policy",
              subtitle: "How we protect your personal information",
              icon: Shield,
              onPress: () => router.push("/legal/PRIVACY_POLICY"),
            },
            {
              title: "Terms of Service",
              subtitle: "Rules and guidelines for using our service",
              icon: Book,
              onPress: () => router.push("/legal/TERMS_OF_SERVICE"),
            },
            {
              title: "Community Guidelines",
              subtitle: "Standards for respectful community interaction",
              icon: Users,
              onPress: () => router.push("/legal/COMMUNITY_GUIDELINES"),
            },
            {
              title: "All Legal Documents",
              subtitle: "View all policies and legal information",
              icon: ExternalLink,
              onPress: () => router.push("/legal"),
            },
          ].map((resource, index) => (
            <Pressable
              key={index}
              onPress={resource.onPress}
              className="bg-card mx-4 mb-3 rounded-xl p-4 flex-row items-center"
            >
              <View className="w-10 h-10 bg-muted rounded-full items-center justify-center">
                <resource.icon size={20} color="#666" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="font-medium">{resource.title}</Text>
                <Muted className="text-sm">{resource.subtitle}</Muted>
              </View>
              <ChevronRight size={20} color="#666" />
            </Pressable>
          ))}
        </View>

        {/* 11.7 Additional Resources */}
        <View className="mt-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mb-3">
            Additional Resources
          </Text>

          {[
            {
              title: "User Guide",
              subtitle: "Complete app walkthrough",
              icon: Book,
              onPress: () => Alert.alert("User Guide", "Opening user guide..."),
            },
            {
              title: "App Status",
              subtitle: "Check service status",
              icon: Globe,
              onPress: () => Alert.alert("Status", "All services operational"),
            },
          ].map((resource, index) => (
            <Pressable
              key={index}
              onPress={resource.onPress}
              className="bg-card mx-4 mb-3 rounded-xl p-4 flex-row items-center"
            >
              <View className="w-10 h-10 bg-muted rounded-full items-center justify-center">
                <resource.icon size={20} color="#666" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="font-medium">{resource.title}</Text>
                <Muted className="text-sm">{resource.subtitle}</Muted>
              </View>
              <ExternalLink size={20} color="#666" />
            </Pressable>
          ))}
        </View>

        {/* 11.8 Footer */}
        <View className="items-center py-8">
          <Muted className="text-xs text-center">
            Still need help? Our support team is here 24/7
          </Muted>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
