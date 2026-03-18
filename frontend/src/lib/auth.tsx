'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from './api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  accountStatus: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  county?: string;
  postalCode?: string;
  customer?: {
    customerCode: string;
    accountNumber: string;
    balance: number;
    creditLimit: number;
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1?: string;
  city?: string;
  county?: string;
  postalCode?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cookie helpers for middleware-based route protection
function setAuthCookies(role?: string, accessToken?: string) {
  if (typeof document === 'undefined') return;
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  // Set a marker cookie for the middleware (actual auth is via localStorage/bearer token)
  document.cookie = `isp_authenticated=true; path=/; max-age=${maxAge}; SameSite=lax`;
  if (role) {
    document.cookie = `isp_user_role=${role}; path=/; max-age=${maxAge}; SameSite=lax`;
  }
  if (accessToken) {
    document.cookie = `isp_access_token=${accessToken}; path=/; max-age=${maxAge}; SameSite=lax`;
  }
}

function clearAuthCookies() {
  if (typeof document === 'undefined') return;
  document.cookie = 'isp_authenticated=; path=/; max-age=0';
  document.cookie = 'isp_user_role=; path=/; max-age=0';
  document.cookie = 'isp_access_token=; path=/; max-age=0';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const loadUser = useCallback(async () => {
    try {
      const storedUser = api.getUser();
      const tokens = api.getTokens();
      if (!tokens?.accessToken) {
        setIsLoading(false);
        return;
      }

      if (storedUser) {
        setUser(storedUser as unknown as User);
        setAuthCookies((storedUser as unknown as User).role, tokens.accessToken);
      }

      // Always fetch fresh profile
      const response = await api.getProfile();
      if (response.success && response.data?.user) {
        const freshUser = response.data.user as unknown as User;
        setUser(freshUser);
        api.setUser(freshUser as unknown as Record<string, unknown>);
      }
    } catch {
      api.clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    if (response.success && response.data) {
      api.setTokens(response.data.tokens);
      const userData = response.data.user as unknown as User;
      setUser(userData);
      api.setUser(response.data.user as Record<string, unknown>);
      setAuthCookies(userData.role, response.data.tokens.accessToken);
    }
  };

  const register = async (data: RegisterData) => {
    const response = await api.register(data as unknown as Record<string, unknown> & { email: string; password: string; firstName: string; lastName: string; phone: string });
    if (response.success && response.data) {
      api.setTokens(response.data.tokens);
      const userData = response.data.user as unknown as User;
      setUser(userData);
      api.setUser(response.data.user as Record<string, unknown>);
      setAuthCookies(userData.role, response.data.tokens.accessToken);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout errors
    }
    api.clearTokens();
    clearAuthCookies();
    setUser(null);
    router.push('/login');
  };

  const refreshUser = async () => {
    await loadUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// HOC for protected pages
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function ProtectedComponent(props: P) {
    const { isAuthenticated, isLoading, user } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        router.push('/login');
      }
    }, [isAuthenticated, isLoading, router]);

    if (isLoading) {
      return (
        <div className="flex h-screen items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      );
    }

    if (!isAuthenticated) return null;

    return <Component {...props} />;
  };
}
