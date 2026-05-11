import { useEffect, useState } from "react";
import {
  View, Text, FlatList, StyleSheet, Modal, Pressable,
  TouchableOpacity, Alert, ActivityIndicator, Switch,
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  getMyRides, getMyBookings, getPendingRatings,
  getDriverEarnings, getMyBids, acceptCounter, rejectCounter,
  startRide, completeRide, cancelRide, cancelBooking,
  createPaymentOrder, getPaymentStatus, confirmManualPayment,
} from "../../services/api";
import { Linking } from "react-native";
import { useAuthStore } from "../../store/authStore";
import { Colors } from "../../constants/colors";
import { formatPrice } from "../../utils/currency";
import { API_BASE_URL } from "../../constants/api";

const STATUS_COLORS: Record<string, string> = {
  scheduled: Colors.primary,
  in_progress: Colors.success,
  completed: Colors.textSecondary,
  cancelled: Colors.error,
};

function getBidColor(status: string) {
  switch (status) {
    case "pending": return Colors.primary;
    case "countered": return "#f59e0b";
    case "accepted":
    case "counter_accepted": return Colors.success;
    default: return Colors.error;
  }
}

// ─── Driver Dashboard ──────────────────────────────────────────────────────────

function DriverDashboard({ offers }: { offers: any[] }) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [earnings, setEarnings] = useState<{ today: number; total: number; rides_completed: number } | null>(null);

  useEffect(() => {
    getDriverEarnings().then((res) => setEarnings(res.data)).catch(() => {});
  }, []);

  const activeRide = offers.find((r) => r.status === "in_progress");

  return (
    <View style={styles.dashCard}>
      <View style={styles.dashHeader}>
        <Text style={styles.dashTitle}>Driver Dashboard</Text>
        <View style={styles.onlineRow}>
          <Text style={[styles.onlineLabel, { color: online ? Colors.success : Colors.textSecondary }]}>
            {online ? "Online" : "Offline"}
          </Text>
          <Switch
            value={online}
            onValueChange={setOnline}
            trackColor={{ false: Colors.border, true: Colors.success }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {earnings && (
        <View style={styles.earningsRow}>
          <View style={styles.earningsStat}>
            <Text style={styles.earningsValue}>{formatPrice(earnings.today)}</Text>
            <Text style={styles.earningsLabel}>Today</Text>
          </View>
          <View style={styles.earningsDivider} />
          <View style={styles.earningsStat}>
            <Text style={styles.earningsValue}>{formatPrice(earnings.total)}</Text>
            <Text style={styles.earningsLabel}>All-time</Text>
          </View>
          <View style={styles.earningsDivider} />
          <View style={styles.earningsStat}>
            <Text style={styles.earningsValue}>{earnings.rides_completed}</Text>
            <Text style={styles.earningsLabel}>Rides done</Text>
          </View>
        </View>
      )}

      {activeRide && (
        <TouchableOpacity
          style={styles.activeRideBanner}
          onPress={() => router.push(`/driver/active/${activeRide.id}`)}
        >
          <Text style={styles.activeRideText}>Active ride in progress — Manage Riders</Text>
          <Text style={styles.activeRideArrow}>→</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Ride Row (driver's offered rides) ────────────────────────────────────────

function RideRow({
  ride,
  onAction,
  pendingRiderBookings = [],
}: {
  ride: any;
  onAction: () => void;
  pendingRiderBookings?: any[];
}) {
  const router = useRouter();

  const confirm = (action: () => Promise<any>, label: string) => {
    Alert.alert("Confirm", `${label} this ride?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: label,
        onPress: async () => {
          try { await action(); onAction(); }
          catch (e: any) { Alert.alert("Error", e.response?.data?.error || "Action failed"); }
        },
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.route} numberOfLines={1}>
          {ride.start_location} to {ride.end_location}
        </Text>
        <Text style={[styles.status, { color: STATUS_COLORS[ride.status] }]}>{ride.status}</Text>
      </View>
      <Text style={styles.meta}>
        {ride.date} · {ride.time} · {formatPrice(ride.fare)} · {ride.available_seats}/{ride.total_seats} seats
      </Text>

      <View style={styles.actions}>
        {ride.status === "scheduled" && (
          <>
            <TouchableOpacity
              style={styles.btnBids}
              onPress={() => router.push(`/driver/bids/${ride.id}`)}
            >
              <Text style={styles.btnPrimaryText}>View Bids</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGreen} onPress={() => confirm(() => startRide(ride.id), "Start")}>
              <Text style={styles.btnText}>Start</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnRed} onPress={() => confirm(() => cancelRide(ride.id), "Cancel")}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
        {ride.status === "in_progress" && (
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.push(`/driver/active/${ride.id}`)}
          >
            <Text style={styles.btnText}>Manage Riders</Text>
          </TouchableOpacity>
        )}
        {ride.status === "in_progress" && (
          <TouchableOpacity style={styles.btnGreen} onPress={() => confirm(() => completeRide(ride.id), "Complete")}>
            <Text style={styles.btnText}>Complete</Text>
          </TouchableOpacity>
        )}

        {/* 1f: Rate each unrated rider after ride completes */}
        {ride.status === "completed" && pendingRiderBookings.map((b) => (
          <TouchableOpacity
            key={b.id}
            style={styles.btnRate}
            onPress={() =>
              router.push({
                pathname: "/rate/[booking_id]",
                params: {
                  booking_id: b.id,
                  rated_user_id: b.rider_id,
                  name: b.rider?.name || "Rider",
                  context: "rider",
                },
              })
            }
          >
            <Text style={styles.btnText}>
              Rate {b.rider?.name?.split(" ")[0] || "Rider"} ★
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Booking Row (rider's confirmed bookings) ──────────────────────────────────

function BookingRow({
  booking,
  pendingRatingIds,
  onAction,
}: {
  booking: any;
  pendingRatingIds: Set<string>;
  onAction: () => void;
}) {
  const router = useRouter();
  const ride = booking.ride;
  const [paying, setPaying] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const CANCEL_REASONS = [
    "Change of plans",
    "Found another ride",
    "Driver too far",
    "Fare too high",
    "Wrong route details",
    "Other",
  ];

  const handleCancelConfirm = async () => {
    setCancelling(true);
    try {
      await cancelBooking(booking.id, cancelReason ?? undefined);
      setCancelModal(false);
      onAction();
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.error || "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  };

  const canRate =
    booking.status === "confirmed" &&
    ride?.status === "completed" &&
    pendingRatingIds.has(booking.id);

  // Show Pay Now only for online payments still pending
  const needsPayment =
    booking.status === "confirmed" &&
    booking.payment_status === "pending" &&
    booking.payment_method !== "cash" &&
    booking.payment_method !== "upi" &&
    ride?.status !== "completed" &&
    ride?.status !== "cancelled";

  const isUpiPending = booking.payment_method === "upi" && booking.payment_status === "upi_pending";
  const isCashPending = booking.payment_method === "cash" && booking.payment_status === "cash_pending";

  const openUpiApp = async () => {
    const vpa = ride?.driver?.upi_vpa;
    const fare = Math.round(booking.agreed_fare ?? ride?.fare ?? 0);
    const driverName = encodeURIComponent(ride?.driver?.name || "Driver");
    const note = encodeURIComponent("HopAlong Ride");
    if (!vpa) { Alert.alert("UPI ID not set", "Ask the driver for their UPI ID to pay."); return; }
    const url = `upi://pay?pa=${vpa}&pn=${driverName}&am=${fare}&cu=INR&tn=${note}`;
    const ok = await Linking.canOpenURL(url);
    if (ok) Linking.openURL(url);
    else Alert.alert("No UPI App Found", `Pay ₹${fare} to ${vpa} manually.`);
  };

  const handlePayNow = async () => {
    setPaying(true);
    try {
      // Idempotently create/fetch the Razorpay order
      try {
        await createPaymentOrder(booking.id);
      } catch (e: any) {
        // order may already exist — that's fine; proceed to checkout
        if (e.response?.status !== 400) {
          Alert.alert("Error", "Could not initiate payment. Please try again.");
          return;
        }
      }

      const checkoutUrl = `${API_BASE_URL}/api/payments/checkout/${booking.id}`;
      await WebBrowser.openBrowserAsync(checkoutUrl, {
        toolbarColor: Colors.primary,
        controlsColor: "#fff",
      });

      // Poll up to 6 s for payment confirmation
      for (let i = 0; i < 6; i++) {
        try {
          const statusRes = await getPaymentStatus(booking.id);
          if (statusRes.data.payment_status === "held") {
            onAction(); // refresh the list
            Alert.alert("Payment Successful!", "Your booking is confirmed.");
            return;
          }
        } catch { break; }
        await new Promise((r) => setTimeout(r, 1000));
      }

      Alert.alert(
        "Payment Not Detected",
        "If you completed the payment, it may still be processing. Pull down to refresh.",
        [{ text: "OK" }]
      );
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      {/* Cancellation reason modal */}
      <Modal visible={cancelModal} transparent animationType="slide" onRequestClose={() => setCancelModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCancelModal(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Why are you cancelling?</Text>
            <Text style={styles.modalSub}>This helps drivers improve their service</Text>
            {CANCEL_REASONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.reasonRow, cancelReason === r && styles.reasonRowActive]}
                onPress={() => setCancelReason(r)}
              >
                <View style={[styles.reasonDot, cancelReason === r && styles.reasonDotActive]} />
                <Text style={[styles.reasonText, cancelReason === r && styles.reasonTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.confirmCancelBtn, cancelling && styles.btnDisabled]}
              onPress={handleCancelConfirm}
              disabled={cancelling}
            >
              {cancelling
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>Confirm Cancellation</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.keepBtn} onPress={() => setCancelModal(false)}>
              <Text style={styles.keepBtnText}>Keep my booking</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.route} numberOfLines={1}>
            {ride?.start_location} to {ride?.end_location}
          </Text>
          <Text style={[styles.status, { color: STATUS_COLORS[booking.status] }]}>{booking.status}</Text>
        </View>
        <Text style={styles.meta}>
          {ride?.date} · {ride?.time} · {formatPrice(booking.agreed_fare ?? ride?.fare)} · {booking.seats_booked} seat(s)
        </Text>

        {needsPayment && (
          <View style={styles.payNowBanner}>
            <Text style={styles.payNowLabel}>Payment pending</Text>
            <Text style={styles.payNowHint}>Complete payment to confirm your seat</Text>
          </View>
        )}

        {isUpiPending && (
          <View style={styles.upiPendingBanner}>
            <Text style={styles.upiPendingLabel}>UPI payment — waiting for driver to confirm</Text>
            {ride?.driver?.upi_vpa && (
              <Text style={styles.upiPendingVpa}>UPI: {ride.driver.upi_vpa}</Text>
            )}
          </View>
        )}

        {booking.pickup_otp && booking.status === "confirmed" &&
          ride?.status !== "completed" && ride?.status !== "cancelled" &&
          ["held", "upi_received", "cash_collected"].includes(booking.payment_status) && (
          <View style={styles.otpBox}>
            <Text style={styles.otpLabel}>Your pickup code</Text>
            <Text style={styles.otpValue}>{booking.pickup_otp}</Text>
            <Text style={styles.otpHint}>Show this to your driver at pickup</Text>
          </View>
        )}

        <View style={styles.actions}>
          {needsPayment && (
            <TouchableOpacity
              style={[styles.btnPayNow, paying && styles.btnDisabled]}
              onPress={handlePayNow}
              disabled={paying}
            >
              {paying
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>Pay Now</Text>}
            </TouchableOpacity>
          )}

          {isUpiPending && (
            <TouchableOpacity style={styles.btnUpi} onPress={openUpiApp}>
              <Text style={styles.btnText}>📱 Open UPI App</Text>
            </TouchableOpacity>
          )}

          {isCashPending && (
            <View style={styles.cashBadge}>
              <Text style={styles.cashBadgeText}>💵 Pay driver at pickup</Text>
            </View>
          )}

          {ride?.status === "in_progress" && (
            <TouchableOpacity
              style={styles.btnTrack}
              onPress={() => router.push(`/ride/tracking/${ride.id}` as any)}
            >
              <Text style={styles.btnText}>📍 Track Ride</Text>
            </TouchableOpacity>
          )}

          {booking.status === "confirmed" && ride?.status === "scheduled" && (
            <TouchableOpacity
              style={styles.btnRed}
              onPress={() => { setCancelReason(null); setCancelModal(true); }}
            >
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
          )}

          {canRate && (
            <TouchableOpacity
              style={styles.btnRate}
              onPress={() =>
                router.push({
                  pathname: "/rate/[booking_id]",
                  params: {
                    booking_id: booking.id,
                    rated_user_id: ride.driver_id,
                    name: ride.driver?.name || "Driver",
                    context: "driver",
                  },
                })
              }
            >
              <Text style={styles.btnText}>Rate Driver ★</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </>
  );
}

// ─── Bid Row (rider's active bids) ────────────────────────────────────────────

function BidRow({ bid, onAction }: { bid: any; onAction: () => void }) {
  const router = useRouter();
  const ride = bid.ride;
  const isCountered = bid.status === "countered";
  const isActive = ["pending", "countered"].includes(bid.status);

  return (
    <View style={[styles.card, isActive && { borderColor: Colors.accent, borderWidth: 1.5 }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.route} numberOfLines={1}>
          {ride?.start_location} to {ride?.end_location}
        </Text>
        <Text style={[styles.status, { color: getBidColor(bid.status) }]}>{bid.status}</Text>
      </View>
      <Text style={styles.meta}>
        Your bid: {formatPrice(bid.offered_fare)} · {bid.seats} seat{bid.seats > 1 ? "s" : ""}
        {ride ? ` · ${ride.date}` : ""}
      </Text>

      {isCountered && bid.counter_fare && (
        <View style={styles.counterOfferBox}>
          <Text style={styles.counterOfferLabel}>Driver countered at</Text>
          <Text style={styles.counterOfferFare}>{formatPrice(bid.counter_fare)}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.btnGreen}
              onPress={async () => {
                try {
                  await acceptCounter(bid.id);
                  onAction();
                  Alert.alert("Accepted!", `Booking created at ${formatPrice(bid.counter_fare)}.`);
                } catch (e: any) {
                  Alert.alert("Error", e.response?.data?.error || "Failed");
                }
              }}
            >
              <Text style={styles.btnText}>Accept {formatPrice(bid.counter_fare)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnRed}
              onPress={async () => {
                try { await rejectCounter(bid.id); onAction(); }
                catch (e: any) { Alert.alert("Error", e.response?.data?.error || "Failed"); }
              }}
            >
              <Text style={styles.btnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {bid.status === "pending" && (
        <Text style={styles.bidPending}>Waiting for driver response…</Text>
      )}
      {(bid.status === "accepted" || bid.status === "counter_accepted") && (
        <Text style={styles.bidResolved}>Booking created — check My Bookings</Text>
      )}
      {(bid.status === "rejected" || bid.status === "counter_rejected") && (
        <Text style={[styles.bidResolved, { color: Colors.error }]}>Bid declined</Text>
      )}
      {bid.status === "expired" && (
        <Text style={[styles.bidResolved, { color: Colors.textSecondary }]}>Bid expired</Text>
      )}

      {ride && isActive && (
        <TouchableOpacity style={{ marginTop: 8 }} onPress={() => router.push(`/ride/${ride.id}`)}>
          <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: "600" }}>View ride →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function MyRidesScreen() {
  const user = useAuthStore((s) => s.user);
  const isDriver = user?.role === "driver" || user?.role === "both";

  const [tab, setTab] = useState<"offered" | "booked">("offered");
  const [offers, setOffers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [myBids, setMyBids] = useState<any[]>([]);
  // booking IDs where the current user (as rider) still needs to rate the driver
  const [pendingRatingIds, setPendingRatingIds] = useState<Set<string>>(new Set());
  // ride_id → [pending bookings] where the current user (as driver) still needs to rate each rider
  const [driverPendingByRide, setDriverPendingByRide] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [offersRes, bookingsRes, pendingRes, bidsRes] = await Promise.all([
        getMyRides(),
        getMyBookings(),
        getPendingRatings(),
        getMyBids(),
      ]);
      setOffers(offersRes.data);
      setBookings(bookingsRes.data);
      setMyBids(bidsRes.data);

      // Split pending ratings by context
      const riderPendingIds = new Set<string>();
      const byRide: Record<string, any[]> = {};

      (pendingRes.data as any[]).forEach((b) => {
        if (b.context === "rate_rider") {
          // Driver needs to rate this rider
          if (!byRide[b.ride_id]) byRide[b.ride_id] = [];
          byRide[b.ride_id].push(b);
        } else {
          // "rate_driver" or legacy (no context field) — rider rates driver
          riderPendingIds.add(b.id);
        }
      });

      setPendingRatingIds(riderPendingIds);
      setDriverPendingByRide(byRide);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const activeBids = myBids.filter((b) => ["pending", "countered"].includes(b.status));
  const inactiveBids = myBids.filter((b) => !["pending", "countered"].includes(b.status));

  const bookedData: Array<{ type: "bid" | "booking"; item: any }> = [
    ...activeBids.map((b) => ({ type: "bid" as const, item: b })),
    ...bookings.map((b) => ({ type: "booking" as const, item: b })),
    ...inactiveBids.map((b) => ({ type: "bid" as const, item: b })),
  ];

  const totalPending = pendingRatingIds.size + Object.values(driverPendingByRide).flat().length;

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {(["offered", "booked"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "offered"
                ? "My Offers"
                : `My Bookings${activeBids.length > 0 ? ` (${activeBids.length})` : ""}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : tab === "offered" ? (
        <FlatList
          data={offers}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={isDriver ? <DriverDashboard offers={offers} /> : null}
          renderItem={({ item }) => (
            <RideRow
              ride={item}
              onAction={fetchAll}
              pendingRiderBookings={driverPendingByRide[item.id] || []}
            />
          )}
          contentContainerStyle={offers.length === 0 ? styles.center : styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No rides offered yet.</Text>}
          refreshing={loading}
          onRefresh={fetchAll}
        />
      ) : (
        <FlatList
          data={bookedData}
          keyExtractor={(item) => item.item.id}
          renderItem={({ item: { type, item } }) =>
            type === "bid"
              ? <BidRow bid={item} onAction={fetchAll} />
              : <BookingRow booking={item} pendingRatingIds={pendingRatingIds} onAction={fetchAll} />
          }
          contentContainerStyle={bookedData.length === 0 ? styles.center : styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No bookings or bids yet.</Text>}
          refreshing={loading}
          onRefresh={fetchAll}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabBar: {
    flexDirection: "row", backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: 14, color: Colors.textSecondary, fontWeight: "600" },
  tabTextActive: { color: Colors.primary },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: Colors.textSecondary, fontSize: 15 },

  // Driver Dashboard
  dashCard: {
    backgroundColor: Colors.primary, borderRadius: 16,
    padding: 16, marginBottom: 16, marginTop: 4,
  },
  dashHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  dashTitle: { fontSize: 15, fontWeight: "700", color: "#fff" },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  onlineLabel: { fontSize: 13, fontWeight: "700" },
  earningsRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 14 },
  earningsStat: { alignItems: "center" },
  earningsValue: { fontSize: 20, fontWeight: "800", color: "#fff" },
  earningsLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  earningsDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)" },
  activeRideBanner: {
    backgroundColor: Colors.success, borderRadius: 10,
    padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  activeRideText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  activeRideArrow: { color: "#fff", fontSize: 16, fontWeight: "800" },

  // Cards
  card: {
    backgroundColor: Colors.surface, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  route: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary, flex: 1, marginRight: 8 },
  status: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  meta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  // Payment pending banner
  payNowBanner: {
    backgroundColor: "#fef3c7", borderRadius: 8, padding: 10,
    marginTop: 10, borderWidth: 1, borderColor: "#fde68a",
  },
  payNowLabel: { fontSize: 12, fontWeight: "700", color: "#92400e" },
  payNowHint: { fontSize: 11, color: "#b45309", marginTop: 2 },

  // Pickup OTP box
  otpBox: {
    backgroundColor: "#f0f9ff", borderRadius: 10, padding: 12,
    marginTop: 10, borderWidth: 1, borderColor: "#bae6fd", alignItems: "center",
  },
  otpLabel: { fontSize: 11, fontWeight: "700", color: Colors.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  otpValue: { fontSize: 36, fontWeight: "800", color: Colors.primary, letterSpacing: 8, marginVertical: 4 },
  otpHint: { fontSize: 11, color: Colors.textSecondary },

  // Bid counter offer box
  counterOfferBox: {
    backgroundColor: "#fffbeb", borderRadius: 10, padding: 12,
    marginTop: 8, borderWidth: 1, borderColor: "#fde68a",
  },
  counterOfferLabel: { fontSize: 11, fontWeight: "700", color: "#92400e", textTransform: "uppercase", letterSpacing: 0.5 },
  counterOfferFare: { fontSize: 26, fontWeight: "800", color: "#92400e", marginVertical: 4 },
  bidPending: { fontSize: 12, color: Colors.textSecondary, fontStyle: "italic", marginTop: 8 },
  bidResolved: { fontSize: 12, color: Colors.success, fontWeight: "600", marginTop: 8 },

  // Action buttons
  actions: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  btnGreen: { backgroundColor: Colors.success, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnRed: { backgroundColor: Colors.error, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnPrimary: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnBids: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnRate: { backgroundColor: Colors.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnPayNow: { backgroundColor: "#16a34a", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  btnTrack: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  btnPrimaryText: { color: Colors.primary, fontWeight: "700", fontSize: 13 },

  // UPI + cash payment styles
  upiPendingBanner: {
    backgroundColor: "#f0fdf4", borderRadius: 8, padding: 10,
    marginTop: 10, borderWidth: 1, borderColor: "#bbf7d0",
  },
  upiPendingLabel: { fontSize: 12, fontWeight: "700", color: "#15803d" },
  upiPendingVpa: { fontSize: 13, color: "#15803d", marginTop: 2 },
  btnUpi: { backgroundColor: "#7c3aed", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  cashBadge: {
    backgroundColor: "#fef3c7", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#fde68a",
  },
  cashBadgeText: { fontSize: 13, fontWeight: "600", color: "#92400e" },

  // Cancellation reason modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: "center", marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  modalSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 20 },
  reasonRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  reasonRowActive: { borderBottomColor: Colors.primary },
  reasonDot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: Colors.border,
  },
  reasonDotActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  reasonText: { fontSize: 15, color: Colors.textPrimary },
  reasonTextActive: { color: Colors.primary, fontWeight: "700" },
  confirmCancelBtn: {
    backgroundColor: Colors.error, borderRadius: 14,
    paddingVertical: 14, alignItems: "center", marginTop: 20,
  },
  keepBtn: { alignItems: "center", paddingVertical: 12 },
  keepBtnText: { fontSize: 15, color: Colors.primary, fontWeight: "700" },
});
