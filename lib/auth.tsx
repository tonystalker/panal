"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface UserSession {
  id: string;
  email: string;
  createdAt: string;
  isLocalOnly: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  session?: UserSession | null;
}

export interface AuthAdapter {
  signUp(email: string, password: string): Promise<AuthResponse>;
  login(email: string, password: string): Promise<AuthResponse>;
  logout(): Promise<void>;
  getSession(): Promise<UserSession | null>;
  requestPasswordReset(email: string): Promise<AuthResponse>;
}

/**
 * Local-First Auth Adapter
 * Personal Analytics runs locally by default without requiring an account.
 * This adapter acts as the clean integration boundary for future encrypted sync,
 * while ensuring no unauthenticated data leaves the client and no fake auth is claimed.
 */
class LocalFirstAuthAdapter implements AuthAdapter {
  private readonly STORAGE_KEY = "pa_early_access_user";

  async signUp(email: string): Promise<AuthResponse> {
    if (!email || !email.includes("@")) {
      return {
        success: false,
        message: "Please provide a valid email address.",
      };
    }

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          this.STORAGE_KEY,
          JSON.stringify({
            email,
            signedUpAt: new Date().toISOString(),
          })
        );
      }
    } catch {
      // Ignore storage errors in restricted environments
    }

    return {
      success: true,
      message:
        "Interest in encrypted sync registered. Your local daily log continues to stay strictly on this device.",
      session: null,
    };
  }

  async login(email: string): Promise<AuthResponse> {
    if (!email || !email.includes("@")) {
      return {
        success: false,
        message: "Please enter a valid email address.",
      };
    }

    return {
      success: true,
      message:
        "Remote sync accounts are in preview. You can continue using Personal Analytics locally with complete privacy.",
      session: null,
    };
  }

  async logout(): Promise<void> {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(this.STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  }

  async getSession(): Promise<UserSession | null> {
    return null;
  }

  async requestPasswordReset(email: string): Promise<AuthResponse> {
    if (!email || !email.includes("@")) {
      return {
        success: false,
        message: "Please enter a valid email address.",
      };
    }

    return {
      success: true,
      message:
        "Password reset is disabled while remote accounts remain in preview. All your data is stored locally.",
    };
  }
}

export const authAdapter: AuthAdapter = new LocalFirstAuthAdapter();

interface AuthContextValue {
  session: UserSession | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<AuthResponse>;
  login: (email: string, password: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<AuthResponse>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: false,
  signUp: (email, password) => authAdapter.signUp(email, password),
  login: (email, password) => authAdapter.login(email, password),
  logout: () => authAdapter.logout(),
  requestPasswordReset: (email) => authAdapter.requestPasswordReset(email),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    authAdapter
      .getSession()
      .then((s) => {
        setSession(s);
        setIsLoading(false);
      })
      .catch(() => {
        setSession(null);
        setIsLoading(false);
      });
  }, []);

  const handleSignUp = async (email: string, password: string) => {
    return authAdapter.signUp(email, password);
  };

  const handleLogin = async (email: string, password: string) => {
    return authAdapter.login(email, password);
  };

  const handleLogout = async () => {
    await authAdapter.logout();
    setSession(null);
  };

  const handlePasswordReset = async (email: string) => {
    return authAdapter.requestPasswordReset(email);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        signUp: handleSignUp,
        login: handleLogin,
        logout: handleLogout,
        requestPasswordReset: handlePasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
