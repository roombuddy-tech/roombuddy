import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage } from '../services/storage';
import { setAuthFailureHandler } from '../services/api';

type UserRole = 'guest' | 'host';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  isProfileComplete: boolean;
  userRole: UserRole;
  user: any;
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
  });

  const forceLogout = useCallback(() => {
    setState({
      isLoading: false,
      isAuthenticated: false,
      isProfileComplete: false,
      userRole: 'guest',
      user: null,
    });
  }, []);

  useEffect(() => {
    setAuthFailureHandler(forceLogout);
  }, [forceLogout]);

  useEffect(() => {
    (async () => {
      try {
        const token = await storage.getAccessToken();
        const userData = await storage.getUserData();
        if (token && userData) {
          setState({
            isLoading: false,
            isAuthenticated: true,
            isProfileComplete: userData.is_profile_complete ?? false,
            userRole: 'guest',
            user: userData,
          });
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
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
    });
  }, []);

  const logout = useCallback(async () => {
    await storage.clearTokens();
    setState({
      isLoading: false,
      isAuthenticated: false,
      isProfileComplete: false,
      userRole: 'guest',
      user: null,
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