import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "hopalong_token";
const ONBOARDING_KEY = "hopalong_onboarding_done";

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  phone_verified: boolean;
  rating: number;
  role: "rider" | "driver" | "both" | null;
  is_verified: boolean;
  profile_picture: string | null;
  upi_vpa: string | null;
  pending_rating_count?: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  onboardingDone: boolean;
  hydrated: boolean;
  pendingRoute: string | null;
  setAuth: (token: string, user: User) => Promise<void>;
  clearAuth: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  loadStoredAuth: () => Promise<void>;
  setOnboardingDone: () => Promise<void>;
  setPendingRoute: (route: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  onboardingDone: false,
  hydrated: false,
  pendingRoute: null,

  setAuth: async (token, user) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token, user });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null, user: null });
  },

  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),

  setOnboardingDone: async () => {
    await SecureStore.setItemAsync(ONBOARDING_KEY, "true");
    set({ onboardingDone: true });
  },

  setPendingRoute: (route) => set({ pendingRoute: route }),

  loadStoredAuth: async () => {
    try {
      const [token, onboarding] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(ONBOARDING_KEY),
      ]);
      set({
        token: token ?? null,
        onboardingDone: onboarding === "true",
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },
}));
