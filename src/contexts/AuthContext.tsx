import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { publicAnonKey, serviceRoleKey } from '../utils/supabase/info';

// Directly use the environment variable for local development
const supabaseUrl = 'http://127.0.0.1:54321';
const supabase = createClient(supabaseUrl, publicAnonKey);

interface User {
  id: string;
  email: string;
  name: string;
  role: 'hr' | 'applicant';
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role: 'hr' | 'applicant') => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Updated to use the local function URL
  const serverUrl = `${supabaseUrl}/functions/v1/make-server-76bea622`;

  // Fetch user profile from server
  const fetchProfile = async (token: string) => {
    try {
      const response = await fetch(`${serverUrl}/user/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.profile);
      } else {
        console.error('Failed to fetch profile. Status:', response.status);
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setUser(null);
    }
  };

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session check error:', error);
          setLoading(false);
          return;
        }

        if (data?.session?.access_token) {
          setAccessToken(data.session.access_token);
          await fetchProfile(data.session.access_token);
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data?.session?.access_token) {
        setAccessToken(data.session.access_token);
        await fetchProfile(data.session.access_token);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  };

  const signup = async (email: string, password: string, name: string, role: 'hr' | 'applicant') => {
    try {
      console.log('Starting signup process...', { email, name, role });
      
      const response = await fetch(`${serverUrl}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({ email, password, name, role })
      });

      console.log('Signup response status:', response.status);

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        const errorData = contentType && contentType.includes("application/json") 
          ? await response.json() 
          : await response.text();
        
        throw new Error(typeof errorData === 'string' ? errorData : (errorData.error || 'Signup failed'));
      }

      const signupData = await response.json();
      console.log('Signup successful:', signupData);

      // After signup, login automatically
      console.log('Attempting auto-login after signup...');
      await login(email, password);
    } catch (error: any) {
      console.error('Signup error:', error);
      throw new Error(error.message || 'Signup failed');
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setAccessToken(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshProfile = async () => {
    if (accessToken) {
      await fetchProfile(accessToken);
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, signup, logout, refreshProfile }}>
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