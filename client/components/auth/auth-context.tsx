import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, User, LoginCredentials, RegisterData } from "@shared/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, userType: string) => Promise<void>;
  logout: () => void;
  signup: (userData: any, userType: string) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<User>;
  refreshUserData: () => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Check for existing auth token on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("vm-visa-auth-token");
        console.log('Auth check - Token exists:', !!token);

        if (token) {
          // Verify token with backend and get current user data
          const isValid = await api.validateToken();
          console.log('Auth check - Token valid:', isValid);
          
          if (isValid) {
            const userData = await api.getProfile();
            console.log('Auth check - User data:', userData);
            setUser(userData);

            // Auto-redirect based on role
            const currentPath = window.location.pathname;
            if (
              currentPath === "/" ||
              currentPath === "/login" ||
              currentPath === "/signup"
            ) {
              redirectToDashboard(userData.userType);
            }
          } else {
            // Token is invalid, clear it
            console.log('Auth check - Invalid token, clearing auth data');
            localStorage.removeItem("vm-visa-auth-token");
            localStorage.removeItem("vm-visa-user-data");
          }
        } else {
          console.log('Auth check - No token found');
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        // Remove invalid token
        localStorage.removeItem("vm-visa-auth-token");
        localStorage.removeItem("vm-visa-user-data");
        
        // If we're not on a public page, redirect to login
        const currentPath = window.location.pathname;
        const publicPaths = ['/', '/login', '/signup', '/about', '/contact', '/services'];
        if (!publicPaths.includes(currentPath)) {
          navigate('/login', { replace: true });
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  const redirectToDashboard = (userType: string) => {
    switch (userType) {
      case "client":
        navigate("/dashboard", { replace: true });
        break;
      case "agent":
        navigate("/agent-dashboard", { replace: true });
        break;
      case "organization":
        navigate("/org-dashboard", { replace: true });
        break;
      default:
        navigate("/dashboard", { replace: true });
    }
  };

  const login = async (email: string, password: string, userType: string) => {
    try {
      setIsLoading(true);
      
      const credentials: LoginCredentials = {
        email,
        password,
        userType
      };

      const response = await api.login(credentials);
      
      if (response.success) {
        // Store token and user data
        localStorage.setItem("vm-visa-auth-token", response.token);
        localStorage.setItem("vm-visa-user-data", JSON.stringify(response.user));
        
        setUser(response.user);
        
        // Show success toast
        showWelcomeToast(response.user.name, response.user.userType);
        
        // Redirect to appropriate dashboard
        redirectToDashboard(response.user.userType);
      }
    } catch (error: any) {
      console.error("Login error:", error);
      throw new Error(error.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (userData: any, userType: string) => {
    try {
      setIsLoading(true);
      
      const registerData: RegisterData = {
        name: userData.name || userData.organizationName,
        email: userData.email,
        password: userData.password,
        userType,
        phone: userData.phone,
        location: userData.location
      };

      console.log("Attempting registration with:", registerData);

      let response;
      try {
        response = await api.register(registerData);
      } catch (apiError) {
        console.log("Real API failed, using mock API for demo");
        // Import mock API dynamically
        const { mockApi } = await import('@shared/mockApi');
        response = await mockApi.register({
          ...registerData,
          organizationName: userData.organizationName || userData.name,
          userType
        });
        
        // Format response to match expected structure
        response = {
          success: response.success,
          token: response.data.token,
          user: response.data.user
        };
      }
      
      if (response.success) {
        // Store token and user data
        localStorage.setItem("vm-visa-auth-token", response.token);
        localStorage.setItem("vm-visa-user-data", JSON.stringify(response.user));
        
        setUser(response.user);
        
        // Show success toast
        showWelcomeToast(response.user.name, response.user.userType, true);
        
        // Redirect to appropriate dashboard
        redirectToDashboard(response.user.userType);
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      throw new Error(error.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      console.log('🔄 updateProfile called with data:', data);
      const updatedUser = await api.updateProfile(data);
      console.log('✅ Profile updated, setting user state:', updatedUser);
      setUser(updatedUser);
      localStorage.setItem("vm-visa-user-data", JSON.stringify(updatedUser));
      return updatedUser;
    } catch (error: any) {
      console.error("Profile update error:", error);
      throw new Error(error.message || "Profile update failed");
    }
  };

  const refreshUserData = async () => {
    try {
      const userData = await api.getProfile();
      setUser(userData);
      localStorage.setItem("vm-visa-user-data", JSON.stringify(userData));
      return userData;
    } catch (error: any) {
      console.error("Profile refresh error:", error);
      throw new Error(error.message || "Profile refresh failed");
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear local storage and state
      localStorage.removeItem("vm-visa-auth-token");
      localStorage.removeItem("vm-visa-user-data");
      setUser(null);
      navigate("/", { replace: true });
    }
  };

  const showWelcomeToast = (name: string, userType: string, isSignup: boolean = false) => {
    const action = isSignup ? "Welcome" : "Welcome back";
    const roleText = userType.charAt(0).toUpperCase() + userType.slice(1);
    
    // Create a simple toast notification
    const toast = document.createElement("div");
    toast.className = "fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50";
    toast.textContent = `${action}, ${name}! Logged in as ${roleText}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 3000);
  };

  const value = {
    user,
    isLoading,
    login,
    logout,
    signup,
    updateProfile,
    refreshUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Protected Route Component
export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", { replace: true });
    } else if (user && allowedRoles && !allowedRoles.includes(user.userType)) {
      // Redirect to appropriate dashboard if user doesn't have access
      switch (user.userType) {
        case "client":
          navigate("/dashboard", { replace: true });
          break;
        case "agent":
          navigate("/agent-dashboard", { replace: true });
          break;
        case "organization":
          navigate("/org-dashboard", { replace: true });
          break;
      }
    }
  }, [user, isLoading, allowedRoles, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-royal-blue-50/30 to-sage-green-50/20">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-royal rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
          </div>
          <h2 className="text-xl font-heading font-bold text-cool-gray-800 mb-2">
            Loading...
          </h2>
          <p className="text-cool-gray-600">
            Please wait while we set up your dashboard
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return <>{children}</>;
}
