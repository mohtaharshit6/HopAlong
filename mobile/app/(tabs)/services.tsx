import { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, SafeAreaView,
  Modal, TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { getRides } from "../../services/api";
import RideCard from "../../components/RideCard";
import { Colors } from "../../constants/colors";

const GMAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";

// ── Geo helpers ────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Returns true if `dest` lies approximately on the straight-line route from `start` to `end`
function isOnRoute(
  dLat: number, dLng: number,
  sLat: number, sLng: number,
  eLat: number, eLng: number,
): boolean {
  const d1 = haversineKm(sLat, sLng, dLat, dLng);   // start → dest
  const d2 = haversineKm(dLat, dLng, eLat, eLng);   // dest → end
  const total = haversineKm(sLat, sLng, eLat, eLng); // start → end
  if (total < 0.5) return false; // ignore very short rides
  // dest is "in between" if detour ≤ 30% extra AND dest is not beyond either endpoint
  return (d1 + d2) <= total * 1.3 && d1 < total && d2 < total;
}

// ── Service grid cards ─────────────────────────────────────────────────────────

const GO_SERVICES = [
  { id: "trip", label: "Trip", emoji: "📍" },
  { id: "bike", label: "Bike", emoji: "🛵" },
  { id: "toto", label: "Toto", emoji: "🛺" },
  { id: "rentals", label: "Rentals", emoji: "🔑" },
  { id: "reserve", label: "Reserve", emoji: "📅" },
  { id: "intercity", label: "Intercity", emoji: "🛣️" },
];

const PARCEL_SERVICES = [
  { id: "parcel", label: "Parcel", emoji: "📦" },
  { id: "store", label: "Store Pick-up", emoji: "🏪" },
];

function ComingSoonCard({ label, emoji }: { label: string; emoji: string }) {
  return (
    <TouchableOpacity
      style={styles.gridCard}
      onPress={() => Alert.alert("Coming Soon!", `${label} will be available soon.`)}
      activeOpacity={0.75}
    >
      <Text style={styles.gridEmoji}>{emoji}</Text>
      <Text style={styles.gridLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function ServicesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    destName?: string; destLat?: string; destLng?: string;
    fromName?: string; fromLat?: string; fromLng?: string;
  }>();

  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Destination search state
  const [searchDest, setSearchDest] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [showDestSearch, setShowDestSearch] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationKey, setLocationKey] = useState<"pending" | "ready">("pending");

  // Pre-fill from Home "Where to?" params
  useEffect(() => {
    if (params.destLat && params.destLng && params.destName) {
      setSearchDest({
        name: params.destName,
        lat: parseFloat(params.destLat),
        lng: parseFloat(params.destLng),
      });
    }
  }, [params.destName]);

  // Resolve user coords for strictbounds autocomplete
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocationKey("ready"); return; }
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        setUserCoords({ lat: last.coords.latitude, lng: last.coords.longitude });
        setLocationKey("ready");
        return;
      }
      const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserCoords({ lat: fresh.coords.latitude, lng: fresh.coords.longitude });
      setLocationKey("ready");
    })();
  }, []);

  useEffect(() => { loadRides(); }, []);

  const loadRides = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;

      if (params.fromLat && params.fromLng) {
        lat = parseFloat(params.fromLat);
        lng = parseFloat(params.fromLng);
      } else if (userCoords) {
        lat = userCoords.lat;
        lng = userCoords.lng;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const last = await Location.getLastKnownPositionAsync();
          const loc = last ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      }

      const res = await getRides(lat != null && lng != null ? { lat, lng, radius: 30 } : undefined);
      setRides(res.data);
    } catch {
      // keep current list
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filter rides by destination — text match OR on-route check for intermediate stops
  const filteredRides = searchDest
    ? rides.filter((r) => {
        const q = searchDest.name.toLowerCase();
        // 1. Direct text match on end location
        if (r.end_location?.toLowerCase().includes(q)) return true;
        // 2. Geometric "on route" check — catches A→B searches on A→C rides
        if (r.start_lat && r.start_lng && r.end_lat && r.end_lng) {
          return isOnRoute(
            searchDest.lat, searchDest.lng,
            r.start_lat, r.start_lng,
            r.end_lat, r.end_lng,
          );
        }
        return false;
      })
    : rides;

  // Bias nearby places to top but no strictbounds — destinations can be anywhere in India.
  const placesQuery = {
    key: GMAPS_KEY,
    language: "en",
    components: "country:in",
    ...(userCoords && {
      location: `${userCoords.lat},${userCoords.lng}`,
      radius: 50000,
    }),
  };

  const hasRoute = !bannerDismissed && !!params.fromName;
  const ridesLabel = searchDest ? `Rides to / via ${searchDest.name}` : "Rides near you";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadRides(true)} colors={[Colors.primary]} />
        }
      >
        <Text style={styles.pageTitle}>Services</Text>

        {/* Route banner from Home */}
        {hasRoute && (
          <View style={styles.routeBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeFrom} numberOfLines={1}>{params.fromName}</Text>
              <Text style={styles.routeArrow}>↓</Text>
              <Text style={styles.routeDest} numberOfLines={1}>{params.destName}</Text>
            </View>
            <TouchableOpacity style={styles.dismissBtn} onPress={() => setBannerDismissed(true)}>
              <Text style={styles.dismissText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Destination search bar */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => setShowDestSearch(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={searchDest ? styles.searchFilled : styles.searchPlaceholder} numberOfLines={1}>
            {searchDest ? searchDest.name : "Search destination…"}
          </Text>
          {searchDest && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => setSearchDest(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* On-route hint */}
        {searchDest && (
          <Text style={styles.onRouteHint}>
            Showing rides going to or passing through {searchDest.name}
          </Text>
        )}

        {/* Go anywhere section */}
        <Text style={styles.sectionTitle}>Go anywhere, get anything</Text>
        <View style={styles.serviceGrid}>
          {GO_SERVICES.map((s) => <ComingSoonCard key={s.id} {...s} />)}
        </View>

        {/* Rides list */}
        <Text style={styles.sectionTitle}>{ridesLabel}</Text>
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
        ) : filteredRides.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🚗</Text>
            <Text style={styles.emptyTitle}>
              {searchDest ? `No rides found for ${searchDest.name}` : "No rides found nearby"}
            </Text>
            <Text style={styles.emptySub}>
              {searchDest ? "Try a different destination or clear the search" : "Be the first to offer one!"}
            </Text>
            {!searchDest && (
              <TouchableOpacity style={styles.offerBtn} onPress={() => router.push("/(tabs)/offer")}>
                <Text style={styles.offerBtnText}>+ Offer a Ride</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.rideList}>
            {filteredRides.map((r) => <RideCard key={r.id} ride={r} />)}
          </View>
        )}

        {/* Parcel section */}
        <Text style={styles.sectionTitle}>Use Parcel to help</Text>
        <View style={styles.serviceGrid}>
          {PARCEL_SERVICES.map((s) => <ComingSoonCard key={s.id} {...s} />)}
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Destination search modal */}
      <Modal visible={showDestSearch} animationType="slide" statusBarTranslucent onRequestClose={() => setShowDestSearch(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setShowDestSearch(false)}>
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Where are you going?</Text>
          </View>

          {/* Always render — key re-mounts with biasing once GPS resolves */}
          <View style={styles.acWrapper}>
            <GooglePlacesAutocomplete
              key={`dest-services-${locationKey}`}
              placeholder="Type a destination…"
              fetchDetails
              minLength={1}
              autoFocus
              onPress={(data, details) => {
                setSearchDest({
                  name: data.description,
                  lat: details!.geometry.location.lat,
                  lng: details!.geometry.location.lng,
                });
                setShowDestSearch(false);
              }}
              query={placesQuery}
              styles={acStyles}
              enablePoweredByContainer={false}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 40 },

  pageTitle: { fontSize: 26, fontWeight: "800", color: Colors.textPrimary, marginBottom: 16 },

  routeBanner: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: Colors.primary,
    flexDirection: "row", alignItems: "center", marginBottom: 16,
  },
  routeFrom: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  routeArrow: { fontSize: 12, color: Colors.textSecondary, marginVertical: 2 },
  routeDest: { fontSize: 15, fontWeight: "700", color: Colors.textPrimary },
  dismissBtn: { padding: 6 },
  dismissText: { fontSize: 16, color: Colors.textSecondary },

  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    marginBottom: 8, gap: 10,
  },
  searchIcon: { fontSize: 16 },
  searchPlaceholder: { flex: 1, fontSize: 15, color: Colors.textSecondary },
  searchFilled: { flex: 1, fontSize: 15, color: Colors.textPrimary, fontWeight: "600" },
  clearBtn: { padding: 2 },
  clearText: { fontSize: 14, color: Colors.textSecondary },

  onRouteHint: {
    fontSize: 12, color: Colors.primary, fontWeight: "600",
    marginBottom: 16, paddingHorizontal: 4,
  },

  sectionTitle: { fontSize: 17, fontWeight: "800", color: Colors.textPrimary, marginBottom: 14, marginTop: 8 },

  serviceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  gridCard: {
    width: "30%", minWidth: 90, height: 86, borderRadius: 16,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center", padding: 8,
  },
  gridEmoji: { fontSize: 26, marginBottom: 6 },
  gridLabel: { fontSize: 11, fontWeight: "700", color: Colors.textPrimary, textAlign: "center" },

  rideList: { gap: 12, marginBottom: 8 },

  empty: { alignItems: "center", paddingVertical: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: Colors.textPrimary, marginBottom: 6, textAlign: "center" },
  emptySub: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20, textAlign: "center" },
  offerBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  offerBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Modal
  modalSafe: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { marginRight: 12, padding: 4 },
  backText: { fontSize: 22, color: Colors.textPrimary },
  modalTitle: { fontSize: 17, fontWeight: "700", color: Colors.textPrimary },
  acWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 20 },
  loadingText: { fontSize: 14, color: Colors.textSecondary },
});

const acStyles = {
  container: { flex: 1 },
  textInputContainer: { backgroundColor: "transparent" },
  textInput: {
    fontSize: 16, color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, height: 50,
  },
  listView: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, marginTop: 6, elevation: 4,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  row: { backgroundColor: Colors.surface, paddingVertical: 13, paddingHorizontal: 16 },
  description: { fontSize: 14, color: Colors.textPrimary },
  separator: { height: 1, backgroundColor: Colors.border },
};
