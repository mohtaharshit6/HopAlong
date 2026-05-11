import { useCallback, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { getMe, updateMe, addVehicle } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { Colors } from "../../constants/colors";

export default function ProfileScreen() {
  const { user, setAuth, updateUser, clearAuth, token } = useAuthStore();
  const router = useRouter();
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vMake, setVMake] = useState("");
  const [vModel, setVModel] = useState("");
  const [vPlate, setVPlate] = useState("");
  const [vColor, setVColor] = useState("");

  // Refresh user data (and pending_rating_count) whenever screen is focused
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      getMe()
        .then((res) => {
          updateUser(res.data);
          setName(res.data.name || "");
        })
        .catch(() => {});
    }, [token])
  );

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await updateMe({ name: name.trim() });
      if (token) setAuth(token, res.data);
      Alert.alert("Saved", "Profile updated.");
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleAddVehicle = async () => {
    if (!vMake || !vModel || !vPlate) {
      Alert.alert("Error", "Make, model, and license plate are required");
      return;
    }
    try {
      await addVehicle({ make: vMake, model: vModel, license_plate: vPlate, color: vColor });
      Alert.alert("Done", "Vehicle added!");
      setShowVehicleForm(false);
      setVMake(""); setVModel(""); setVPlate(""); setVColor("");
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.error || "Failed to add vehicle");
    }
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await clearAuth();
          router.replace("/(tabs)");
        },
      },
    ]);
  };

  const stars = "★".repeat(Math.round(user?.rating ?? 0)) + "☆".repeat(5 - Math.round(user?.rating ?? 0));
  const pendingCount = user?.pending_rating_count ?? 0;

  if (!user) {
    return (
      <View style={styles.guestContainer}>
        <Text style={styles.guestEmoji}>👤</Text>
        <Text style={styles.guestTitle}>You're not logged in</Text>
        <Text style={styles.guestSubtitle}>Log in to view and edit your profile.</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/(auth)/auth-landing")}>
          <Text style={styles.loginBtnText}>Log In / Sign Up</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar & Rating */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name?.[0]?.toUpperCase() ?? "?"}</Text>
        </View>
        <Text style={styles.displayName}>{user.name ?? "No name set"}</Text>
        <Text style={styles.rating}>{stars} ({user.rating?.toFixed(1) ?? "0.0"})</Text>
        {user.phone && <Text style={styles.meta}>+91 {user.phone}</Text>}
        {user.email && <Text style={styles.meta}>{user.email}</Text>}
      </View>

      {/* Pending ratings banner */}
      {pendingCount > 0 && (
        <TouchableOpacity
          style={styles.ratingBanner}
          onPress={() => router.push("/(tabs)/my-rides")}
        >
          <Text style={styles.ratingBannerText}>
            ★ You have {pendingCount} pending rating{pendingCount > 1 ? "s" : ""} — tap to rate
          </Text>
        </TouchableOpacity>
      )}

      {/* Edit Profile */}
      <Text style={styles.sectionTitle}>Edit Profile</Text>
      <Text style={styles.label}>Full Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholderTextColor={Colors.textSecondary}
        placeholder="Your name"
      />
      <TouchableOpacity style={styles.btn} onPress={handleSaveProfile} disabled={saving}>
        <Text style={styles.btnText}>{saving ? "Saving…" : "Save Profile"}</Text>
      </TouchableOpacity>

      {/* Vehicle */}
      <Text style={styles.sectionTitle}>Vehicle</Text>
      {!showVehicleForm ? (
        <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowVehicleForm(true)}>
          <Text style={styles.outlineBtnText}>+ Add / Update Vehicle</Text>
        </TouchableOpacity>
      ) : (
        <View>
          <TextInput style={styles.input} placeholder="Make (e.g. Maruti)" value={vMake} onChangeText={setVMake} placeholderTextColor={Colors.textSecondary} />
          <TextInput style={styles.input} placeholder="Model (e.g. Swift)" value={vModel} onChangeText={setVModel} placeholderTextColor={Colors.textSecondary} />
          <TextInput style={styles.input} placeholder="License Plate" value={vPlate} onChangeText={setVPlate} autoCapitalize="characters" placeholderTextColor={Colors.textSecondary} />
          <TextInput style={styles.input} placeholder="Color (optional)" value={vColor} onChangeText={setVColor} placeholderTextColor={Colors.textSecondary} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={handleAddVehicle}>
              <Text style={styles.btnText}>Save Vehicle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.outlineBtn, { flex: 1 }]} onPress={() => setShowVehicleForm(false)}>
              <Text style={styles.outlineBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },

  header: { alignItems: "center", marginBottom: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "800" },
  displayName: { fontSize: 20, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  rating: { fontSize: 14, color: Colors.accent, marginBottom: 4 },
  meta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  ratingBanner: {
    backgroundColor: "#fff9e6", borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: Colors.accent, marginBottom: 20,
  },
  ratingBannerText: { fontSize: 14, fontWeight: "700", color: Colors.accent, textAlign: "center" },

  sectionTitle: {
    fontSize: 16, fontWeight: "700", color: Colors.textPrimary,
    marginTop: 24, marginBottom: 12,
  },
  label: {
    fontSize: 12, fontWeight: "700", color: Colors.textSecondary,
    marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    fontSize: 15, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 12,
  },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    padding: 14, alignItems: "center", marginBottom: 8,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  outlineBtn: {
    borderWidth: 2, borderColor: Colors.primary, borderRadius: 12,
    padding: 14, alignItems: "center", marginBottom: 8,
  },
  outlineBtnText: { color: Colors.primary, fontWeight: "700", fontSize: 15 },
  logoutBtn: {
    marginTop: 32, borderWidth: 1, borderColor: Colors.error,
    borderRadius: 12, padding: 14, alignItems: "center",
  },
  logoutText: { color: Colors.error, fontWeight: "700", fontSize: 15 },

  guestContainer: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: "center", justifyContent: "center", padding: 32,
  },
  guestEmoji: { fontSize: 64, marginBottom: 16 },
  guestTitle: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary, marginBottom: 8 },
  guestSubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: "center", marginBottom: 28 },
  loginBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 32,
  },
  loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
