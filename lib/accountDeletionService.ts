// lib/accountDeletionService.ts
import { supabase } from '@/config/supabase';

export interface AccountDeletionResult {
  success: boolean;
  message: string;
  deletion_log?: string;
  error_detail?: string;
}

export interface UserDataSummary {
  user_id: string;
  profile_exists: boolean;
  bookings_count: number;
  reviews_count: number;
  favorites_count: number;
  friends_count: number;
  playlists_count: number;
  posts_count: number;
  notifications_count: number;
  waitlist_count: number;
  loyalty_activities_count: number;
  staff_roles_count: number;
}

/**
 * Service for managing account deletion operations
 */
export class AccountDeletionService {
  /**
   * Get a summary of user data before deletion
   * This helps users understand what will be deleted
   */
  static async getUserDataSummary(): Promise<UserDataSummary | null> {
    try {
      const { data, error } = await supabase.rpc('test_user_data_before_deletion');
      
      if (error) {
        console.error('Error getting user data summary:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error in getUserDataSummary:', error);
      return null;
    }
  }

  /**
   * Perform soft delete - deactivates account without removing data
   */
  static async softDeleteAccount(): Promise<AccountDeletionResult> {
    try {
      const { data, error } = await supabase.rpc('soft_delete_user_account');
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error: any) {
      console.error('Error in soft delete:', error);
      return {
        success: false,
        message: error.message || 'Failed to deactivate account',
        error_detail: error.code || 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Perform hard delete - permanently removes all user data
   * This action cannot be undone
   */
  static async deleteAccount(): Promise<AccountDeletionResult> {
    try {
      const { data, error } = await supabase.rpc('delete_user_account');
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error: any) {
      console.error('Error in account deletion:', error);
      return {
        success: false,
        message: error.message || 'Failed to delete account',
        error_detail: error.code || 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Request data export before deletion
   */
  static async requestDataExport(): Promise<{ success: boolean; message: string }> {
    try {
      const { data: profile } = await supabase.auth.getUser();
      
      if (!profile.user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('data_export_requests')
        .insert({
          user_id: profile.user.id,
          status: 'pending',
          requested_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        message: 'Data export requested successfully. You will receive an email when ready.'
      };
    } catch (error: any) {
      console.error('Error requesting data export:', error);
      return {
        success: false,
        message: error.message || 'Failed to request data export'
      };
    }
  }

  /**
   * Validate if user can delete account
   * Checks for any restrictions or pending actions
   */
  static async validateDeletion(): Promise<{
    canDelete: boolean;
    restrictions: string[];
    warnings: string[];
  }> {
    try {
      const summary = await this.getUserDataSummary();
      const restrictions: string[] = [];
      const warnings: string[] = [];

      if (!summary) {
        restrictions.push('Unable to verify account data');
        return { canDelete: false, restrictions, warnings };
      }

      // Check for active bookings or pending reviews
      if (summary.bookings_count > 0) {
        warnings.push(`You have ${summary.bookings_count} booking(s) that will be cancelled`);
      }

      if (summary.reviews_count > 0) {
        warnings.push(`${summary.reviews_count} review(s) will be permanently deleted`);
      }

      if (summary.friends_count > 0) {
        warnings.push(`You will be removed from ${summary.friends_count} friend connection(s)`);
      }

      if (summary.playlists_count > 0) {
        warnings.push(`${summary.playlists_count} playlist(s) will be deleted`);
      }

      if (summary.staff_roles_count > 0) {
        restrictions.push('You have active restaurant staff roles. Please contact support.');
      }

      return {
        canDelete: restrictions.length === 0,
        restrictions,
        warnings
      };
    } catch (error) {
      console.error('Error validating deletion:', error);
      return {
        canDelete: false,
        restrictions: ['Unable to validate account for deletion'],
        warnings: []
      };
    }
  }

  /**
   * Verify CASCADE-enabled deletion was successful
   * Works with the enhanced CASCADE deletion function
   */
  static async verifyCascadeDeletion(userId: string): Promise<{
    success: boolean;
    deletionComplete: boolean;
    totalRecordsRemaining: number;
    cascadeEffective: boolean;
    tableCounts: Record<string, number>;
    verificationTimestamp: string;
  } | null> {
    try {
      const { data, error } = await supabase.rpc('verify_user_deletion_cascade', {
        target_user_id: userId
      });
      
      if (error) {
        console.error('Error verifying CASCADE deletion:', error);
        return null;
      }
      
      return {
        success: true,
        deletionComplete: data.deletion_complete,
        totalRecordsRemaining: data.total_records_remaining,
        cascadeEffective: data.cascade_effective,
        tableCounts: data.table_counts,
        verificationTimestamp: data.verification_timestamp
      };
    } catch (error: any) {
      console.error('Error in verifyCascadeDeletion:', error);
      return null;
    }
  }
}

/**
 * Hook for account deletion operations
 */
export const useAccountDeletion = () => {
  return {
    getUserDataSummary: AccountDeletionService.getUserDataSummary,
    softDeleteAccount: AccountDeletionService.softDeleteAccount,
    deleteAccount: AccountDeletionService.deleteAccount,
    requestDataExport: AccountDeletionService.requestDataExport,
    validateDeletion: AccountDeletionService.validateDeletion,
    verifyCascadeDeletion: AccountDeletionService.verifyCascadeDeletion,
  };
};
