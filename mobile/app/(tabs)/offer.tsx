import { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Platform, ActivityIndicator, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import * as Location from "expo-location";
import { createRide } from "../../services/api";
import { getDistanceMatrix, suggestFare } from "../../services/maps";
import { Colors } from "../../constants/colors";
import { getCurrencySymbol, formatPrice } from "../../utils/currency";

const GMAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";

interface LocationObj {
  name: string;
  lat: number;
  lng: number;
}

export default function OfferRideScreen() {
  const router = useRouter();
  const symbol = getCurrencySymbol();

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [time, setTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [origin, setOrigin] = useState<LocationObj | null>(null);
  const [destination, setDestination] = useState<LocationObj | null>(null);

  const [seats, setSeats] = useState(1);
  const [fare, setFare] = useState<number | null>(null);
  const [distanceInfo, setDistanceInfo] = useState<{ text: string; duration: string } | null>(null);
  const [fetchingDistance, setFetchingDistance] = useState(false);
  const [loading, setLoading] = useState(false);

  // Location biasing state
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  // "pending" → resolving GPS; "ready" → autocompletes can mount with biased query
  const [locationKey, setLocationKey] = useState<"pending" | "ready">("pending");
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);

  const originRef = useRef<any>(null);
  const destRef = useRef<any>(null);

  // Resolve user coords on mount using last-known (instant) before falling back to fresh GPS
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationKey("ready");
        return;
      }
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        setUserCoords({ lat: last.coords.latitude, lng: last.coords.longitude });
        setLocationKey("ready");
        return;
      }
      // Only reached on first-ever app launch when device has no cached position
      const fresh = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserCoords({ lat: fresh.coords.latitude, lng: fresh.coords.longitude });
      setLocationKey("ready");
    })();
  }, []);

  const placesQuery = {
    key: GMAPS_KEY,
    language: "en",
    components: "country:in",
    ...(userCoords && {
      location: `${userCoords.lat},${userCoords.lng}`,
      radius: 50000,
    }),
  };

  const handleUseCurrentLocation = async () => {
    setUsingCurrentLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Enable location access to use this feature.");
        return;
      }
      // Reuse already-resolved coords if available, otherwise re-fetch
      let coords = userCoords;
      if (!coords) {
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          coords = { lat: last.coords.latitude, lng: last.coords.longitude };
        } else {
          const fresh = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          coords = { lat: fresh.coords.latitude, lng: fresh.coords.longitude };
        }
      }
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: coords.lat,
        longitude: coords.lng,
      });
      const address = [geo.name, geo.street, geo.district ?? geo.subregion, geo.city]
        .filter(Boolean)
        .join(", ");

      originRef.current?.setAddressText(address);
      const loc: LocationObj = { name: address, lat: coords.lat, lng: coords.lng };
      setOrigin(loc);
      if (destination) fetchDistance(loc, destination);
    } catch {
      Alert.alert("Error", "Could not determine your location.");
    } finally {
      setUsingCurrentLocation(false);
    }
  };

  const fetchDistance = async (o: LocationObj, d: LocationObj) => {
    setFetchingDistance(true);
    const result = await getDistanceMatrix(o.lat, o.lng, d.lat, d.lng);
    setFetchingDistance(false);
    if (result) {
      setDistanceInfo({ text: result.distanceText, duration: result.durationText });
      setFare(suggestFare(result.distanceKm));
    }
  };

  const onOriginSelected = (data: any, details: any) => {
    const loc: LocationObj = {
      name: data.description,
      lat: details.geometry.location.lat,
      lng: details.geometry.location.lng,
    };
    setOrigin(loc);
    if (destination) fetchDistance(loc, destination);
  };

  const onDestinationSelected = (data: any, details: any) => {
    const loc: LocationObj = {
      name: data.description,
      lat: details.geometry.location.lat,
      lng: details.geometry.location.lng,
    };
    setDestination(loc);
    if (origin) fetchDistance(origin, loc);
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  const dateStr = date.toISOString().split("T")[0];
  const timeStr = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;

  const handleSubmit = async () => {
    if (!origin) return Alert.alert("Missing", "Please select a starting point");
    if (!destination) return Alert.alert("Missing", "Please select a destination");
    if (!fare) return Alert.alert("Missing", "Fare could not be calculated");

    setLoading(true);
    try {
      await createRide({
        start_location: origin.name,
        start_lat: origin.lat,
        start_lng: origin.lng,
        end_location: destination.name,
        end_lat: destination.lat,
        end_lng: destination.lng,
        date: dateStr,
        time: timeStr,
        total_seats: seats,
        fare,
      });
      Alert.alert("Ride Posted!", "Riders can now see and book your ride.", [
        { text: "OK", onPress: () => router.push("/(tabs)") },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.error || "Failed to post ride");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="always"
    >
      <Text style={styles.heading}>Offer a Ride</Text>

      {/* DATE */}
      <Text style={styles.label}>Date</Text>
      <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
        <Text style={styles.pickerIcon}>📅</Text>
        <Text style={styles.pickerText}>{formatDate(date)}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          minimumDate={new Date()}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, d) => { setShowDatePicker(false); if (d) setDate(d); }}
        />
      )}

      {/* ORIGIN */}
      <Text style={styles.label}>Starting Point</Text>

      {/* Use Current Location button */}
      <TouchableOpacity
        style={styles.currentLocBtn}
        onPress={handleUseCurrentLocation}
        disabled={usingCurrentLocation}
        activeOpacity={0.75}
      >
        {usingCurrentLocation ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <>
            <Text style={styles.currentLocIcon}>⊙</Text>
            <Text style={styles.currentLocText}>Use Current Location</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Origin wrapper gets higher zIndex so its dropdown renders above destination input */}
      <View style={[styles.autocompleteWrap, { zIndex: 20 }]}>
        <GooglePlacesAutocomplete
          key={`origin-${locationKey}`}
          ref={originRef}
          placeholder="Where are you starting from?"
          fetchDetails
          minLength={1}
          onPress={onOriginSelected}
          query={placesQuery}
          styles={autocompleteStyles}
          enablePoweredByContainer={false}
          renderLeftButton={() => <Text style={styles.pinIcon}>🔵</Text>}
        />
      </View>

      {/* DESTINATION */}
      <Text style={styles.label}>Destination</Text>
      <View style={[styles.autocompleteWrap, { zIndex: 10 }]}>
        <GooglePlacesAutocomplete
          key={`dest-${locationKey}`}
          ref={destRef}
          placeholder="Where are you going?"
          fetchDetails
          minLength={1}
          onPress={onDestinationSelected}
          query={placesQuery}
          styles={autocompleteStyles}
          enablePoweredByContainer={false}
          renderLeftButton={() => <Text style={styles.pinIcon}>🟠</Text>}
        />
      </View>

      {/* DISTANCE CARD */}
      {fetchingDistance && (
        <View style={styles.distanceCard}>
          <ActivityIndicator color={Colors.primary} size="small" />
          <Text style={styles.distanceText}>Calculating route…</Text>
        </View>
      )}
      {distanceInfo && !fetchingDistance && (
        <View style={styles.distanceCard}>
          <View style={styles.distanceRow}>
            <Text style={styles.distanceStat}>📍 {distanceInfo.text}</Text>
            <Text style={styles.distanceStat}>⏱ {distanceInfo.duration}</Text>
          </View>
          <Text style={styles.distanceHint}>Suggested fare based on distance + demand</Text>
        </View>
      )}

      {/* TIME */}
      <Text style={styles.label}>Departure Time</Text>
      <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTimePicker(true)}>
        <Text style={styles.pickerIcon}>🕐</Text>
        <Text style={styles.pickerText}>{formatTime(time)}</Text>
      </TouchableOpacity>
      {showTimePicker && (
        <DateTimePicker
          value={time}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, t) => { setShowTimePicker(false); if (t) setTime(t); }}
        />
      )}

      {/* SEATS */}
      <Text style={styles.label}>Available Seats</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() => setSeats((s) => Math.max(1, s - 1))}
        >
          <Text style={styles.stepperBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{seats}</Text>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() => setSeats((s) => Math.min(8, s + 1))}
        >
          <Text style={styles.stepperBtnText}>+</Text>
        </TouchableOpacity>
        <Text style={styles.stepperHint}>seat{seats !== 1 ? "s" : ""} available</Text>
      </View>

      {/* FARE */}
      <Text style={styles.label}>Fare per Seat</Text>
      {fare !== null ? (
        <View style={styles.fareCard}>
          <View style={styles.fareRow}>
            <TouchableOpacity
              style={styles.fareBtn}
              onPress={() => setFare((f) => Math.max(10, (f ?? 0) - 10))}
            >
              <Text style={styles.fareBtnText}>−{symbol}10</Text>
            </TouchableOpacity>
            <View style={styles.fareValueWrap}>
              <Text style={styles.fareRupee}>{symbol}</Text>
              <Text style={styles.fareValue}>{fare}</Text>
            </View>
            <TouchableOpacity
              style={styles.fareBtn}
              onPress={() => setFare((f) => (f ?? 0) + 10)}
            >
              <Text style={styles.fareBtnText}>+{symbol}10</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.fareHint}>Suggested price · adjust as you like</Text>
        </View>
      ) : (
        <View style={styles.farePlaceholder}>
          <Text style={styles.farePlaceholderText}>
            {origin && destination ? "Calculating…" : "Select start & end to get fare suggestion"}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, (!origin || !destination || !fare) && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={loading || !origin || !destination || !fare}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>Post Ride →</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 60 },
  heading: { fontSize: 26, fontWeight: "800", color: Colors.textPrimary, marginBottom: 24 },

  label: {
    fontSize: 12, fontWeight: "700", color: Colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginTop: 20,
  },

  pickerBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: Colors.border, gap: 10,
  },
  pickerIcon: { fontSize: 18 },
  pickerText: { fontSize: 15, color: Colors.textPrimary, fontWeight: "500" },

  currentLocBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.surface, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: Colors.primary,
    marginBottom: 10, alignSelf: "flex-start", gap: 6,
    minWidth: 48, minHeight: 40,
  },
  currentLocIcon: { fontSize: 16, color: Colors.primary },
  currentLocText: { fontSize: 14, fontWeight: "700", color: Colors.primary },

  autocompleteWrap: { zIndex: 10 },
  autocompletePlaceholder: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.surface, borderRadius: 14,
    padding: 14, borderWidth: 1.5, borderColor: Colors.border,
    height: 48,
  },
  placeholderText: { fontSize: 14, color: Colors.textSecondary },
  pinIcon: { fontSize: 16, paddingHorizontal: 10, paddingTop: 12 },

  distanceCard: {
    backgroundColor: "#e8f4f8", borderRadius: 14, padding: 14,
    marginTop: 12, borderWidth: 1, borderColor: "#c5dfe8",
  },
  distanceRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 6 },
  distanceStat: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  distanceHint: { fontSize: 12, color: Colors.textSecondary, textAlign: "center" },
  distanceText: { fontSize: 13, color: Colors.textSecondary, marginLeft: 10 },

  stepperRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  stepperBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center",
  },
  stepperBtnText: { fontSize: 22, color: "#fff", fontWeight: "700", lineHeight: 26 },
  stepperValue: { fontSize: 24, fontWeight: "800", color: Colors.textPrimary, minWidth: 32, textAlign: "center" },
  stepperHint: { fontSize: 14, color: Colors.textSecondary },

  fareCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  fareRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  fareBtn: {
    backgroundColor: Colors.background, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  fareBtnText: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  fareValueWrap: { flexDirection: "row", alignItems: "flex-start" },
  fareRupee: { fontSize: 20, fontWeight: "700", color: Colors.textPrimary, marginTop: 4 },
  fareValue: { fontSize: 40, fontWeight: "800", color: Colors.textPrimary, lineHeight: 48 },
  fareHint: { fontSize: 12, color: Colors.textSecondary, textAlign: "center" },

  farePlaceholder: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 20,
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: "dashed",
    alignItems: "center",
  },
  farePlaceholderText: { fontSize: 13, color: Colors.textSecondary, textAlign: "center" },

  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 16,
    paddingVertical: 18, alignItems: "center", marginTop: 32,
  },
  submitBtnDisabled: { backgroundColor: Colors.border },
  submitBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});

const autocompleteStyles = {
  container: { flex: 0 },
  textInputContainer: {
    backgroundColor: "transparent",
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 0,
  },
  listView: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  row: {
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  description: { fontSize: 14, color: Colors.textPrimary },
  separator: { height: 1, backgroundColor: Colors.border },
};
