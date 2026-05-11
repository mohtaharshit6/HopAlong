// Update API_BASE_URL to your deployed backend URL for production
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:5000"; // 10.0.2.2 = Android emulator localhost
export const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || "";
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
export const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || "";
