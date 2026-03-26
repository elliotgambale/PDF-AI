// src/services/AuthService.ts
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, STORAGE_KEYS, AppError } from '../types';

class AuthServiceClass {
  async signInWithGoogle(): Promise<User> {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      
      if (!userInfo.user) {
        throw new Error('Failed to get user information from Google');
      }

      const user: User = {
        id: userInfo.user.id,
        email: userInfo.user.email,
        name: userInfo.user.name || '',
        photo: userInfo.user.photo || null,
      };

      // Store user data locally
      await this.storeUserData(user);
      
      return user;
    } catch (error: any) {
      console.error('Google sign in failed:', error);
      
      let errorMessage = 'Sign in failed. Please try again.';
      
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        errorMessage = 'Sign in was cancelled';
      } else if (error.code === statusCodes.IN_PROGRESS) {
        errorMessage = 'Sign in is already in progress';
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        errorMessage = 'Google Play Services not available';
      }
      
      const appError: AppError = {
        code: error.code || 'UNKNOWN_ERROR',
        message: errorMessage,
        details: error,
      };
      
      throw appError;
    }
  }

  async signOut(): Promise<void> {
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
      
      // Clear stored user data
      await this.clearUserData();
    } catch (error) {
      console.error('Sign out failed:', error);
      // Still clear local data even if Google sign out fails
      await this.clearUserData();
      throw error;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      // First check if user is signed in with Google
      const isSignedIn = await GoogleSignin.isSignedIn();
      
      if (isSignedIn) {
        const userInfo = await GoogleSignin.getCurrentUser();
        if (userInfo?.user) {
          const user: User = {
            id: userInfo.user.id,
            email: userInfo.user.email,
            name: userInfo.user.name || '',
            photo: userInfo.user.photo || null,
          };
          
          // Update stored user data
          await this.storeUserData(user);
          return user;
        }
      }
      
      // Fall back to stored user data
      return await this.getStoredUserData();
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  async isSignedIn(): Promise<boolean> {
    try {
      return await GoogleSignin.isSignedIn();
    } catch (error) {
      console.error('Failed to check sign in status:', error);
      return false;
    }
  }

  async refreshAccessToken(): Promise<void> {
    try {
      await GoogleSignin.getTokens();
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      throw error;
    }
  }

  private async storeUserData(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    } catch (error) {
      console.error('Failed to store user data:', error);
    }
  }

  private async getStoredUserData(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Failed to get stored user data:', error);
      return null;
    }
  }

  private async clearUserData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.USER_TOKEN,
        STORAGE_KEYS.LAST_PDF_ID,
      ]);
    } catch (error) {
      console.error('Failed to clear user data:', error);
    }
  }

  // Mock methods for email-based authentication (if needed later)
  async signInWithEmail(email: string, password: string): Promise<User> {
    throw new Error('Email authentication not implemented yet');
  }

  async signUpWithEmail(email: string, password: string, name: string): Promise<User> {
    throw new Error('Email registration not implemented yet');
  }

  async resetPassword(email: string): Promise<void> {
    // This would integrate with your backend auth service
    // For now, we'll simulate the process
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (email && email.includes('@')) {
          resolve();
        } else {
          reject(new Error('Invalid email address'));
        }
      }, 2000);
    });
  }

  async recoverUsername(recoveryMethod: 'email' | 'phone', value: string): Promise<void> {
    // This would integrate with your backend auth service
    // For now, we'll simulate the process
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (value && value.length > 0) {
          resolve();
        } else {
          reject(new Error('Invalid recovery information'));
        }
      }, 2000);
    });
  }

  // Utility method to get user's initials for avatar
  getUserInitials(user: User): string {
    if (!user.name) return user.email.charAt(0).toUpperCase();
    
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`.toUpperCase();
    }
    
    return user.name.charAt(0).toUpperCase();
  }

  // Method to validate email format
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Method to validate phone number format
  isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }
}

export const AuthService = new AuthServiceClass();