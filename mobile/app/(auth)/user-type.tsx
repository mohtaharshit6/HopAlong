import { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import { Colors } from "../../constants/colors";
import api from "../../services/api";

type Role = "rider" | "driver" | "both";

export default function UserTypeScreen() {
  const router = useRouter();
  const { updateUser } = useAuthStore();
  const [selected, setSelected] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);

  const handleContinue = async (role: Role) => {
    setSelected(role);
    setLoading(true);
    try {
      const res = await api.put("/api/auth/profile", { role });
      updateUser(res.data.user);
      router.replace("/(tabs)");
    } catch {
      router.replace("/(tabs)");
    } finally {
      setLoading(false);
    }
  };

  const OPTIONS = [
    { role: "rider" as Role, emoji: "🪑", label: "I want to book rides", desc: "Find and book seats on available rides" },
    { role: "driver" as Role, emoji: "🚗", label: "I want to offer rides", desc: "Post your rides and earn along the way" },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>How will you use{"\n"}HopAlong?</Text>
      <Text style={styles.subtitle}>You can change this anytime in settings</Text>

      <View style={styles.cards}>
        {OPTIONS.map(({ role, emoji, label, desc }) => (
          <TouchableOpacity
            key={role}
            style={[styles.card, selected === role && styles.cardSelected]}
            onPress={() => handleContinue(role)}
            disabled={loading}
          >
            <Text style={styles.cardEmoji}>{emoji}</Text>
            <Text style={styles.cardLabel}>{label}</Text>
            <Text style={styles.cardDesc}>{desc}</Text>
            {loading && selected === role && (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 8 }} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity onPress={() => handleContinue("both")} disabled={loading}>
        <Text style={styles.bothLink}>I'll do both →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: "#fff",
    paddingHorizontal: 24, paddingTop: 72, alignItems: "center",
  },
  title: {
    fontSize: 30, fontWeight: "800", color: Colors.textPrimary,
    textAlign: "center", marginBottom: 12, lineHeight: 38,
  },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 48 },

  cards: { width: "100%", gap: 16 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 20,
    padding: 24, alignItems: "center",
    borderWidth: 2, borderColor: Colors.border,
  },
  cardSelected: { borderColor: Colors.primary, backgroundColor: "#f0f9ff" },
  cardEmoji: { fontSize: 48, marginBottom: 12 },
  cardLabel: { fontSize: 17, fontWeight: "700", color: Colors.textPrimary, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: Colors.textSecondary, textAlign: "center" },

  bothLink: {
    marginTop: 32, fontSize: 15,
    color: Colors.primary, fontWeight: "700",
  },
});
