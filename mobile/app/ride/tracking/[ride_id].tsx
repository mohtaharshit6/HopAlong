import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getDriverLocation } from "../../../services/api";
import { Colors } from "../../../constants/colors";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function secondsAgo(isoString: string): number {
  return Math.round((Date.now() - new Date(isoString).getTime()) / 1000);
}

export default function TrackingScreen() {
  const { ride_id } = useLocalSearchParams<{ ride_id: string }>();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  const [locationData, setLocationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLocation = async () => {
    try {
      const res = await getDriverLocation(ride_id);
      const data = res.data;
      setLocationData(data);

      if (data.driver_location_updated_at) {
        setLastSeen(secondsAgo(data.driver_location_updated_at));
      }

      // Animate map to driver if we have coords
      if (data.driver_lat && data.driver_lng && mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: data.driver_lat,
            longitude: data.driver_lng,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          600
        );
      }
    } catch {
      // keep last known state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocation();
    intervalRef.current = setInterval(fetchLocation, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Update "last seen" counter every second
  useEffect(() => {
    const tick = setInterval(() => {
      if (locationData?.driver_location_updated_at) {
        setLastSeen(secondsAgo(locationData.driver_location_updated_at));
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [locationData?.driver_location_updated_at]);

  const driverLat = locationData?.driver_lat;
  const driverLng = locationData?.driver_lng;
  const endLat = locationData?.end_lat;
  const endLng = locationData?.end_lng;

  const distanceKm =
    driverLat && driverLng && endLat && endLng
      ? haversineKm(driverLat, driverLng, endLat, endLng)
      : null;

  const initialRegion = {
    latitude: driverLat ?? locationData?.start_lat ?? 23.2599,
    longitude: driverLng ?? locationData?.start_lng ?? 77.4126,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  };

  const rideCompleted = locationData?.status === "completed";
  const rideCancelled = locationData?.status === "cancelled";

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Connecting to driver…</Text>
        </View>
      ) : (
        <>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={initialRegion}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {/* Driver marker */}
            {driverLat && driverLng && (
              <Marker
                coordinate={{ latitude: driverLat, longitude: driverLng }}
                title="Driver"
                description={lastSeen !== null ? `Updated ${lastSeen}s ago` : "Live location"}
                pinColor={Colors.primary}
              />
            )}

            {/* Destination marker */}
            {endLat && endLng && (
              <Marker
                coordinate={{ latitude: endLat, longitude: endLng }}
                title={locationData?.end_location ?? "Destination"}
                pinColor={Colors.dotTo}
              />
            )}
          </MapView>

          {/* Info card */}
          <View style={styles.card}>
            {rideCompleted ? (
              <Text style={styles.statusText}>Ride completed — you've arrived!</Text>
            ) : rideCancelled ? (
              <Text style={[styles.statusText, { color: Colors.error }]}>Ride was cancelled</Text>
            ) : !driverLat ? (
              <Text style={styles.statusText}>Waiting for driver's location…</Text>
            ) : (
              <>
                <View style={styles.row}>
                  <View style={styles.dotLive} />
                  <Text style={styles.liveLabel}>Live</Text>
                  {lastSeen !== null && (
                    <Text style={styles.lastSeen}>updated {lastSeen}s ago</Text>
                  )}
                </View>

                <Text style={styles.dest} numberOfLines={1}>
                  → {locationData?.end_location}
                </Text>

                {distanceKm !== null && (
                  <Text style={styles.distance}>
                    {distanceKm < 1
                      ? `${Math.round(distanceKm * 1000)} m to destination`
                      : `${distanceKm.toFixed(1)} km to destination`}
                  </Text>
                )}
              </>
            )}

            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backBtnText}>← Back to My Rides</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 15 },

  card: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 }, elevation: 12,
    gap: 6,
  },

  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  dotLive: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: "#10b981",
  },
  liveLabel: { fontSize: 12, fontWeight: "800", color: "#10b981", textTransform: "uppercase", letterSpacing: 1 },
  lastSeen: { fontSize: 12, color: Colors.textSecondary },

  dest: { fontSize: 16, fontWeight: "700", color: Colors.textPrimary },
  distance: { fontSize: 14, color: Colors.textSecondary },
  statusText: { fontSize: 16, fontWeight: "700", color: Colors.textPrimary, marginBottom: 8 },

  backBtn: {
    marginTop: 12, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingVertical: 12, alignItems: "center",
  },
  backBtnText: { color: Colors.primary, fontWeight: "700", fontSize: 15 },
});
