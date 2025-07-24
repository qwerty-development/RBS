import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RestaurantCard } from '@/components/restaurant/RestaurantCard';
import type { Restaurant } from '@/types/restaurant';

const mockRestaurant: Restaurant = {
  id: '1',
  name: 'Test Restaurant',
  description: 'A test restaurant for testing purposes',
  address: '123 Test Street, Beirut, Lebanon',
  location: {
    type: 'Point',
    coordinates: [35.5018, 33.8938],
  },
  main_image_url: 'https://example.com/image.jpg',
  image_urls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
  cuisine_type: 'Italian',
  tags: ['romantic', 'outdoor'],
  opening_time: '11:00',
  closing_time: '23:00',
  booking_policy: 'instant',
  price_range: 3,
  average_rating: 4.5,
  total_reviews: 150,
  phone_number: '+96171234567',
  whatsapp_number: '+96171234567',
  instagram_handle: '@testrestaurant',
  website_url: 'https://testrestaurant.com',
  menu_url: 'https://testrestaurant.com/menu',
  dietary_options: ['vegetarian', 'gluten-free'],
  ambiance_tags: ['romantic', 'family-friendly'],
  parking_available: true,
  valet_parking: false,
  outdoor_seating: true,
  shisha_available: false,
  live_music_schedule: { friday: true, saturday: true },
  happy_hour_times: { start: '17:00', end: '19:00' },
  booking_window_days: 30,
  cancellation_window_hours: 24,
  table_turnover_minutes: 120,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('RestaurantCard Component', () => {
  const mockOnPress = jest.fn();
  const defaultProps = {
    restaurant: mockRestaurant,
    onPress: mockOnPress,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders restaurant information correctly', () => {
    const { getByText } = render(<RestaurantCard {...defaultProps} />);

    expect(getByText('Test Restaurant')).toBeTruthy();
    expect(getByText('Italian')).toBeTruthy();
    expect(getByText('4.5')).toBeTruthy();
    expect(getByText('150')).toBeTruthy();
  });

  it('displays price range correctly', () => {
    const { getByText } = render(<RestaurantCard {...defaultProps} />);
    
    // Price range 3 should display as $$$
    expect(getByText('$$$')).toBeTruthy();
  });

  it('calls onPress when card is tapped', () => {
    const { getByTestId } = render(
      <RestaurantCard {...defaultProps} testID="restaurant-card" />
    );

    fireEvent.press(getByTestId('restaurant-card'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
    expect(mockOnPress).toHaveBeenCalledWith(mockRestaurant);
  });

  it('handles missing optional data gracefully', () => {
    const restaurantWithoutRating = {
      ...mockRestaurant,
      average_rating: 0,
      total_reviews: 0,
    };

    const { getByText } = render(
      <RestaurantCard restaurant={restaurantWithoutRating} onPress={mockOnPress} />
    );

    expect(getByText('Test Restaurant')).toBeTruthy();
    expect(getByText('Italian')).toBeTruthy();
  });

  it('displays favorite indicator when restaurant is favorited', () => {
    const { getByTestId } = render(
      <RestaurantCard {...defaultProps} isFavorite={true} />
    );

    expect(getByTestId('favorite-indicator')).toBeTruthy();
  });

  it('shows special offer badge when restaurant has offers', () => {
    const { getByText } = render(
      <RestaurantCard {...defaultProps} hasSpecialOffer={true} />
    );

    expect(getByText('Special Offer')).toBeTruthy();
  });

  it('displays correct booking policy indicator', () => {
    const { getByText } = render(<RestaurantCard {...defaultProps} />);
    
    expect(getByText('Instant Booking')).toBeTruthy();
  });

  it('handles long restaurant names correctly', () => {
    const restaurantWithLongName = {
      ...mockRestaurant,
      name: 'This is a very long restaurant name that should be truncated properly',
    };

    const { getByText } = render(
      <RestaurantCard restaurant={restaurantWithLongName} onPress={mockOnPress} />
    );

    expect(getByText(restaurantWithLongName.name)).toBeTruthy();
  });

  it('displays dietary options when available', () => {
    const { getByText } = render(<RestaurantCard {...defaultProps} />);
    
    expect(getByText('Vegetarian')).toBeTruthy();
    expect(getByText('Gluten-free')).toBeTruthy();
  });

  it('shows distance when provided', () => {
    const { getByText } = render(
      <RestaurantCard {...defaultProps} distance="1.2 km" />
    );

    expect(getByText('1.2 km')).toBeTruthy();
  });

  it('renders in skeleton mode when loading', () => {
    const { getByTestId } = render(
      <RestaurantCard {...defaultProps} isLoading={true} />
    );

    expect(getByTestId('restaurant-card-skeleton')).toBeTruthy();
  });
}); 