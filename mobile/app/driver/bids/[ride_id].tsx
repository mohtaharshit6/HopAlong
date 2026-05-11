import { useEffect, useState } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Modal, TextInput,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { getRideBids, acceptBid, rejectBid, counterBid } from "../../../services/api";
import { Colors } from "../../../constants/colors";
import { formatPrice, getCurrencySymbol } from "../../../utils/currency";

function getBidStatusColor(status: string) {
  switch (status) {
    case "pending": return Colors.primary;
    case "countered": return "#f59e0b";
    case "accepted":
    case "counter_accepted": return Colors.success;
    default: return Colors.error;
  }
}

export default function DriverBidsScreen() {
  const { ride_id } = useLocalSearchParams<{ ride_id: string }>();
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [counterModal, setCounterModal] = useState(false);
  const [selectedBid, setSelectedBid] = useState<any>(null);
  const [counterFare, setCounterFare] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const symbol = getCurrencySymbol();

  const fetchBids = async () => {
    setLoading(true);
    try {
      const res = await getRideBids(ride_id);
      setBids(res.data);
    } catch {
      Alert.alert("Error", "Could not load bids");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBids(); }, []);

  const handleAccept = (bid: any) => {
    Alert.alert(
      "Accept Bid",
      `Accept ${bid.rider?.name}'s offer of ${formatPrice(bid.offered_fare)} for ${bid.seats} seat(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            try {
              await acceptBid(bid.id);
              fetchBids();
              Alert.alert("Accepted!", "Booking has been created for the rider.");
            } catch (e: any) {
              Alert.alert("Error", e.response?.data?.error || "Failed");
            }
          },
        },
      ]
    );
  };

  const handleReject = (bid: any) => {
    Alert.alert("Reject", `Reject ${bid.rider?.name}'s bid?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            await rejectBid(bid.id);
            fetchBids();
          } catch (e: any) {
            Alert.alert("Error", e.response?.data?.error || "Failed");
          }
        },
      },
    ]);
  };

  const openCounter = (bid: any) => {
    setSelectedBid(bid);
    setCounterFare(String(Math.round(bid.offered_fare)));
    setCounterModal(true);
  };

  const handleCounter = async () => {
    const fare = parseInt(counterFare);
    if (!fare || fare < 1) return;
    setSubmitting(true);
    try {
      await counterBid(selectedBid.id, fare);
      setCounterModal(false);
      fetchBids();
      Alert.alert("Counter sent!", "The rider will be notified of your counter offer.");
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.error || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={bids}
        keyExtractor={(b) => b.id}
        contentContainerStyle={bids.length === 0 ? styles.center : styles.list}
        ListHeaderComponent={
          bids.length > 0 ? (
            <Text style={styles.sectionHeader}>
              {bids.length} incoming bid{bids.length !== 1 ? "s" : ""}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No bids yet</Text>
            <Text style={styles.emptySubtext}>
              Riders can suggest their own fare from the ride detail screen.
            </Text>
          </View>
        }
        renderItem={({ item: bid }) => (
          <View style={styles.bidCard}>
            <View style={styles.bidHeader}>
              <View style={styles.riderAvatar}>
                <Text style={styles.riderAvatarText}>
                  {bid.rider?.name?.[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={styles.bidInfo}>
                <Text style={styles.riderName}>{bid.rider?.name ?? "Rider"}</Text>
                <Text style={styles.bidMeta}>
                  {bid.seats} seat{bid.seats > 1 ? "s" : ""} ·{" "}
                  <Text style={{ color: getBidStatusColor(bid.status) }}>{bid.status}</Text>
                </Text>
              </View>
              <Text style={styles.bidFare}>{formatPrice(bid.offered_fare)}</Text>
            </View>

            {bid.message ? (
              <Text style={styles.bidMessage}>"{bid.message}"</Text>
            ) : null}

            {bid.status === "countered" && bid.counter_fare && (
              <View style={styles.counterBadge}>
                <Text style={styles.counterBadgeText}>
                  Your counter: {formatPrice(bid.counter_fare)} · Awaiting rider response
                </Text>
              </View>
            )}

            {bid.status === "pending" && (
              <View style={styles.bidActions}>
                <TouchableOpacity style={styles.btnAccept} onPress={() => handleAccept(bid)}>
                  <Text style={styles.btnWhiteText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnCounter} onPress={() => openCounter(bid)}>
                  <Text style={styles.btnPrimaryText}>Counter</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnReject} onPress={() => handleReject(bid)}>
                  <Text style={styles.btnWhiteText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        refreshing={loading}
        onRefresh={fetchBids}
      />

      <Modal
        visible={counterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setCounterModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Counter Offer</Text>
            <Text style={styles.modalSubtitle}>
              Rider offered {selectedBid ? formatPrice(selectedBid.offered_fare) : ""}
              {"\n"}Enter your counter price:
            </Text>
            <View style={styles.counterInputRow}>
              <Text style={styles.counterSymbol}>{symbol}</Text>
              <TextInput
                style={styles.counterInput}
                value={counterFare}
                onChangeText={(t) => setCounterFare(t.replace(/\D/g, ""))}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[styles.confirmBtn, (!counterFare || submitting) && styles.confirmBtnDisabled]}
              onPress={handleCounter}
              disabled={!counterFare || submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>Send Counter</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCounterModal(false)} style={{ marginTop: 12 }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  emptyText: { fontSize: 16, fontWeight: "700", color: Colors.textPrimary, marginBottom: 8, textAlign: "center" },
  emptySubtext: { fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  sectionHeader: {
    fontSize: 12, fontWeight: "700", color: Colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8,
  },

  bidCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  bidHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  riderAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  riderAvatarText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  bidInfo: { flex: 1 },
  riderName: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary },
  bidMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  bidFare: { fontSize: 22, fontWeight: "800", color: Colors.primary },

  bidMessage: {
    fontSize: 13, color: Colors.textSecondary, fontStyle: "italic",
    marginBottom: 10, paddingLeft: 4,
  },
  counterBadge: {
    backgroundColor: "#fef3c7", borderRadius: 8, padding: 8, marginBottom: 8,
  },
  counterBadgeText: { fontSize: 12, color: "#92400e", fontWeight: "600" },

  bidActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  btnAccept: {
    flex: 1, backgroundColor: Colors.success,
    borderRadius: 10, paddingVertical: 10, alignItems: "center",
  },
  btnCounter: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.primary,
    borderRadius: 10, paddingVertical: 10, alignItems: "center",
  },
  btnReject: {
    flex: 1, backgroundColor: Colors.error,
    borderRadius: 10, paddingVertical: 10, alignItems: "center",
  },
  btnWhiteText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  btnPrimaryText: { color: Colors.primary, fontWeight: "700", fontSize: 13 },

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
    textAlign: "center", marginBottom: 20,
  },
  counterInputRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 24 },
  counterSymbol: { fontSize: 28, fontWeight: "700", color: Colors.textPrimary, marginRight: 4 },
  counterInput: {
    fontSize: 44, fontWeight: "800", color: Colors.textPrimary,
    borderBottomWidth: 2.5, borderColor: Colors.primary,
    minWidth: 100, textAlign: "center", paddingBottom: 2,
  },
  confirmBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 40,
  },
  confirmBtnDisabled: { backgroundColor: Colors.border },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelText: { color: Colors.textSecondary, fontSize: 14, fontWeight: "600" },
});
