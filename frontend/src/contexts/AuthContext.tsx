import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../services/authService';
import type { User, AuthResponse } from '../services/authService';

interface Family {
  id: string;
  name: string;
  role: 'ADMIN' | 'MEMBER';
  members?: Array<{
    id: string;
    name: string;
    role: 'ADMIN' | 'MEMBER';
  }>;
  admins?: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  isLastAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  family: Family | null;
  login: (email: string, name?: string, inviteCode?: string) => Promise<void>;
  verifyMagicLink: (token: string, inviteCode?: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updateUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [family] = useState<Family | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Register callback with authService to handle auth changes from interceptors
    const handleAuthChange = () => {
      setUser(authService.getUser());
    };
    
    try {
      authService.setAuthChangeCallback(handleAuthChange);
    } catch (error) {
      console.error('Failed to register auth change callback:', error);
    }
    
    // Initialize auth state from localStorage
    const initializeAuth = async () => {
      try {
        if (authService.isAuthenticated() && !authService.isTokenExpired()) {
          setUser(authService.getUser());
        } else if (authService.getToken()) {
          // Token exists but might be expired, try to refresh
          try {
            await authService.refreshToken();
            setUser(authService.getUser());
          } catch (error) {
            // Refresh failed, clear auth
            console.error('Token refresh failed:', error);
            await authService.logout();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, name?: string, inviteCode?: string): Promise<void> => {
    setIsLoading(true);
    try {
      const context: { name?: string; inviteCode?: string } = {};
      if (name) context.name = name;
      if (inviteCode) context.inviteCode = inviteCode;
      
      await authService.requestMagicLink(email, Object.keys(context).length > 0 ? context : undefined);
      // Don't set user here - wait for magic link verification
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyMagicLink = async (token: string, inviteCode?: string): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const authData = await authService.verifyMagicLink(token, inviteCode);
      setUser(authData.user);
      return authData; // Return full response including pendingInvitation
    } catch (error) {
      console.error('Magic link verification error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Clear local state even if server logout fails
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToken = async (): Promise<void> => {
    try {
      await authService.refreshToken();
      // User remains the same, just token is refreshed
    } catch (error) {
      console.error('Token refresh error:', error);
      // If refresh fails, logout user
      try {
        await logout();
      } catch (logoutError) {
        console.error('Logout after refresh failure error:', logoutError);
        // Still clear local state even if logout fails
        setUser(null);
      }
      throw error;
    }
  };

  const updateUser = (): void => {
    // Force update of user state from authService
    const currentUser = authService.getUser();
    setUser(currentUser);
  };

  const value: AuthContextType = {
    user,
    family,
    isAuthenticated: !!user,
    isLoading,
    login,
    verifyMagicLink,
    logout,
    refreshToken,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};