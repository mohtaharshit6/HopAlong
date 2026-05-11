import { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Animated, Dimensions, TextInput,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { getRides } from "../../services/api";
import RideCard from "../../components/RideCard";
import { Colors } from "../../constants/colors";

const { height } = Dimensions.get("window");
const SHEET_PEEK = 220;
const SHEET_FULL = height * 0.62;

export default function HomeScreen() {
  const router = useRouter();
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [region, setRegion] = useState({
    latitude: 23.2599,
    longitude: 77.4126,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchText, setSearchText] = useState("");

  const sheetY = useRef(new Animated.Value(0)).current;
  const [sheetOpen, setSheetOpen] = useState(false);

  const toggleSheet = () => {
    Animated.spring(sheetY, {
      toValue: sheetOpen ? 0 : SHEET_FULL - SHEET_PEEK,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
    setSheetOpen((v) => !v);
  };

  const fetchRides = async (loc?: { lat: number; lng: number }) => {
    try {
      const params = loc ? { lat: loc.lat, lng: loc.lng, radius: 30 } : undefined;
      const res = await getRides(params);
      setRides(res.data);
    } catch {
      // keep current list
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setUserLocation(coords);
        setRegion((r) => ({ ...r, latitude: coords.lat, longitude: coords.lng }));
        fetchRides(coords);
      } else {
        fetchRides();
      }
    })();
  }, []);

  const filteredRides = rides.filter((r) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      r.start_location?.toLowerCase().includes(q) ||
      r.end_location?.toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.container}>
      {/* MAP */}
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {rides.map((ride) =>
          ride.start_lat && ride.start_lng ? (
            <Marker
              key={ride.id}
              coordinate={{ latitude: ride.start_lat, longitude: ride.start_lng }}
              title={ride.start_location}
              description={`${ride.available_seats} seat${ride.available_seats !== 1 ? "s" : ""} available`}
              pinColor={Colors.primary}
              onPress={() => router.push(`/ride/${ride.id}`)}
            />
          ) : null
        )}
      </MapView>

      {/* SEARCH BAR */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍  Search by location…"
          placeholderTextColor={Colors.textSecondary}
          value={searchText}
          onChangeText={setSearchText}
          onFocus={() => { if (!sheetOpen) toggleSheet(); }}
        />
      </View>

      {/* BOTTOM SHEET */}
      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: Animated.multiply(sheetY, -1) }] },
        ]}
      >
        {/* Handle */}
        <TouchableOpacity style={styles.handleWrap} onPress={toggleSheet} activeOpacity={0.9}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>
            {loading ? "Loading rides…" : `${filteredRides.length} ride${filteredRides.length !== 1 ? "s" : ""} available`}
          </Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={filteredRides}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <RideCard ride={item} />}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); fetchRides(userLocation ?? undefined); }}
                colors={[Colors.primary]}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🚗</Text>
                <Text style={styles.emptyTitle}>No rides found</Text>
                <Text style={styles.emptySubtitle}>
                  {searchText ? "Try a different search" : "Be the first to offer one!"}
                </Text>
                {!searchText && (
                  <TouchableOpacity
                    style={styles.offerBtn}
                    onPress={() => router.push("/(tabs)/offer")}
                  >
                    <Text style={styles.offerBtnText}>+ Offer a Ride</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  searchWrap: {
    position: "absolute", top: 52, left: 16, right: 16, zIndex: 10,
  },
  searchInput: {
    backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 16,
    paddingVertical: 12, fontSize: 15, color: Colors.textPrimary,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },

  sheet: {
    position: "absolute", bottom: -SHEET_FULL + SHEET_PEEK,
    left: 0, right: 0, height: SHEET_FULL,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 }, elevation: 12,
  },
  handleWrap: { alignItems: "center", paddingTop: 12, paddingBottom: 8, paddingHorizontal: 20 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 12 },
  sheetTitle: { fontSize: 15, fontWeight: "700", color: Colors.textPrimary, alignSelf: "flex-start" },

  list: { padding: 16, gap: 12, paddingBottom: 40 },

  empty: { alignItems: "center", paddingTop: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: Colors.textPrimary, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },
  offerBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  offerBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
