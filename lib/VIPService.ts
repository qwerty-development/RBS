// lib/vip/VIPService.ts
import { supabase } from "@/config/supabase";

export interface VIPStatus {
  restaurant_id: string;
  user_id: string;
  extended_booking_days: number;
  priority_booking: boolean;
  valid_until: string;
}

export interface VIPBenefit {
  type: 'extended_booking' | 'priority_tables' | 'skip_approval' | 'flexible_cancellation';
  value: any;
  description: string;
}

export class VIPService {
  /**
   * Check if a user has VIP status at a restaurant
   */
  static async checkVIPStatus(
    userId: string,
    restaurantId: string
  ): Promise<VIPStatus | null> {
    try {
      const { data, error } = await supabase
        .from('restaurant_vip_users')
        .select('*')
        .eq('user_id', userId)
        .eq('restaurant_id', restaurantId)
        .gte('valid_until', new Date().toISOString())
        .single();

      if (error || !data) return null;
      return data;
    } catch (error) {
      console.error('Error checking VIP status:', error);
      return null;
    }
  }

  /**
   * Get all VIP statuses for a user
   */
  static async getUserVIPStatuses(userId: string): Promise<VIPStatus[]> {
    try {
      const { data, error } = await supabase
        .from('restaurant_vip_users')
        .select(`
          *,
          restaurant:restaurants (
            id,
            name,
            main_image_url
          )
        `)
        .eq('user_id', userId)
        .gte('valid_until', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching VIP statuses:', error);
      return [];
    }
  }

  /**
   * Grant VIP status to a user
   */
  static async grantVIPStatus(
    userId: string,
    restaurantId: string,
    durationDays: number = 365,
    extendedBookingDays: number = 60
  ): Promise<boolean> {
    try {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + durationDays);

      const { error } = await supabase
        .from('restaurant_vip_users')
        .upsert({
          user_id: userId,
          restaurant_id: restaurantId,
          extended_booking_days: extendedBookingDays,
          priority_booking: true,
          valid_until: validUntil.toISOString(),
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error granting VIP status:', error);
      return false;
    }
  }

  /**
   * Revoke VIP status
   */
  static async revokeVIPStatus(
    userId: string,
    restaurantId: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('restaurant_vip_users')
        .delete()
        .eq('user_id', userId)
        .eq('restaurant_id', restaurantId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error revoking VIP status:', error);
      return false;
    }
  }

  /**
   * Get VIP benefits for display
   */
  static getVIPBenefits(vipStatus: VIPStatus): VIPBenefit[] {
    const benefits: VIPBenefit[] = [];

    if (vipStatus.extended_booking_days > 30) {
      benefits.push({
        type: 'extended_booking',
        value: vipStatus.extended_booking_days,
        description: `Book up to ${vipStatus.extended_booking_days} days in advance (vs 30 days for regular users)`
      });
    }

    if (vipStatus.priority_booking) {
      benefits.push({
        type: 'priority_tables',
        value: true,
        description: 'Priority access to premium tables and time slots'
      });
    }

    // Could add more benefits based on the VIP configuration
    benefits.push({
      type: 'skip_approval',
      value: true,
      description: 'Instant booking confirmation without approval wait'
    });

    benefits.push({
      type: 'flexible_cancellation',
      value: true,
      description: 'Cancel up to 2 hours before booking (vs 24 hours)'
    });

    return benefits;
  }

  /**
   * Check if booking window should be extended for VIP
   */
  static async getMaxBookingDays(
    userId: string,
    restaurantId: string,
    defaultDays: number = 30
  ): Promise<number> {
    const vipStatus = await this.checkVIPStatus(userId, restaurantId);
    if (vipStatus?.extended_booking_days) {
      return Math.max(vipStatus.extended_booking_days, defaultDays);
    }
    return defaultDays;
  }
}