import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "../constants/colors";
import { formatPrice } from "../utils/currency";

interface RideCardProps {
  ride: {
    id: string;
    driver?: { name: string; rating: number };
    start_location: string;
    end_location: string;
    date: string;
    time: string;
    available_seats: number;
    fare: number;
    vehicle?: { make: string; model: string };
  };
}

export default function RideCard({ ride }: RideCardProps) {
  const router = useRouter();

  return (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/ride/${ride.id}`)}>
      <View style={styles.header}>
        <Text style={styles.driverName}>{ride.driver?.name ?? "Driver"}</Text>
        <View style={styles.seatsBadge}>
          <Text style={styles.seatsText}>{ride.available_seats} seat{ride.available_seats !== 1 ? "s" : ""}</Text>
        </View>
      </View>

      {ride.vehicle && (
        <Text style={styles.vehicle}>{ride.vehicle.make} {ride.vehicle.model}</Text>
      )}

      {/* Route — Date — Time order per PRD */}
      <View style={styles.routeRow}>
        <View style={styles.routeDots}>
          <View style={[styles.dot, styles.dotFrom]} />
          <View style={styles.routeLine} />
          <View style={[styles.dot, styles.dotTo]} />
        </View>
        <View style={styles.routeLabels}>
          <Text style={styles.routeText} numberOfLines={1}>{ride.start_location}</Text>
          <Text style={styles.routeText} numberOfLines={1}>{ride.end_location}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{ride.date}</Text>
        <Text style={styles.footerText}>{ride.time}</Text>
        <Text style={styles.fare}>{formatPrice(ride.fare)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  driverName: { fontSize: 15, fontWeight: "700", color: Colors.textPrimary },
  seatsBadge: { backgroundColor: Colors.accent, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  seatsText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  vehicle: { fontSize: 12, color: Colors.textSecondary, marginBottom: 10 },
  routeRow: { flexDirection: "row", alignItems: "stretch", marginBottom: 12 },
  routeDots: { alignItems: "center", marginRight: 10, paddingTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotFrom: { backgroundColor: Colors.dotFrom },
  dotTo: { backgroundColor: Colors.dotTo },
  routeLine: { width: 2, flex: 1, backgroundColor: Colors.border, marginVertical: 2 },
  routeLabels: { flex: 1, gap: 12 },
  routeText: { fontSize: 14, color: Colors.textPrimary },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  footerText: { fontSize: 13, color: Colors.textSecondary },
  fare: { fontSize: 16, fontWeight: "800", color: Colors.primary },
});
