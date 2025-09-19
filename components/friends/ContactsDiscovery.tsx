import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import {
  UserPlus,
  Search,
  Users,
  User,
  Check,
  X,
  MessageCircle,
  UserCheck,
  Phone,
  Mail,
  Shield,
  AlertCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { H3, P, Muted } from '@/components/ui/typography';
import { Image } from '@/components/image';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/context/supabase-provider';
import { useContacts, Contact } from '@/hooks/useContacts';

interface ContactUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  is_friend: boolean;
  hasPendingRequest: boolean;
  contact: Contact;
}

interface ContactsDiscoveryProps {
  onUserPress: (userId: string) => void;
  onSendFriendRequest: (userId: string) => Promise<void>;
  onCancelFriendRequest: (userId: string) => Promise<void>;
  processingIds: Set<string>;
}

export function ContactsDiscovery({
  onUserPress,
  onSendFriendRequest,
  onCancelFriendRequest,
  processingIds,
}: ContactsDiscoveryProps) {
  const { profile } = useAuth();
  const { contacts, permissionStatus, loading, error, requestPermission } = useContacts();
  
  const [contactUsers, setContactUsers] = useState<ContactUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [matchingUsers, setMatchingUsers] = useState<ContactUser[]>([]);

  // Find users from contacts who are already on the app
  const findUsersFromContacts = async () => {
    if (!contacts.length || !profile?.id) return;

    try {
      setSearchLoading(true);

      // Extract all phone numbers and emails from contacts
      const phoneNumbers = contacts
        .flatMap(contact => contact.phoneNumbers)
        .filter(phone => phone && phone.length > 0);

      const emails = contacts
        .flatMap(contact => contact.emails)
        .filter(email => email && email.length > 0);

      if (phoneNumbers.length === 0 && emails.length === 0) {
        setContactUsers([]);
        return;
      }

      // Search for users by phone numbers
      let phoneUsers: any[] = [];
      if (phoneNumbers.length > 0) {
        const { data: phoneData, error: phoneError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email, phone')
          .in('phone', phoneNumbers)
          .neq('id', profile.id);

        if (!phoneError && phoneData) {
          phoneUsers = phoneData;
        }
      }

      // Search for users by emails
      let emailUsers: any[] = [];
      if (emails.length > 0) {
        const { data: emailData, error: emailError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email, phone')
          .in('email', emails)
          .neq('id', profile.id);

        if (!emailError && emailData) {
          emailUsers = emailData;
        }
      }

      // Combine and deduplicate users
      const allUsers = [...phoneUsers, ...emailUsers];
      const uniqueUsers = allUsers.filter((user, index, self) => 
        index === self.findIndex(u => u.id === user.id)
      );

      // Check friendship status and pending requests
      const enrichedUsers = await Promise.all(
        uniqueUsers.map(async (user) => {
          // Check if already friends
          const { data: friendshipData } = await supabase
            .from('friends')
            .select('id')
            .or(
              `and(user_id.eq.${profile.id},friend_id.eq.${user.id}),and(user_id.eq.${user.id},friend_id.eq.${profile.id})`
            )
            .eq('status', 'accepted')
            .single();

          // Check for pending friend request
          const { data: requestData } = await supabase
            .from('friend_requests')
            .select('id, from_user_id, to_user_id')
            .or(
              `and(from_user_id.eq.${profile.id},to_user_id.eq.${user.id}),and(from_user_id.eq.${user.id},to_user_id.eq.${profile.id})`
            )
            .eq('status', 'pending')
            .single();

          // Find the matching contact
          const matchingContact = contacts.find(contact => 
            contact.phoneNumbers.some(phone => phone === user.phone) ||
            contact.emails.some(email => email === user.email)
          );

          return {
            ...user,
            is_friend: !!friendshipData,
            hasPendingRequest: !!requestData,
            contact: matchingContact || contacts[0], // fallback to first contact
          };
        })
      );

      setContactUsers(enrichedUsers);
    } catch (err) {
      console.error('Error finding users from contacts:', err);
      Alert.alert('Error', 'Failed to find users from your contacts. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Load users when contacts are available
  useEffect(() => {
    if (permissionStatus.granted && contacts.length > 0) {
      findUsersFromContacts();
    }
  }, [permissionStatus.granted, contacts.length]);

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) {
      return contactUsers;
    }

    const query = searchQuery.toLowerCase();
    return contactUsers.filter(user =>
      user.full_name.toLowerCase().includes(query) ||
      user.contact.name.toLowerCase().includes(query) ||
      (user.email && user.email.toLowerCase().includes(query)) ||
      (user.phone && user.phone.includes(query))
    );
  }, [contactUsers, searchQuery]);

  const handleSendFriendRequest = async (userId: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await onSendFriendRequest(userId);
      
      // Update local state
      setContactUsers(prev => 
        prev.map(user => 
          user.id === userId 
            ? { ...user, hasPendingRequest: true }
            : user
        )
      );
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  const handleCancelFriendRequest = async (userId: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await onCancelFriendRequest(userId);
      
      // Update local state
      setContactUsers(prev => 
        prev.map(user => 
          user.id === userId 
            ? { ...user, hasPendingRequest: false }
            : user
        )
      );
    } catch (error) {
      console.error('Error canceling friend request:', error);
    }
  };

  const renderContactUser = ({ item }: { item: ContactUser }) => (
    <Pressable
      onPress={() => onUserPress(item.id)}
      className="flex-row items-center justify-between p-4 mb-2 bg-white dark:bg-gray-800 rounded-2xl"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      <View className="flex-row items-center flex-1">
        <Image
          source={{
            uri: item.avatar_url || `https://ui-avatars.com/api/?name=${item.full_name}`,
          }}
          className="w-14 h-14 rounded-full bg-gray-100"
        />
        <View className="ml-3 flex-1">
          <Text className="font-semibold text-base">{item.full_name}</Text>
          <Text className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {item.contact.name}
          </Text>
          
          {/* Contact info */}
          <View className="flex-row items-center mt-1">
            {item.phone && (
              <View className="flex-row items-center mr-4">
                <Phone size={12} color="#6b7280" />
                <Muted className="text-xs ml-1">{item.phone}</Muted>
              </View>
            )}
            {item.email && (
              <View className="flex-row items-center">
                <Mail size={12} color="#6b7280" />
                <Muted className="text-xs ml-1">{item.email}</Muted>
              </View>
            )}
          </View>

          {/* Status indicators */}
          <View className="flex-row items-center mt-1">
            {item.is_friend && (
              <View className="flex-row items-center mr-3">
                <UserCheck size={14} color="#10b981" />
                <Muted className="text-sm ml-1">Already friends</Muted>
              </View>
            )}
            {item.hasPendingRequest && !item.is_friend && (
              <View className="flex-row items-center">
                <Clock size={14} color="#f59e0b" />
                <Muted className="text-sm ml-1">Request sent</Muted>
              </View>
            )}
          </View>
        </View>
      </View>

      {!item.is_friend && (
        <View className="ml-2">
          {item.hasPendingRequest ? (
            <Button
              variant="outline"
              size="sm"
              onPress={() => handleCancelFriendRequest(item.id)}
              disabled={processingIds.has(item.id)}
              className="px-3 py-1"
            >
              <X size={16} color="#ef4444" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onPress={() => handleSendFriendRequest(item.id)}
              disabled={processingIds.has(item.id)}
              className="px-3 py-1"
            >
              <UserPlus size={16} color="#fff" />
            </Button>
          )}
        </View>
      )}
    </Pressable>
  );

  // Permission denied state
  if (!permissionStatus.granted) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <View className="items-center">
          <Shield size={64} color="#6b7280" className="mb-4" />
          <H3 className="text-center mb-2">Find Friends from Contacts</H3>
          <P className="text-center text-gray-600 dark:text-gray-400 mb-6">
            We can help you find friends who are already using the app by checking your contacts.
          </P>
          
          <Button
            onPress={requestPermission}
            disabled={loading}
            className="mb-4"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Users size={20} className="mr-2" />
                <Text className="text-white font-semibold">Allow Contacts Access</Text>
              </>
            )}
          </Button>

          <Muted className="text-center text-sm">
            Your contacts are never stored or shared. We only use them to find friends.
          </Muted>
        </View>
      </View>
    );
  }

  // Loading state
  if (loading || searchLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text className="mt-4 text-gray-600 dark:text-gray-400">
          Finding friends from your contacts...
        </Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <AlertCircle size={64} color="#ef4444" className="mb-4" />
        <H3 className="text-center mb-2">Error Loading Contacts</H3>
        <P className="text-center text-gray-600 dark:text-gray-400 mb-6">
          {error}
        </P>
        <Button onPress={() => findUsersFromContacts()}>
          Try Again
        </Button>
      </View>
    );
  }

  // No contacts found
  if (contactUsers.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <Users size={64} color="#6b7280" className="mb-4" />
        <H3 className="text-center mb-2">No Friends Found</H3>
        <P className="text-center text-gray-600 dark:text-gray-400 mb-6">
          We couldn't find any of your contacts using the app yet. Invite them to join!
        </P>
        <Button variant="outline">
          <MessageCircle size={20} className="mr-2" />
          Invite Friends
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Search bar */}
      <View className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row items-center bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-2">
          <Search size={20} color="#6b7280" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search contacts..."
            placeholderTextColor="#9ca3af"
            className="flex-1 ml-3 text-base text-gray-900 dark:text-white"
          />
        </View>
      </View>

      {/* Results */}
      <FlatList
        data={filteredUsers}
        renderItem={renderContactUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-12">
            <Search size={48} color="#6b7280" className="mb-4" />
            <Text className="text-gray-600 dark:text-gray-400">
              No contacts found matching "{searchQuery}"
            </Text>
          </View>
        }
      />
    </View>
  );
}
