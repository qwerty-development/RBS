import React, { RefObject } from "react";
import { View } from "react-native";
import MapView from "react-native-maps";
import { BookingWidget } from "./BookingWidget";
import { AboutSection } from "./AboutSection";
import { FeaturesAndAmenities } from "./FeaturesAndAmenities";
import { HoursSection } from "./HoursSection";
import { LocationSection } from "./LocationSection";
import { ContactSection } from "./ContactSection";

interface TimeSlot {
  time: string;
  available: boolean;
  availableCapacity: number;
}

interface Restaurant {
  id: string;
  name: string;
  description: string;
  address: string;
  location?: any;
  main_image_url: string;
  image_urls?: string[] | null;
  cuisine_type: string;
  tags?: string[] | null;
  opening_time: string;
  closing_time: string;
  booking_policy: "instant" | "request";
  price_range: number;
  average_rating?: number;
  total_reviews?: number;
  phone_number?: string | null;
  whatsapp_number?: string | null;
  instagram_handle?: string | null;
  website_url?: string | null;
  menu_url?: string | null;
  dietary_options?: string[] | null;
  ambiance_tags?: string[] | null;
  parking_available?: boolean;
  valet_parking?: boolean;
  outdoor_seating?: boolean;
  shisha_available?: boolean;
  live_music_schedule?: Record<string, boolean> | null;
  happy_hour_times?: { start: string; end: string } | null;
  booking_window_days?: number;
  cancellation_window_hours?: number;
  table_turnover_minutes?: number;
  featured?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface MapCoordinate {
  latitude: number;
  longitude: number;
}

interface OverviewTabContentProps {
  restaurant: Restaurant;
  selectedDate: Date;
  selectedTime: string;
  partySize: number;
  availableSlots: TimeSlot[];
  loadingSlots: boolean;
  showFullDescription: boolean;
  mapCoordinates: MapCoordinate;
  mapRef: RefObject<MapView>;
  onDateChange: (date: Date) => void;
  onTimeChange: (time: string) => void;
  onPartySizeChange: (size: number) => void;
  onBooking: () => void;
  onToggleDescription: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onDirectionsPress: () => void;
  isRestaurantOpen: () => boolean;
}

export const OverviewTabContent = ({
  restaurant,
  selectedDate,
  selectedTime,
  partySize,
  availableSlots,
  loadingSlots,
  showFullDescription,
  mapCoordinates,
  mapRef,
  onDateChange,
  onTimeChange,
  onPartySizeChange,
  onBooking,
  onToggleDescription,
  onCall,
  onWhatsApp,
  onDirectionsPress,
  isRestaurantOpen,
}: OverviewTabContentProps) => {
  return (
    <>
      {/* Booking Widget */}
      <BookingWidget
        restaurant={restaurant}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        partySize={partySize}
        availableSlots={availableSlots}
        loadingSlots={loadingSlots}
        onDateChange={onDateChange}
        onTimeChange={onTimeChange}
        onPartySizeChange={onPartySizeChange}
        onBooking={onBooking}
      />

      {/* About Section */}
      <AboutSection
        restaurant={restaurant}
        showFullDescription={showFullDescription}
        onToggleDescription={onToggleDescription}
      />

      {/* Features & Amenities */}
      <FeaturesAndAmenities restaurant={restaurant} />

      {/* Hours of Operation */}
      <HoursSection
        restaurant={restaurant}
        isRestaurantOpen={isRestaurantOpen}
      />

      {/* Location Section */}
      <LocationSection
        restaurant={restaurant}
        mapCoordinates={mapCoordinates}
        mapRef={mapRef}
        onDirectionsPress={onDirectionsPress}
      />

      {/* Contact Information */}
      <ContactSection
        restaurant={restaurant}
        onCall={onCall}
        onWhatsApp={onWhatsApp}
      />
    </>
  );
};
