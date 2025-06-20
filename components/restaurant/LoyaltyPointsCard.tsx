import { SpecialOffer } from "@/types/restaurant";
import { Restaurant } from "@/types/search";
import { Trophy, CheckCircle, Clock, Tag, Users, Calendar, QrCode } from "lucide-react-native";
import React from "react";
import { useColorScheme, View, ScrollView, Button, ActivityIndicator,Text } from "react-native";
import { H3 } from "../ui/typography";

export const LoyaltyPointsCard: React.FC<{
    restaurant: Restaurant;
    userTier: string;
    userPoints: number;
    calculateBookingPoints: (partySize: number, priceRange: number) => number;
    partySize: number;
  }> = ({ restaurant, userTier, userPoints, calculateBookingPoints, partySize }) => {
    const { colorScheme } = useColorScheme();
    const earnablePoints = calculateBookingPoints(partySize, restaurant.price_range || 2);
  
    return (
      <View className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 mb-4 border border-primary/20">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <Trophy size={20} color="#3b82f6" />
            <Text className="font-bold text-lg ml-2">Loyalty Rewards</Text>
          </View>
          <View className="bg-primary/20 px-3 py-1 rounded-full">
            <Text className="text-primary font-bold text-sm">{userTier.toUpperCase()}</Text>
          </View>
        </View>
        
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-sm text-muted-foreground">You'll earn</Text>
            <View className="flex-row items-center">
              <Text className="text-2xl font-bold text-primary">{earnablePoints}</Text>
              <Text className="text-sm text-muted-foreground ml-1">points</Text>
            </View>
          </View>
          
          <View className="items-end">
            <Text className="text-sm text-muted-foreground">Current balance</Text>
            <Text className="text-lg font-bold">{userPoints} pts</Text>
          </View>
        </View>
        
        <Text className="text-xs text-muted-foreground mt-2">
          Points earned for dining here • Party size: {partySize}
        </Text>
      </View>
    );
  };
  
  // Special offers section component
 export const SpecialOffersSection: React.FC<{
    offers: SpecialOffer[];
    highlightOfferId?: string;
    onClaimOffer: (offerId: string) => void;
    onUseOffer: (offer: SpecialOffer) => void;
    onBookWithOffer: (offer: SpecialOffer) => void;
    processing: boolean;
  }> = ({ offers, highlightOfferId, onClaimOffer, onUseOffer, onBookWithOffer, processing }) => {
    const { colorScheme } = useColorScheme();
  
    if (offers.length === 0) return null;
  
    return (
      <View className="px-4 mb-6">
        <View className="flex-row items-center justify-between mb-4">
          <H3>Special Offers</H3>
          <View className="bg-primary/10 px-3 py-1 rounded-full">
            <Text className="text-primary font-bold text-sm">{offers.length} available</Text>
          </View>
        </View>
  
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-4">
            {offers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                highlighted={offer.id === highlightOfferId}
                onClaim={() => onClaimOffer(offer.id)}
                onUse={() => onUseOffer(offer)}
                onBookWithOffer={() => onBookWithOffer(offer)}
                processing={processing}
              />
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };
  
  // Individual offer card component
  export const OfferCard: React.FC<{
    offer: SpecialOffer;
    highlighted?: boolean;
    onClaim: () => void;
    onUse: () => void;
    onBookWithOffer: () => void;
    processing: boolean;
  }> = ({ offer, highlighted, onClaim, onUse, onBookWithOffer, processing }) => {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    };
  
    const getOfferStatus = () => {
      if (offer.used) {
        return (
          <View className="flex-row items-center bg-green-100 px-2 py-1 rounded-full">
            <CheckCircle size={12} color="#16a34a" />
            <Text className="text-green-700 text-xs ml-1">Used</Text>
          </View>
        );
      }
      
      if (offer.isExpired) {
        return (
          <View className="flex-row items-center bg-red-100 px-2 py-1 rounded-full">
            <Clock size={12} color="#dc2626" />
            <Text className="text-red-700 text-xs ml-1">Expired</Text>
          </View>
        );
      }
      
      if (offer.claimed) {
        return (
          <View className="flex-row items-center bg-blue-100 px-2 py-1 rounded-full">
            <Tag size={12} color="#2563eb" />
            <Text className="text-blue-700 text-xs ml-1">Claimed</Text>
          </View>
        );
      }
      
      return null;
    };
  
    return (
      <View 
        className={`bg-card rounded-xl border-2 p-4 w-72 ${
          highlighted ? 'border-primary shadow-lg' : 'border-border'
        }`}
      >
        {/* Header */}
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1">
            <Text className="font-bold text-lg" numberOfLines={1}>
              {offer.title}
            </Text>
            <Text className="text-sm text-muted-foreground" numberOfLines={2}>
              {offer.description}
            </Text>
          </View>
          
          <View className="bg-primary rounded-full h-12 w-12 items-center justify-center ml-2">
            <Text className="text-white font-bold text-lg">{offer.discount_percentage}</Text>
            <Text className="text-white text-xs -mt-1">%</Text>
          </View>
        </View>
  
        {/* Status and expiry */}
        <View className="flex-row items-center justify-between mb-3">
          {getOfferStatus()}
          <Text className="text-xs text-muted-foreground">
            Until {formatDate(offer.valid_until)}
          </Text>
        </View>
  
        {/* Terms */}
        {offer.minimum_party_size > 1 && (
          <View className="flex-row items-center mb-3">
            <Users size={14} color="#666" />
            <Text className="text-xs text-muted-foreground ml-1">
              Min. {offer.minimum_party_size} people
            </Text>
          </View>
        )}
  
        {/* Action button */}
        <View>
          {!offer.claimed ? (
            <Button
              onPress={onClaim}
              disabled={processing}
              className="w-full"
              size="sm"
            >
              {processing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Tag size={16} className="mr-2" />
                  <Text className="text-white font-medium">Claim Offer</Text>
                </>
              )}
            </Button>
          ) : offer.canUse ? (
            <Button
              onPress={onBookWithOffer}
              className="w-full"
              size="sm"
            >
              <Calendar size={16} className="mr-2" />
              <Text className="text-white font-medium">Book with Offer</Text>
            </Button>
          ) : (
            <Button
              variant="outline"
              onPress={() => {}}
              disabled
              className="w-full"
              size="sm"
            >
              <Text className="text-muted-foreground">
                {offer.used ? "Already Used" : "Expired"}
              </Text>
            </Button>
          )}
        </View>
        
        {/* Redemption code for claimed offers */}
        {offer.claimed && offer.redemptionCode && (
          <View className="mt-3 bg-muted/50 rounded-lg p-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">Code:</Text>
              <QrCode size={16} color="#666" />
            </View>
            <Text className="font-mono text-sm font-bold">
              {offer.redemptionCode.slice(-6).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
    );
  };
  