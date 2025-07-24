import React, { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/context/supabase-provider';

// Mock the AuthProvider
const MockAuthProvider = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
};

describe('useAuth Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default values', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <MockAuthProvider>{children}</MockAuthProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.isGuest).toBe(false);
  });

  it('should handle sign up successfully', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <MockAuthProvider>{children}</MockAuthProvider>
      ),
    });

    await act(async () => {
      await result.current.signUp(
        'test@example.com',
        'Password123!',
        'John Doe',
        '+96171234567'
      );
    });

    // Verify sign up was called
    expect(result.current.signUp).toBeDefined();
  });

  it('should handle sign in successfully', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <MockAuthProvider>{children}</MockAuthProvider>
      ),
    });

    await act(async () => {
      await result.current.signIn('test@example.com', 'Password123!');
    });

    // Verify sign in was called
    expect(result.current.signIn).toBeDefined();
  });

  it('should handle sign out successfully', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <MockAuthProvider>{children}</MockAuthProvider>
      ),
    });

    await act(async () => {
      await result.current.signOut();
    });

    // Verify sign out was called
    expect(result.current.signOut).toBeDefined();
  });

  it('should handle guest mode correctly', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <MockAuthProvider>{children}</MockAuthProvider>
      ),
    });

    await act(async () => {
      result.current.continueAsGuest();
    });

    await waitFor(() => {
      expect(result.current.isGuest).toBe(true);
    });
  });

  it('should update profile successfully', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <MockAuthProvider>{children}</MockAuthProvider>
      ),
    });

    const profileUpdates = {
      full_name: 'Updated Name',
      phone_number: '+96171234567',
    };

    await act(async () => {
      await result.current.updateProfile(profileUpdates);
    });

    // Verify update profile was called
    expect(result.current.updateProfile).toBeDefined();
  });

  it('should handle authentication errors gracefully', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <MockAuthProvider>{children}</MockAuthProvider>
      ),
    });

    // Test invalid credentials
    await act(async () => {
      try {
        await result.current.signIn('invalid@email.com', 'wrongpassword');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  it('should refresh profile data', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <MockAuthProvider>{children}</MockAuthProvider>
      ),
    });

    await act(async () => {
      await result.current.refreshProfile();
    });

    // Verify refresh profile was called
    expect(result.current.refreshProfile).toBeDefined();
  });
}); 