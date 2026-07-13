import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ENDPOINTS } from '../constants/endpoints';
import api, { setAuthFailureHandler } from '../services/api';
import { registerForPushNotificationsAsync, unregisterPushToken } from '../services/push';
import { storage } from '../services/storage';

type UserRole = 'guest' | 'host';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  isProfileComplete: boolean;
  userRole: UserRole;
  user: any;
  didLogout: boolean;
}

interface AuthContextType extends AuthState {
  login: (tokens: { access: string; refresh: string }, userData: any) => Promise<void>;
  logout: () => Promise<void>;
  completeProfile: (userData: any) => Promise<void>;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    isProfileComplete: false,
    userRole: 'guest',
    user: null,
    didLogout: false,
  });

  const forceLogout = useCallback(() => {
    setState({
      isLoading: false,
      isAuthenticated: false,
      isProfileComplete: false,
      userRole: 'guest',
      user: null,
      didLogout: true,
    });
  }, []);

  useEffect(() => {
    setAuthFailureHandler(forceLogout);
  }, [forceLogout]);

  // Register this device for push notifications once the user is authenticated.
  useEffect(() => {
    if (state.isAuthenticated) {
      registerForPushNotificationsAsync();
    }
  }, [state.isAuthenticated]);

  // Session restore: if we have a token, fetch fresh profile from backend
  useEffect(() => {
    (async () => {
      try {
        const token = await storage.getAccessToken();
        const userData = await storage.getUserData();
        if (!token || !userData) {
          setState((prev) => ({ ...prev, isLoading: false }));
          return;
        }

        // Fetch fresh profile to get real is_profile_complete status
        try {
          const res = await api.get(ENDPOINTS.USER.PROFILE);
          const profile = res.data;
          const isComplete = !!(profile.first_name && profile.first_name.length > 0);
          const freshUser = { ...userData, ...profile, is_profile_complete: isComplete };
          await storage.saveUserData(freshUser);
          setState({
            isLoading: false,
            isAuthenticated: true,
            isProfileComplete: isComplete,
            userRole: 'guest',
            user: freshUser,
            didLogout: false,
          });
        } catch {
          setState({
            isLoading: false,
            isAuthenticated: true,
            isProfileComplete: userData.is_profile_complete ?? false,
            userRole: 'guest',
            user: userData,
            didLogout: false,
          });
        }
      } catch {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    })();
  }, []);

  const login = useCallback(async (tokens: { access: string; refresh: string }, userData: any) => {
    await storage.saveTokens(tokens.access, tokens.refresh);
    await storage.saveUserData(userData);
    setState({
      isLoading: false,
      isAuthenticated: true,
      isProfileComplete: userData.is_profile_complete ?? false,
      userRole: 'guest',
      user: userData,
      didLogout: false,
    });

    if (userData.is_profile_complete) {
      try {
        const res = await api.get(ENDPOINTS.USER.PROFILE);
        const profile = res.data;
        const freshUser = { ...userData, ...profile, is_profile_complete: true };
        await storage.saveUserData(freshUser);
        setState((prev) => ({ ...prev, user: freshUser }));
      } catch {
        // Non-blocking — we already have basic auth state
      }
    }
  }, []);

  const logout = useCallback(async () => {
    // Deactivate the push token while we still have a valid auth token.
    await unregisterPushToken();
    await storage.clearTokens();
    setState({
      isLoading: false,
      isAuthenticated: false,
      isProfileComplete: false,
      userRole: 'guest',
      user: null,
      didLogout: true,
    });
  }, []);

  const completeProfile = useCallback(async (userData: any) => {
    const updated = { ...state.user, ...userData, is_profile_complete: true };
    await storage.saveUserData(updated);
    setState((prev) => ({ ...prev, isProfileComplete: true, user: updated }));
  }, [state.user]);

  const switchRole = useCallback((role: UserRole) => {
    setState((prev) => ({ ...prev, userRole: role }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, completeProfile, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}