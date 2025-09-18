import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
} from "react-native";
import {
  Gift,
  Sparkles,
  Tag,
  Clock,
  Users,
  Calendar,
  X,
  CheckCircle,
  QrCode,
  ChevronDown,
  ChevronUp,
  Star,
  MapPin,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Image } from "@/components/image";
import { useColorScheme } from "@/lib/useColorScheme";
import { useOffers, EnrichedOffer } from "@/hooks/useOffers";

interface InlineOfferSelectorProps {
  restaurantId: string;
  onOfferSelect: (
    offer: {
      id: string;
      title: string;
      discount: number;
      redemptionCode: string;
    } | null,
  ) => void;
  selectedOfferId?: string | null;
  disabled?: boolean;
}

export const InlineOfferSelector: React.FC<InlineOfferSelectorProps> = ({
  restaurantId,
  onOfferSelect,
  selectedOfferId,
  disabled = false,
}) => {
  const { colorScheme } = useColorScheme();
  const { offers, loading, claimOffer, canClaimOffer } = useOffers();

  const [isExpanded, setIsExpanded] = useState(false);
  const [processingOfferId, setProcessingOfferId] = useState<string | null>(
    null,
  );
  const [showOfferDetails, setShowOfferDetails] = useState(false);
  const [selectedOfferForDetails, setSelectedOfferForDetails] =
    useState<EnrichedOffer | null>(null);

  // Filter offers for the current restaurant
  const restaurantOffers = useMemo(() => {
    return offers.filter(
      (offer) =>
        offer.restaurant_id === restaurantId &&
        !offer.isExpired &&
        new Date(offer.valid_until) > new Date(),
    );
  }, [offers, restaurantId]);

  // Separate claimed and unclaimed offers
  const { claimedOffers, unclaimedOffers } = useMemo(() => {
    const claimed = restaurantOffers.filter((offer) => offer.claimed);
    const unclaimed = restaurantOffers.filter((offer) => !offer.claimed);
    return { claimedOffers: claimed, unclaimedOffers: unclaimed };
  }, [restaurantOffers]);

  const handleClaimOffer = useCallback(
    async (offer: EnrichedOffer) => {
      if (processingOfferId === offer.id || disabled) return;

      const claimCheck = canClaimOffer(offer);
      if (!claimCheck.canClaim) {
        Alert.alert(
          "Cannot Claim Offer",
          claimCheck.reason === "already_claimed"
            ? "This offer has already been claimed"
            : "This offer has expired",
        );
        return;
      }

      setProcessingOfferId(offer.id);

      try {
        await claimOffer(offer.id);
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );

        // Auto-select the newly claimed offer
        onOfferSelect({
          id: offer.id,
          title: offer.title,
          discount: offer.discount_percentage || 0,
          redemptionCode: offer.id, // Will be updated after claiming
        });

        Alert.alert(
          "Offer Claimed! 🎉",
          `You've successfully claimed ${offer.discount_percentage}% off! This offer has been applied to your booking.`,
          [{ text: "Continue", style: "default" }],
        );
      } catch (err: any) {
        console.error("Error claiming offer:", err);
        Alert.alert(
          "Error",
          err.message || "Failed to claim offer. Please try again.",
        );
      } finally {
        setProcessingOfferId(null);
      }
    },
    [processingOfferId, disabled, canClaimOffer, claimOffer, onOfferSelect],
  );

  const handleSelectOffer = useCallback(
    (offer: EnrichedOffer) => {
      if (disabled) return;

      if (!offer.claimed) {
        handleClaimOffer(offer);
        return;
      }

      if (!offer.canUse) {
        Alert.alert(
          "Offer Not Available",
          offer.used
            ? "This offer has already been used"
            : "This offer has expired",
        );
        return;
      }

      // Toggle selection
      if (selectedOfferId === offer.id) {
        onOfferSelect(null);
      } else {
        onOfferSelect({
          id: offer.id,
          title: offer.title,
          discount: offer.discount_percentage || 0,
          redemptionCode: offer.redemptionCode || offer.id,
        });
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [disabled, selectedOfferId, onOfferSelect, handleClaimOffer],
  );

  const handleViewDetails = useCallback((offer: EnrichedOffer) => {
    setSelectedOfferForDetails(offer);
    setShowOfferDetails(true);
  }, []);

  const getOfferStatusColor = useCallback((offer: EnrichedOffer) => {
    if (offer.used) return "text-gray-500";
    if (offer.isExpired) return "text-red-500";
    if (offer.claimed) return "text-blue-500";
    return "text-green-500";
  }, []);

  const getOfferStatusText = useCallback((offer: EnrichedOffer) => {
    if (offer.used) return "Used";
    if (offer.isExpired) return "Expired";
    if (offer.claimed) return `${offer.daysUntilExpiry}d left`;
    return "Available";
  }, []);

  if (loading) {
    return (
      <View className="bg-card border border-border rounded-xl p-4">
        <View className="flex-row items-center justify-center gap-2">
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text className="text-muted-foreground">Loading offers...</Text>
        </View>
      </View>
    );
  }

  if (restaurantOffers.length === 0) {
    return null; // Don't show anything if no offers available
  }

  const OfferCard = ({ offer }: { offer: EnrichedOffer }) => {
    const isSelected = selectedOfferId === offer.id;
    const canSelect = offer.claimed ? offer.canUse : true;
    const isProcessing = processingOfferId === offer.id;

    return (
      <Pressable
        onPress={() => canSelect && handleSelectOffer(offer)}
        disabled={!canSelect || isProcessing}
        className={`border-2 rounded-xl p-4 mb-3 ${
          isSelected
            ? "border-primary bg-primary/10"
            : canSelect
              ? "border-border bg-card"
              : "border-border bg-muted/50"
        } ${!canSelect ? "opacity-60" : ""}`}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            {/* Discount badge */}
            <View className="flex-row items-center gap-2 mb-2">
              <View
                className={`rounded-full px-3 py-1 ${
                  isSelected ? "bg-primary" : "bg-green-500"
                }`}
              >
                <Text className="text-white font-bold text-sm">
                  {offer.discount_percentage}% OFF
                </Text>
              </View>
              <Text
                className={`text-xs font-medium ${getOfferStatusColor(offer)}`}
              >
                {getOfferStatusText(offer)}
              </Text>
            </View>

            {/* Offer title */}
            <Text className="font-semibold text-base mb-1" numberOfLines={2}>
              {offer.title}
            </Text>

            {/* Description */}
            {offer.description && (
              <Text
                className="text-sm text-muted-foreground mb-2"
                numberOfLines={2}
              >
                {offer.description}
              </Text>
            )}

            {/* Metadata */}
            <View className="flex-row flex-wrap gap-2">
              <View className="flex-row items-center bg-muted/50 rounded-full px-2 py-1">
                <Calendar size={12} color="#666" />
                <Text className="text-xs text-muted-foreground ml-1">
                  Until {new Date(offer.valid_until).toLocaleDateString()}
                </Text>
              </View>
              {offer.minimum_party_size > 1 && (
                <View className="flex-row items-center bg-muted/50 rounded-full px-2 py-1">
                  <Users size={12} color="#666" />
                  <Text className="text-xs text-muted-foreground ml-1">
                    {offer.minimum_party_size}+ people
                  </Text>
                </View>
              )}
              {offer.claimed && offer.redemptionCode && (
                <View className="flex-row items-center bg-blue-50 dark:bg-blue-900/30 rounded-full px-2 py-1">
                  <QrCode size={12} color="#2563eb" />
                  <Text className="text-xs text-blue-700 dark:text-blue-300 ml-1">
                    Code: {offer.redemptionCode.slice(-6).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Action area */}
          <View className="items-end">
            {isProcessing ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : isSelected ? (
              <View className="bg-primary rounded-full p-2">
                <CheckCircle size={20} color="white" />
              </View>
            ) : !offer.claimed ? (
              <View className="bg-green-500 rounded-full p-2">
                <Tag size={20} color="white" />
              </View>
            ) : offer.canUse ? (
              <View className="bg-blue-500 rounded-full p-2">
                <Gift size={20} color="white" />
              </View>
            ) : (
              <View className="bg-gray-400 rounded-full p-2">
                <X size={20} color="white" />
              </View>
            )}

            {/* Details button */}
            <Pressable
              onPress={() => handleViewDetails(offer)}
              className="mt-2 px-2 py-1 bg-muted rounded-full"
            >
              <Text className="text-xs text-muted-foreground">Details</Text>
            </Pressable>
          </View>
        </View>

        {/* Action text */}
        <View className="mt-3 pt-3 border-t border-border">
          <Text className="text-sm font-medium text-center">
            {isSelected
              ? "✓ Applied to booking"
              : !offer.claimed
                ? "Tap to claim and apply"
                : offer.canUse
                  ? "Tap to apply to booking"
                  : offer.used
                    ? "Already used"
                    : "Expired"}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <View
        className={`bg-card border border-border rounded-xl p-4 ${disabled ? "opacity-60" : ""}`}
      >
        {/* Header */}
        <Pressable
          onPress={() => !disabled && setIsExpanded(!isExpanded)}
          disabled={disabled}
          className="flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-3">
            <Sparkles size={20} color="#3b82f6" />
            <View>
              <Text className="font-semibold text-lg">Special Offers</Text>
              <Text className="text-sm text-muted-foreground">
                {restaurantOffers.length} offer
                {restaurantOffers.length !== 1 ? "s" : ""} available
                {selectedOfferId && " • 1 selected"}
              </Text>
            </View>
          </View>
          {!disabled &&
            (isExpanded ? (
              <ChevronUp size={20} color="#3b82f6" />
            ) : (
              <ChevronDown size={20} color="#3b82f6" />
            ))}
        </Pressable>

        {/* Selected offer summary when collapsed */}
        {!isExpanded && selectedOfferId && (
          <View className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
            {(() => {
              const selectedOffer = restaurantOffers.find(
                (o) => o.id === selectedOfferId,
              );
              if (!selectedOffer) return null;
              return (
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text
                      className="font-medium text-primary"
                      numberOfLines={1}
                    >
                      {selectedOffer.title}
                    </Text>
                    <Text className="text-sm text-primary/80">
                      {selectedOffer.discount_percentage}% discount applied
                    </Text>
                  </View>
                  <View className="bg-primary rounded-full p-1">
                    <CheckCircle size={16} color="white" />
                  </View>
                </View>
              );
            })()}
          </View>
        )}

        {/* Expanded offer list */}
        {isExpanded && (
          <View className="mt-4">
            {claimedOffers.length > 0 && (
              <View className="mb-4">
                <Text className="font-medium text-sm text-muted-foreground mb-3">
                  MY OFFERS ({claimedOffers.length})
                </Text>
                {claimedOffers.map((offer) => (
                  <OfferCard key={`claimed-${offer.id}`} offer={offer} />
                ))}
              </View>
            )}

            {unclaimedOffers.length > 0 && (
              <View>
                <Text className="font-medium text-sm text-muted-foreground mb-3">
                  AVAILABLE TO CLAIM ({unclaimedOffers.length})
                </Text>
                {unclaimedOffers.map((offer) => (
                  <OfferCard key={`unclaimed-${offer.id}`} offer={offer} />
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Offer Details Modal */}
      <Modal
        visible={showOfferDetails}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOfferDetails(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-card rounded-t-2xl p-6 max-h-[80%]">
            {selectedOfferForDetails && (
              <>
                {/* Header */}
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="font-bold text-xl">Offer Details</Text>
                  <Pressable
                    onPress={() => setShowOfferDetails(false)}
                    className="p-1"
                  >
                    <X
                      size={24}
                      color={colorScheme === "dark" ? "#fff" : "#000"}
                    />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Restaurant info */}
                  <View className="flex-row items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
                    <Image
                      source={{
                        uri: selectedOfferForDetails.restaurant.main_image_url,
                      }}
                      className="w-12 h-12 rounded-lg"
                      contentFit="cover"
                    />
                    <View className="flex-1">
                      <Text className="font-semibold">
                        {selectedOfferForDetails.restaurant.name}
                      </Text>
                      <View className="flex-row items-center gap-1">
                        <Star size={12} color="#f59e0b" fill="#f59e0b" />
                        <Text className="text-sm text-muted-foreground">
                          {selectedOfferForDetails.restaurant.average_rating?.toFixed(
                            1,
                          )}{" "}
                          • {selectedOfferForDetails.restaurant.cuisine_type}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Offer info */}
                  <View className="mb-4">
                    <View className="flex-row items-center gap-2 mb-2">
                      <View className="bg-green-500 rounded-full px-3 py-1">
                        <Text className="text-white font-bold">
                          {selectedOfferForDetails.discount_percentage}% OFF
                        </Text>
                      </View>
                      <Text
                        className={`text-sm font-medium ${getOfferStatusColor(selectedOfferForDetails)}`}
                      >
                        {getOfferStatusText(selectedOfferForDetails)}
                      </Text>
                    </View>

                    <Text className="font-bold text-lg mb-2">
                      {selectedOfferForDetails.title}
                    </Text>

                    {selectedOfferForDetails.description && (
                      <Text className="text-muted-foreground mb-4">
                        {selectedOfferForDetails.description}
                      </Text>
                    )}
                  </View>

                  {/* Terms and conditions */}
                  {selectedOfferForDetails.terms_conditions &&
                    selectedOfferForDetails.terms_conditions.length > 0 && (
                      <View className="mb-4">
                        <Text className="font-semibold mb-2">
                          Terms & Conditions
                        </Text>
                        {selectedOfferForDetails.terms_conditions.map(
                          (term, index) => (
                            <Text
                              key={index}
                              className="text-sm text-muted-foreground mb-1"
                            >
                              • {term}
                            </Text>
                          ),
                        )}
                      </View>
                    )}

                  {/* Action button */}
                  <Button
                    onPress={() => {
                      setShowOfferDetails(false);
                      handleSelectOffer(selectedOfferForDetails);
                    }}
                    disabled={
                      !selectedOfferForDetails.claimed &&
                      !canClaimOffer(selectedOfferForDetails).canClaim
                    }
                    className="mt-4"
                  >
                    <Text className="text-white font-medium">
                      {selectedOfferForDetails.id === selectedOfferId
                        ? "Remove from Booking"
                        : !selectedOfferForDetails.claimed
                          ? "Claim & Apply to Booking"
                          : selectedOfferForDetails.canUse
                            ? "Apply to Booking"
                            : "Not Available"}
                    </Text>
                  </Button>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};
