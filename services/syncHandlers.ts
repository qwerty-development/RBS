// services/syncHandlers.ts
import { supabase } from '@/config/supabase';
import { offlineSync, OfflineAction } from './offlineSync';
import { imageUpload } from '@/utils/imageUpload'; // Assuming you have a utility for this

// Favorite Handlers
const handleAddFavorite = async (action: OfflineAction<{ user_id: string; restaurant_id: string }>) => {
  console.log('Syncing ADD_FAVORITE', action.payload);
  const { error } = await supabase.from('favorites').insert(action.payload);
  if (error) throw error;
};

const handleRemoveFavorite = async (action: OfflineAction<{ user_id: string; restaurant_id: string }>) => {
  console.log('Syncing REMOVE_FAVORITE', action.payload);
  const { user_id, restaurant_id } = action.payload;
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', user_id)
    .eq('restaurant_id', restaurant_id);
  if (error) throw error;
};

// Booking Handlers
const handleCancelBooking = async (action: OfflineAction<{ bookingId: string }>) => {
  console.log('Syncing CANCEL_BOOKING', action.payload);
  const { bookingId } = action.payload;
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId);
  if (error) throw error;
};

// Profile Handlers
const handleUpdateAvatar = async (action: OfflineAction<{ localUri: string }>) => {
  console.log('Syncing UPDATE_AVATAR', action.payload);
  const { localUri } = action.payload;
  const { publicUrl } = await imageUpload(localUri); // Your existing upload logic

  // You need the user ID to update the profile. This should be stored with the action
  // or retrieved from the current session.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', user.id);

  if (error) throw error;
};


export function registerSyncHandlers() {
  offlineSync.registerSyncHandler('ADD_FAVORITE', handleAddFavorite);
  offlineSync.registerSyncHandler('REMOVE_FAVORITE', handleRemoveFavorite);
  offlineSync.registerSyncHandler('CANCEL_BOOKING', handleCancelBooking);
  offlineSync.registerSyncHandler('UPDATE_AVATAR', handleUpdateAvatar);
  console.log('Offline sync handlers registered');
}
