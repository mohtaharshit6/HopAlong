import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  getRide, createBooking, cancelBooking,
  createPaymentOrder, getPaymentStatus, createBid,
} from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import LoginPromptSheet from "../../components/LoginPromptSheet";
import { Colors } from "../../constants/colors";
import { formatPrice, getCurrencySymbol } from "../../utils/currency";
import { API_BASE_URL } from "../../constants/api";

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  // Bidding state
  const [showBid, setShowBid] = useState(false);
  const [bidFare, setBidFare] = useState(0);
  const [bidMessage, setBidMessage] = useState("");
  const [submittingBid, setSubmittingBid] = useState(false);

  const user = useAuthStore((s) => s.user);
  const setPendingRoute = useAuthStore((s) => s.setPendingRoute);
  const router = useRouter();

  useEffect(() => {
    getRide(id)
      .then((res) => {
        setRide(res.data);
        setBidFare(Math.max(10, Math.round(res.data.fare * 0.85)));
      })
      .catch(() => Alert.alert("Error", "Ride not found"))
      .finally(() => setLoading(false));
  }, [id]);

  const guardAuth = (action: () => void) => {
    if (!user) {
      setPendingRoute(`/ride/${id}`);
      setShowPrompt(true);
      return;
    }
    action();
  };

  const handleBook = async () => {
    setBooking(true);
    try {
      const bookRes = await createBooking(id);
      const bookingId = bookRes.data.id;

      // Try to create a Razorpay order; if keys aren't set, skip payment
      let checkoutUrl: string | null = null;
      try {
        await createPaymentOrder(bookingId);
        checkoutUrl = `${API_BASE_URL}/api/payments/checkout/${bookingId}`;
      } catch {
        // Razorpay not configured — confirm without payment
        Alert.alert("Booked!", "Your seat is reserved.", [
          { text: "OK", onPress: () => router.push("/(tabs)/my-rides") },
        ]);
        return;
      }

      // Open Razorpay checkout in the device browser
      await WebBrowser.openBrowserAsync(checkoutUrl, {
        toolbarColor: Colors.primary,
        controlsColor: "#fff",
      });

      // Browser closed — poll up to 6 s for payment confirmation
      let paid = false;
      for (let i = 0; i < 6; i++) {
        try {
          const statusRes = await getPaymentStatus(bookingId);
          if (statusRes.data.payment_status === "held") {
            paid = true;
            break;
          }
        } catch { break; }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (paid) {
        Alert.alert("Payment Successful!", "Your seat is confirmed.", [
          { text: "View My Rides", onPress: () => router.push("/(tabs)/my-rides") },
        ]);
      } else {
        Alert.alert(
          "Payment Not Detected",
          "Didn't complete payment? Your booking will be held briefly. Check My Rides if you did pay.",
          [
            { text: "Check My Rides", onPress: () => router.push("/(tabs)/my-rides") },
            {
              text: "Cancel Booking",
              style: "destructive",
              onPress: async () => {
                try { await cancelBooking(bookingId); } catch {}
              },
            },
          ]
        );
      }
    } catch (err: any) {
      Alert.alert("Booking failed", err.response?.data?.error || "Something went wrong");
    } finally {
      setBooking(false);
    }
  };

  const handleBid = async () => {
    if (bidFare < 1) return;
    setSubmittingBid(true);
    try {
      await createBid(id, bidFare, 1, bidMessage.trim() || undefined);
      setShowBid(false);
      Alert.alert(
        "Bid placed!",
        `Your offer of ${formatPrice(bidFare)} has been sent to the driver. Check My Rides for updates.`,
        [{ text: "OK", onPress: () => router.push("/(tabs)/my-rides") }]
      );
    } catch (err: any) {
      Alert.alert("Bid failed", err.response?.data?.error || "Something went wrong");
    } finally {
      setSubmittingBid(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }
  if (!ride) return null;

  const isOwner = user?.id === ride.driver_id;
  const isFull = ride.available_seats === 0;
  const isScheduled = ride.status === "scheduled";
  const symbol = getCurrencySymbol();

  return (
    <>
      <LoginPromptSheet visible={showPrompt} onClose={() => setShowPrompt(false)} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Route card */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Date</Text>
          <Text style={styles.value}>{ride.date}</Text>

          <Text style={styles.sectionLabel}>Route</Text>
          <View style={styles.routeRow}>
            <View style={styles.routeDots}>
              <View style={[styles.dot, { backgroundColor: Colors.dotFrom }]} />
              <View style={styles.routeLine} />
              <View style={[styles.dot, { backgroundColor: Colors.dotTo }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeText}>{ride.start_location}</Text>
              <Text style={[styles.routeText, { marginTop: 12 }]}>{ride.end_location}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Time</Text>
          <Text style={styles.value}>{ride.time}</Text>

          <View style={styles.divider} />

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{ride.available_seats}</Text>
              <Text style={styles.statLabel}>seats left</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: Colors.primary }]}>{formatPrice(ride.fare)}</Text>
              <Text style={styles.statLabel}>per seat</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{ride.status}</Text>
              <Text style={styles.statLabel}>status</Text>
            </View>
          </View>
        </View>

        {/* Driver card */}
        {ride.driver && (
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>{ride.driver.name?.[0]?.toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.driverName}>{ride.driver.name}</Text>
              <Text style={styles.driverRating}>
                {"★".repeat(Math.round(ride.driver.rating))} {ride.driver.rating?.toFixed(1)}
              </Text>
              {ride.vehicle && (
                <Text style={styles.vehicleText}>
                  {ride.vehicle.color} {ride.vehicle.make} {ride.vehicle.model}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Action buttons */}
        {!isOwner && isScheduled && !isFull && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.bookBtn, booking && styles.bookBtnDisabled]}
              onPress={() => guardAuth(handleBook)}
              disabled={booking}
            >
              {booking
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.bookBtnText}>Book at {formatPrice(ride.fare)}</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bidToggleBtn}
              onPress={() => guardAuth(() => setShowBid((v) => !v))}
            >
              <Text style={styles.bidToggleBtnText}>
                {showBid ? "Cancel" : "Suggest fare"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!isOwner && isScheduled && isFull && (
          <View style={[styles.bookBtn, styles.bookBtnDisabled]}>
            <Text style={styles.bookBtnText}>Fully Booked</Text>
          </View>
        )}

        {/* Bid panel */}
        {showBid && (
          <View style={styles.bidCard}>
            <Text style={styles.bidTitle}>Suggest your fare</Text>
            <Text style={styles.bidSubtitle}>
              Driver asking {formatPrice(ride.fare)} — offer what you think is fair
            </Text>

            <View style={styles.bidFareRow}>
              <TouchableOpacity
                style={styles.fareStepBtn}
                onPress={() => setBidFare((f) => Math.max(10, f - 10))}
              >
                <Text style={styles.fareStepText}>−{symbol}10</Text>
              </TouchableOpacity>

              <View style={styles.bidFareDisplay}>
                <Text style={styles.bidFareCurrency}>{symbol}</Text>
                <Text style={styles.bidFareValue}>{bidFare}</Text>
              </View>

              <TouchableOpacity
                style={styles.fareStepBtn}
                onPress={() => setBidFare((f) => f + 10)}
              >
                <Text style={styles.fareStepText}>+{symbol}10</Text>
              </TouchableOpacity>
            </View>

            {bidFare < ride.fare && (
              <Text style={styles.bidSaving}>
                {formatPrice(ride.fare - bidFare)} less than asking price
              </Text>
            )}
            {bidFare > ride.fare && (
              <Text style={[styles.bidSaving, { color: Colors.success }]}>
                {formatPrice(bidFare - ride.fare)} above asking — driver will likely accept fast
              </Text>
            )}

            <TextInput
              style={styles.bidMessageInput}
              placeholder="Add a note to the driver (optional)"
              placeholderTextColor={Colors.textSecondary}
              value={bidMessage}
              onChangeText={setBidMessage}
              maxLength={200}
            />

            <TouchableOpacity
              style={[styles.placeBidBtn, submittingBid && styles.bookBtnDisabled]}
              onPress={handleBid}
              disabled={submittingBid}
            >
              {submittingBid
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.bookBtnText}>Place Bid at {formatPrice(bidFare)}</Text>}
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, marginTop: 14, marginBottom: 4 },
  value: { fontSize: 16, color: Colors.textPrimary, fontWeight: "500" },
  routeRow: { flexDirection: "row", alignItems: "stretch" },
  routeDots: { alignItems: "center", marginRight: 12, paddingTop: 2 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  routeLine: { width: 2, flex: 1, backgroundColor: Colors.border, marginVertical: 2 },
  routeText: { fontSize: 15, color: Colors.textPrimary, fontWeight: "500" },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  statsRow: { flexDirection: "row", justifyContent: "space-around" },
  stat: { alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "800", color: Colors.textPrimary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  driverCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  driverAvatarText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  driverName: { fontSize: 15, fontWeight: "700", color: Colors.textPrimary },
  driverRating: { fontSize: 13, color: Colors.accent, marginTop: 2 },
  vehicleText: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  actionRow: { gap: 10, marginBottom: 12 },
  bookBtn: { backgroundColor: Colors.primary, borderRadius: 14, padding: 18, alignItems: "center" },
  bookBtnDisabled: { backgroundColor: Colors.textSecondary },
  bookBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  bidToggleBtn: { borderWidth: 2, borderColor: Colors.primary, borderRadius: 14, padding: 14, alignItems: "center" },
  bidToggleBtnText: { color: Colors.primary, fontSize: 15, fontWeight: "700" },

  bidCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, borderWidth: 1.5, borderColor: Colors.primary, marginBottom: 12 },
  bidTitle: { fontSize: 18, fontWeight: "800", color: Colors.textPrimary, marginBottom: 6 },
  bidSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 20 },

  bidFareRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 8 },
  fareStepBtn: { backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  fareStepText: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  bidFareDisplay: { flexDirection: "row", alignItems: "flex-start" },
  bidFareCurrency: { fontSize: 20, fontWeight: "700", color: Colors.textPrimary, marginTop: 6 },
  bidFareValue: { fontSize: 48, fontWeight: "800", color: Colors.textPrimary, lineHeight: 56 },

  bidSaving: { textAlign: "center", fontSize: 13, color: Colors.accent, fontWeight: "600", marginBottom: 16 },
  bidMessageInput: {
    backgroundColor: Colors.background, borderRadius: 12, padding: 12,
    fontSize: 14, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 16,
  },
  placeBidBtn: { backgroundColor: Colors.accent, borderRadius: 14, padding: 18, alignItems: "center" },
});
