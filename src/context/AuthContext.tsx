import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
}

interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  address: string;
  password: string;
}

interface AuthContextType {
  user: UserAccount | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<{ confirmationRequired: boolean }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function accountFromUser(authUser: User): UserAccount {
  const metadata = authUser.user_metadata || {};
  return {
    id: authUser.id,
    name: String(metadata.full_name || metadata.name || ''),
    email: authUser.email || '',
    phone: String(metadata.phone || ''),
    whatsapp: String(metadata.whatsapp || metadata.phone || ''),
    address: String(metadata.address || ''),
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) console.error('Unable to restore Supabase session:', error.message);
      setSession(data.session);
      setUser(data.session?.user ? accountFromUser(data.session.user) : null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ? accountFromUser(nextSession.user) : null);
      setLoading(false);
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    if (!isSupabaseConfigured) throw new Error('The store is not connected to Supabase yet.');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  };

  const register = async (input: RegisterInput) => {
    if (!isSupabaseConfigured) throw new Error('The store is not connected to Supabase yet.');
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          full_name: input.name.trim(),
          phone: input.phone.trim(),
          address: input.address.trim(),
        },
      },
    });
    if (error) throw error;
    if (data.session?.user) {
      setSession(data.session);
      setUser(accountFromUser(data.session.user));
    }
    return { confirmationRequired: !data.session };
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated: !!session }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
