import { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  SafeAreaView, TextInput, Modal, Alert, ActivityIndicator,
  Dimensions, StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { useAuthStore } from "../../store/authStore";
import { Colors } from "../../constants/colors";

const GMAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";
const { width } = Dimensions.get("window");
// Show 3 cards + a peek of the 4th to signal scrollability
const CAROUSEL_CARD_W = (width - 40) / 3.2;

const SERVICES = [
  { id: "offer",     label: "Offer Ride", emoji: "🚗", route: "/(tabs)/offer",    comingSoon: false },
  { id: "find",      label: "Find Ride",  emoji: "🔍", route: "/(tabs)/services", comingSoon: false },
  { id: "trip",      label: "Trip",       emoji: "📍", route: "/(tabs)/services", comingSoon: false },
  { id: "bike",      label: "Bike",       emoji: "🛵", route: null,               comingSoon: true },
  { id: "toto",      label: "Toto",       emoji: "🛺", route: null,               comingSoon: true },
  { id: "rentals",   label: "Rentals",    emoji: "🔑", route: null,               comingSoon: true },
  { id: "parcel",    label: "Parcel",     emoji: "📦", route: null,               comingSoon: true },
  { id: "reserve",   label: "Reserve",    emoji: "📅", route: null,               comingSoon: true },
  { id: "intercity", label: "Intercity",  emoji: "🛣️", route: null,               comingSoon: true },
  { id: "teens",     label: "Teens",      emoji: "👦", route: null,               comingSoon: true },
];

const PROMO = [
  { id: "1", emoji: "💰", title: "Save every day with HopAlong", sub: "Share rides, split costs — better for your wallet and the planet." },
  { id: "2", emoji: "🛡️", title: "Verified drivers, real-time tracking", sub: "Every driver is reviewed. Track your ride live from pickup to drop." },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationKey, setLocationKey] = useState<"pending" | "ready">("pending");
  const [showSearch, setShowSearch] = useState(false);
  const [fromText, setFromText] = useState("Current Location");
  const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(null);

  // lastKnown first (instant) → fresh GPS only if no cached position
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocationKey("ready"); return; }
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        const c = { lat: last.coords.latitude, lng: last.coords.longitude };
        setUserCoords(c); setFromCoords(c); setLocationKey("ready"); return;
      }
      const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const c = { lat: fresh.coords.latitude, lng: fresh.coords.longitude };
      setUserCoords(c); setFromCoords(c); setLocationKey("ready");
    })();
  }, []);

  const placesQuery = {
    key: GMAPS_KEY,
    language: "en",
    components: "country:in",
    ...(userCoords && {
      location: `${userCoords.lat},${userCoords.lng}`,
      radius: 30000,
      strictbounds: true,
    }),
  };

  const handleServicePress = (s: typeof SERVICES[0]) => {
    if (s.comingSoon) {
      Alert.alert("Coming Soon!", `${s.label} will be available soon.`);
      return;
    }
    router.push(s.route as any);
  };

  const handleDestSelected = (data: any, details: any) => {
    router.push({
      pathname: "/(tabs)/services",
      params: {
        destName: data.description,
        destLat: String(details.geometry.location.lat),
        destLng: String(details.geometry.location.lng),
        fromName: fromText,
        fromLat: String(fromCoords?.lat ?? userCoords?.lat ?? ""),
        fromLng: String(fromCoords?.lng ?? userCoords?.lng ?? ""),
      },
    } as any);
    setShowSearch(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetText}>{greeting()},</Text>
            <Text style={styles.userName}>
              {user?.name?.split(" ")[0] || "there"} 👋
            </Text>
          </View>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => router.push("/(tabs)/my-rides" as any)}
          >
            <Text style={styles.bellIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* ── Where to? card ── */}
        <TouchableOpacity
          style={styles.whereCard}
          onPress={() => setShowSearch(true)}
          activeOpacity={0.85}
        >
          <View style={styles.whereRow}>
            <View style={styles.dotBlue} />
            <Text style={styles.fromText} numberOfLines={1}>{fromText}</Text>
            <View style={styles.whereDivider} />
            <Text style={styles.wherePlaceholder}>Where to?</Text>
          </View>
          <View style={styles.laterPill}>
            <Text style={styles.laterText}>🕐 Later</Text>
          </View>
        </TouchableOpacity>

        {/* ── For You carousel (1 row, 3 visible + peek) ── */}
        <Text style={styles.sectionLabel}>For You</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.carouselScroll}
          contentContainerStyle={styles.carouselContent}
        >
          {SERVICES.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.serviceCard}
              onPress={() => handleServicePress(s)}
              activeOpacity={0.75}
            >
              {s.comingSoon && (
                <View style={styles.soonChip}>
                  <Text style={styles.soonText}>Soon</Text>
                </View>
              )}
              <Text style={styles.serviceEmoji}>{s.emoji}</Text>
              <Text style={styles.serviceLabel}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Promo feed ── */}
        <Text style={styles.sectionLabel}>Highlights</Text>
        {PROMO.map((p) => (
          <View key={p.id} style={styles.promoCard}>
            <Text style={styles.promoEmoji}>{p.emoji}</Text>
            <View style={styles.promoBody}>
              <Text style={styles.promoTitle}>{p.title}</Text>
              <Text style={styles.promoSub}>{p.sub}</Text>
            </View>
          </View>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Where to? modal ── */}
      <Modal visible={showSearch} animationType="slide" statusBarTranslucent onRequestClose={() => setShowSearch(false)}>
        <SafeAreaView style={styles.modalSafe}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setShowSearch(false)}>
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Plan your ride</Text>
          </View>

          {/* FROM row */}
          <View style={styles.searchRow}>
            <View style={styles.dotBlue} />
            <TextInput
              style={styles.searchInput}
              value={fromText}
              onChangeText={setFromText}
              placeholder="Starting point"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>
          <View style={styles.searchSep} />

          {/* TO row — only mounts when locationKey=ready so query is fully biased */}
          <View style={styles.searchRow}>
            <View style={styles.dotOrange} />
            {locationKey === "ready" ? (
              <View style={{ flex: 1 }}>
                <GooglePlacesAutocomplete
                  key="dest-modal"
                  placeholder="Where to?"
                  fetchDetails
                  onPress={handleDestSelected}
                  query={placesQuery}
                  styles={acStyles}
                  enablePoweredByContainer={false}
                  autoFocus
                />
              </View>
            ) : (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Getting your location…</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 40 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  greetText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "500" },
  userName: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary, marginTop: 2 },
  bellBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  bellIcon: { fontSize: 18 },

  whereCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 28,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  whereRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  dotBlue: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.dotFrom, marginRight: 10, flexShrink: 0 },
  fromText: { fontSize: 14, color: Colors.textPrimary, fontWeight: "500", maxWidth: 100 },
  whereDivider: { width: 1, height: 20, backgroundColor: Colors.border, marginHorizontal: 10 },
  wherePlaceholder: { fontSize: 14, color: Colors.textSecondary, flex: 1 },
  laterPill: {
    backgroundColor: "#f1f5f9", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.border, marginLeft: 8,
  },
  laterText: { fontSize: 12, color: Colors.textSecondary, fontWeight: "600" },

  sectionLabel: {
    fontSize: 17, fontWeight: "800", color: Colors.textPrimary, marginBottom: 14,
  },

  carouselScroll: { marginHorizontal: -20, marginBottom: 28 },
  carouselContent: { paddingHorizontal: 20, gap: 10, paddingRight: 40 },
  serviceCard: {
    width: CAROUSEL_CARD_W, height: 90, borderRadius: 16,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center", padding: 8,
    position: "relative",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  serviceEmoji: { fontSize: 28, marginBottom: 6 },
  serviceLabel: { fontSize: 11, fontWeight: "700", color: Colors.textPrimary, textAlign: "center" },
  soonChip: {
    position: "absolute", top: 6, right: 6,
    backgroundColor: Colors.accent, borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  soonText: { fontSize: 9, fontWeight: "800", color: "#fff" },

  promoCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, flexDirection: "row",
    alignItems: "center", gap: 14, marginBottom: 12,
  },
  promoEmoji: { fontSize: 36 },
  promoBody: { flex: 1 },
  promoTitle: { fontSize: 15, fontWeight: "700", color: Colors.textPrimary, marginBottom: 4 },
  promoSub: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  // Modal
  modalSafe: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { marginRight: 12, padding: 4 },
  backText: { fontSize: 22, color: Colors.textPrimary },
  modalTitle: { fontSize: 17, fontWeight: "700", color: Colors.textPrimary },
  searchRow: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  dotOrange: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.dotTo, marginRight: 10, marginTop: 14, flexShrink: 0 },
  searchInput: {
    flex: 1, fontSize: 16, color: Colors.textPrimary,
    borderBottomWidth: 1.5, borderBottomColor: Colors.primary,
    paddingBottom: 6, paddingHorizontal: 0,
  },
  searchSep: { height: 1, backgroundColor: Colors.border, marginLeft: 48 },
  loadingRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10 },
  loadingText: { fontSize: 14, color: Colors.textSecondary },
});

const acStyles = {
  container: { flex: 1 },
  textInputContainer: { backgroundColor: "transparent", paddingHorizontal: 0 },
  textInput: {
    fontSize: 16, color: Colors.textPrimary,
    backgroundColor: "transparent",
    borderBottomWidth: 1.5, borderBottomColor: Colors.primary,
    paddingHorizontal: 0, height: 44, marginBottom: 0,
  },
  listView: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    marginTop: 6, marginHorizontal: 0, elevation: 4,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  row: { backgroundColor: Colors.surface, paddingVertical: 13, paddingHorizontal: 16 },
  description: { fontSize: 14, color: Colors.textPrimary },
  separator: { height: 1, backgroundColor: Colors.border },
};
