import { useState, useEffect } from 'react';
import * as Contacts from 'expo-contacts';
import { Alert } from 'react-native';

export interface Contact {
  id: string;
  name: string;
  phoneNumbers: string[];
  emails: string[];
  imageAvailable: boolean;
  imageUri?: string;
}

export interface ContactsPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<ContactsPermissionStatus>({
    granted: false,
    canAskAgain: true,
    status: 'undetermined'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPermission = async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { status, canAskAgain } = await Contacts.requestPermissionsAsync();
      
      setPermissionStatus({
        granted: status === 'granted',
        canAskAgain,
        status
      });

      if (status === 'granted') {
        await loadContacts();
        return true;
      } else if (status === 'denied' && !canAskAgain) {
        Alert.alert(
          'Permission Required',
          'Contacts access is required to find friends. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Contacts.openSettingsAsync() }
          ]
        );
      } else if (status === 'denied') {
        Alert.alert(
          'Permission Required',
          'We need access to your contacts to help you find friends who are already using the app.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Allow', onPress: () => requestPermission() }
          ]
        );
      }

      return false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request contacts permission';
      setError(errorMessage);
      console.error('Error requesting contacts permission:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const { status } = await Contacts.getPermissionsAsync();
      
      if (status !== 'granted') {
        setPermissionStatus({
          granted: false,
          canAskAgain: true,
          status
        });
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
          Contacts.Fields.ImageAvailable,
          Contacts.Fields.Image
        ],
        sort: Contacts.SortTypes.FirstName,
      });

      const formattedContacts: Contact[] = data
        .filter(contact => contact.name && contact.name.length > 0)
        .map(contact => ({
          id: contact.id || '',
          name: contact.name || '',
          phoneNumbers: contact.phoneNumbers?.map(phone => phone.number) || [],
          emails: contact.emails?.map(email => email.email) || [],
          imageAvailable: contact.imageAvailable || false,
          imageUri: contact.image?.uri
        }));

      setContacts(formattedContacts);
      setPermissionStatus({
        granted: true,
        canAskAgain: true,
        status: 'granted'
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load contacts';
      setError(errorMessage);
      console.error('Error loading contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkPermission = async (): Promise<void> => {
    try {
      const { status, canAskAgain } = await Contacts.getPermissionsAsync();
      
      setPermissionStatus({
        granted: status === 'granted',
        canAskAgain,
        status
      });

      if (status === 'granted') {
        await loadContacts();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check contacts permission';
      setError(errorMessage);
      console.error('Error checking contacts permission:', err);
    }
  };

  // Check permission on mount
  useEffect(() => {
    checkPermission();
  }, []);

  return {
    contacts,
    permissionStatus,
    loading,
    error,
    requestPermission,
    loadContacts,
    checkPermission
  };
}
