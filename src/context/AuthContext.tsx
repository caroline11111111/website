import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, UserAccount } from '../services/auth';

interface AuthContextType {
  user: UserAccount | null;
  login: (email: string, pass: string) => void;
  register: (name: string, email: string, pass: string, phone: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserAccount | null>(() => authService.getCurrentUser());

  const login = (email: string, pass: string) => {
    const loggedUser = authService.login(email, pass);
    setUser(loggedUser);
  };

  const register = (name: string, email: string, pass: string, phone: string) => {
    const newUser = authService.register(name, email, pass, phone);
    setUser(newUser);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
