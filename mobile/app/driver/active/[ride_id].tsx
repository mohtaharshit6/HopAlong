import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, Modal, TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getRide, getRideBookings, verifyPickupOtp, completeRide, cancelRide } from "../../../services/api";
import { Colors } from "../../../constants/colors";
import { formatPrice } from "../../../utils/currency";

export default function ActiveRideScreen() {
  const { ride_id } = useLocalSearchParams<{ ride_id: string }>();
  const router = useRouter();

  const [ride, setRide] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [otpModal, setOtpModal] = useState(false);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [verifying, setVerifying] = useState(false);

  const fetchData = async () => {
    try {
      const [rideRes, bookingsRes] = await Promise.all([
        getRide(ride_id),
        getRideBookings(ride_id),
      ]);
      setRide(rideRes.data);
      setBookings(bookingsRes.data);
    } catch {
      Alert.alert("Error", "Could not load ride data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openOtpModal = (bookingId: string) => {
    setActiveBookingId(bookingId);
    setOtpInput("");
    setOtpModal(true);
  };

  const handleVerify = async () => {
    if (otpInput.length !== 4) return;
    setVerifying(true);
    try {
      await verifyPickupOtp(activeBookingId!, otpInput);
      setBookings((prev) =>
        prev.map((b) =>
          b.id === activeBookingId ? { ...b, pickup_verified: true } : b
        )
      );
      setOtpModal(false);
    } catch (err: any) {
      Alert.alert("Invalid OTP", err.response?.data?.error || "Please check the code");
      setOtpInput("");
    } finally {
      setVerifying(false);
    }
  };

  const handleComplete = () => {
    const unverified = bookings.filter((b) => !b.pickup_verified).length;
    const msg = unverified > 0
      ? `${unverified} rider(s) not yet verified. Complete anyway?`
      : "Mark ride as completed?";
    Alert.alert("Complete Ride", msg, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Complete",
        onPress: async () => {
          try {
            await completeRide(ride_id);
            Alert.alert("Done!", "Ride completed successfully.", [
              { text: "OK", onPress: () => router.replace("/(tabs)/my-rides") },
            ]);
          } catch (e: any) {
            Alert.alert("Error", e.response?.data?.error || "Failed to complete");
          }
        },
      },
    ]);
  };

  const handleCancel = () => {
    Alert.alert("Cancel Ride", "This will cancel all bookings. Continue?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            await cancelRide(ride_id);
            Alert.alert("Cancelled", "Ride has been cancelled.", [
              { text: "OK", onPress: () => router.replace("/(tabs)/my-rides") },
            ]);
          } catch (e: any) {
            Alert.alert("Error", e.response?.data?.error || "Failed to cancel");
          }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  const verifiedCount = bookings.filter((b) => b.pickup_verified).length;

  return (
    <View style={styles.container}>
      {/* Ride Info Card */}
      {ride && (
        <View style={styles.rideCard}>
          <View style={styles.routeRow}>
            <View style={styles.dots}>
              <View style={[styles.dot, { backgroundColor: Colors.dotFrom }]} />
              <View style={styles.dotLine} />
              <View style={[styles.dot, { backgroundColor: Colors.dotTo }]} />
            </View>
            <View style={styles.routeLabels}>
              <Text style={styles.routeText} numberOfLines={1}>{ride.start_location}</Text>
              <Text style={styles.routeText} numberOfLines={1}>{ride.end_location}</Text>
            </View>
          </View>
          <View style={styles.rideMetaRow}>
            <Text style={styles.rideMeta}>{ride.date}</Text>
            <Text style={styles.rideMeta}>{ride.time}</Text>
            <Text style={[styles.rideMeta, { color: Colors.primary, fontWeight: "700" }]}>{formatPrice(ride.fare)}/seat</Text>
          </View>
        </View>
      )}

      {/* Progress */}
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          Riders verified: {verifiedCount} / {bookings.length}
        </Text>
        {verifiedCount === bookings.length && bookings.length > 0 && (
          <Text style={styles.allSet}>All aboard!</Text>
        )}
      </View>

      {/* Riders List */}
      <FlatList
        data={bookings}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No confirmed riders for this ride.</Text>
          </View>
        }
        renderItem={({ item: b }) => {
          const rider = b.rider;
          return (
            <View style={styles.riderCard}>
              <View style={styles.riderAvatar}>
                <Text style={styles.riderAvatarText}>
                  {rider?.name?.[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={styles.riderInfo}>
                <Text style={styles.riderName}>{rider?.name ?? "Rider"}</Text>
                <Text style={styles.riderMeta}>
                  {b.seats_booked} seat{b.seats_booked > 1 ? "s" : ""} · {formatPrice((b.agreed_fare ?? ride?.fare) * b.seats_booked)}
                </Text>
              </View>
              {b.pickup_verified ? (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.verifyBtn}
                  onPress={() => openOtpModal(b.id)}
                >
                  <Text style={styles.verifyBtnText}>Enter OTP</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      {/* Bottom Actions */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.completeBtn} onPress={handleComplete}>
          <Text style={styles.completeBtnText}>Complete Ride</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelBtnText}>Cancel Ride</Text>
        </TouchableOpacity>
      </View>

      {/* OTP Verification Modal */}
      <Modal visible={otpModal} transparent animationType="fade" onRequestClose={() => setOtpModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Enter Rider's OTP</Text>
            <Text style={styles.modalSubtitle}>Ask the rider to share their 4-digit pickup code</Text>
            <TextInput
              style={styles.otpInput}
              value={otpInput}
              onChangeText={(t) => setOtpInput(t.replace(/\D/g, "").slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="4-digit OTP"
              placeholderTextColor={Colors.textSecondary}
              textAlign="center"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.confirmBtn, otpInput.length < 4 && styles.confirmBtnDisabled]}
              onPress={handleVerify}
              disabled={verifying || otpInput.length < 4}
            >
              {verifying
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>Confirm</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOtpModal(false)} style={{ marginTop: 12 }}>
              <Text style={styles.cancelModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: Colors.textSecondary, fontSize: 15 },

  rideCard: {
    backgroundColor: Colors.surface, margin: 16, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: Colors.border,
  },
  routeRow: { flexDirection: "row", alignItems: "stretch", marginBottom: 12 },
  dots: { alignItems: "center", marginRight: 12, paddingTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotLine: { width: 2, flex: 1, backgroundColor: Colors.border, marginVertical: 2 },
  routeLabels: { flex: 1, gap: 12 },
  routeText: { fontSize: 15, fontWeight: "600", color: Colors.textPrimary },
  rideMetaRow: { flexDirection: "row", justifyContent: "space-between" },
  rideMeta: { fontSize: 13, color: Colors.textSecondary },

  progressRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, marginBottom: 8,
  },
  progressText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  allSet: { fontSize: 13, fontWeight: "700", color: Colors.success },

  list: { paddingHorizontal: 16, gap: 10, paddingBottom: 16 },
  riderCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.surface, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 12,
  },
  riderAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  riderAvatarText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  riderInfo: { flex: 1 },
  riderName: { fontSize: 15, fontWeight: "700", color: Colors.textPrimary },
  riderMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  verifiedBadge: {
    backgroundColor: "#d1fae5", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  verifiedText: { color: Colors.success, fontSize: 12, fontWeight: "700" },
  verifyBtn: {
    backgroundColor: Colors.primary, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  verifyBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  footer: { padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  completeBtn: {
    backgroundColor: Colors.success, borderRadius: 14,
    paddingVertical: 16, alignItems: "center",
  },
  completeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelBtn: {
    borderWidth: 1.5, borderColor: Colors.error, borderRadius: 14,
    paddingVertical: 14, alignItems: "center",
  },
  cancelBtnText: { color: Colors.error, fontSize: 15, fontWeight: "700" },

  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center", padding: 32,
  },
  modalBox: {
    backgroundColor: "#fff", borderRadius: 20,
    padding: 24, width: "100%", alignItems: "center",
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: Colors.textPrimary, marginBottom: 8 },
  modalSubtitle: {
    fontSize: 14, color: Colors.textSecondary,
    textAlign: "center", marginBottom: 24,
  },
  otpInput: {
    width: 140, height: 64, borderRadius: 14,
    borderWidth: 2, borderColor: Colors.primary,
    fontSize: 28, fontWeight: "800", color: Colors.textPrimary,
    marginBottom: 20,
  },
  confirmBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 40,
  },
  confirmBtnDisabled: { backgroundColor: Colors.border },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelModalText: { color: Colors.textSecondary, fontSize: 14, fontWeight: "600" },
});
