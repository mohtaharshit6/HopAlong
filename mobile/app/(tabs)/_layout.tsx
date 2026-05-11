import { useState } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import LoginPromptSheet from "../../components/LoginPromptSheet";
import { Colors } from "../../constants/colors";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

function icon(name: IoniconsName, focusedName: IoniconsName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : name} size={24} color={color} />
  );
}

export default function TabsLayout() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setPendingRoute = useAuthStore((s) => s.setPendingRoute);
  const pendingRatings = (user?.pending_rating_count ?? 0) || undefined;
  const [showPrompt, setShowPrompt] = useState(false);

  const guard = (route: string) => (e: any) => {
    if (!token) {
      e.preventDefault();
      setPendingRoute(route);
      setShowPrompt(true);
    }
  };

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textSecondary,
          tabBarStyle: {
            borderTopColor: Colors.border,
            backgroundColor: Colors.surface,
            paddingBottom: 4,
            height: 60,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Find Rides",
            tabBarIcon: icon("compass-outline", "compass"),
          }}
        />
        <Tabs.Screen
          name="offer"
          options={{
            title: "Offer Ride",
            tabBarIcon: icon("add-circle-outline", "add-circle"),
          }}
          listeners={{ tabPress: guard("/(tabs)/offer") }}
        />
        <Tabs.Screen
          name="my-rides"
          options={{
            title: "My Rides",
            tabBarBadge: pendingRatings,
            tabBarIcon: icon("car-outline", "car"),
          }}
          listeners={{ tabPress: guard("/(tabs)/my-rides") }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: icon("person-outline", "person"),
          }}
          listeners={{ tabPress: guard("/(tabs)/profile") }}
        />
      </Tabs>
      <LoginPromptSheet visible={showPrompt} onClose={() => setShowPrompt(false)} />
    </>
  );
}
