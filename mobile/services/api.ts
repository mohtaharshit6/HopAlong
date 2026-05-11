import axios from "axios";
import { API_BASE_URL } from "../constants/api";
import { useAuthStore } from "../store/authStore";

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear auth so _layout.tsx redirects to login
      useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  }
);

// ---- Auth ----
export const register = (name: string, email: string, password: string, phone?: string) =>
  api.post("/api/auth/register", { name, email, password, phone });

export const login = (email: string, password: string) =>
  api.post("/api/auth/login", { email, password });

// ---- Rides ----
export interface RidePayload {
  start_location: string;
  start_lat?: number;
  start_lng?: number;
  end_location: string;
  end_lat?: number;
  end_lng?: number;
  date: string;
  time: string;
  total_seats: number;
  fare: number;
}

export const getRides = (params?: { lat?: number; lng?: number; radius?: number; date?: string }) =>
  api.get("/api/rides", { params });

export const getRide = (id: string) => api.get(`/api/rides/${id}`);
export const createRide = (payload: RidePayload) => api.post("/api/rides", payload);
export const getMyRides = () => api.get("/api/rides/my");
export const startRide = (id: string) => api.post(`/api/rides/${id}/start`);
export const completeRide = (id: string) => api.post(`/api/rides/${id}/complete`);
export const cancelRide = (id: string) => api.post(`/api/rides/${id}/cancel`);
export const getRideBookings = (ride_id: string) => api.get(`/api/rides/${ride_id}/bookings`);
export const getDriverEarnings = () => api.get("/api/rides/earnings");

// ---- Bookings ----
export const createBooking = (ride_id: string, seats = 1) =>
  api.post("/api/bookings", { ride_id, seats });

export const getMyBookings = () => api.get("/api/bookings/my");
export const cancelBooking = (id: string, reason?: string) =>
  api.delete(`/api/bookings/${id}`, { data: { reason } });
export const verifyPickupOtp = (booking_id: string, otp: string) =>
  api.post(`/api/bookings/${booking_id}/verify-pickup`, { otp });

// ---- Payments ----
export const createPaymentOrder = (booking_id: string) =>
  api.post("/api/payments/create-order", { booking_id });

export const verifyPayment = (data: {
  payment_id: string;
  order_id: string;
  signature: string;
  booking_id: string;
}) => api.post("/api/payments/verify", data);

export const getPaymentStatus = (booking_id: string) =>
  api.get(`/api/payments/status/${booking_id}`);

// ---- Bids ----
export const createBid = (ride_id: string, offered_fare: number, seats: number, message?: string) =>
  api.post("/api/bids", { ride_id, offered_fare, seats, message });

export const getMyBids = () => api.get("/api/bids/mine");
export const getRideBids = (ride_id: string) => api.get(`/api/bids/ride/${ride_id}`);
export const acceptBid = (bid_id: string) => api.post(`/api/bids/${bid_id}/accept`);
export const rejectBid = (bid_id: string) => api.post(`/api/bids/${bid_id}/reject`);
export const counterBid = (bid_id: string, counter_fare: number) =>
  api.post(`/api/bids/${bid_id}/counter`, { counter_fare });
export const acceptCounter = (bid_id: string) => api.post(`/api/bids/${bid_id}/accept-counter`);
export const rejectCounter = (bid_id: string) => api.post(`/api/bids/${bid_id}/reject-counter`);

// ---- Ratings ----
export const submitRating = (booking_id: string, rated_user_id: string, score: number, comment?: string) =>
  api.post("/api/ratings", { booking_id, rated_user_id, score, comment });

export const getPendingRatings = () => api.get("/api/ratings/pending");

// ---- Users ----
export const registerPushToken = (push_token: string) =>
  api.put("/api/users/me/push-token", { push_token });

export const getMe = () => api.get("/api/auth/me");
export const updateMe = (data: { name?: string; phone?: string }) => api.put("/api/users/me", data);
export const getUser = (id: string) => api.get(`/api/users/${id}`);
export const addVehicle = (data: { make: string; model: string; license_plate: string; color?: string }) =>
  api.post("/api/users/me/vehicles", data);

export default api;
