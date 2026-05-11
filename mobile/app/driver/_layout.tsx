import { Stack } from "expo-router";
import { Colors } from "../../constants/colors";

export default function DriverLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="active/[ride_id]" options={{ title: "Active Ride" }} />
      <Stack.Screen name="bids/[ride_id]" options={{ title: "Ride Bids" }} />
    </Stack>
  );
}
