import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, Image, ActivityIndicator, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "../../store/authStore";
import { Colors } from "../../constants/colors";
import api from "../../services/api";

export default function ProfileSetup() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [photo, setPhoto] = useState<string | null>(user?.profile_picture ?? null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to set a profile picture");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      // Store as data URI so the backend receives a portable URL, not a device-local path
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleContinue = async () => {
    if (!name.trim()) return Alert.alert("Required", "Please enter your name");
    setLoading(true);
    try {
      const res = await api.put("/api/auth/profile", {
        name: name.trim(),
        email: email.trim() || undefined,
        profile_picture: photo,
      });
      updateUser(res.data.user);
      router.replace("/(auth)/user-type");
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.error || "Could not save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Complete your profile</Text>
      <Text style={styles.subtitle}>This is how other riders will see you</Text>

      <TouchableOpacity style={styles.avatarWrap} onPress={pickImage}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarIcon}>👤</Text>
          </View>
        )}
        <View style={styles.cameraChip}>
          <Text style={styles.cameraIcon}>📷</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.label}>Full Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="Your full name"
        value={name}
        onChangeText={setName}
        placeholderTextColor={Colors.textSecondary}
        autoCapitalize="words"
      />

      <Text style={styles.label}>Email <Text style={styles.optional}>(optional)</Text></Text>
      <TextInput
        style={styles.input}
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor={Colors.textSecondary}
      />

      <TouchableOpacity style={styles.btn} onPress={handleContinue} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Continue →</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  inner: { paddingHorizontal: 28, paddingTop: 64, paddingBottom: 40 },

  title: { fontSize: 28, fontWeight: "800", color: Colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 40 },

  avatarWrap: { alignSelf: "center", marginBottom: 36, position: "relative" },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.border,
    justifyContent: "center", alignItems: "center",
  },
  avatarIcon: { fontSize: 44 },
  cameraChip: {
    position: "absolute", bottom: 0, right: 0,
    backgroundColor: Colors.primary, borderRadius: 20,
    width: 32, height: 32, justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  cameraIcon: { fontSize: 16 },

  label: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary, marginBottom: 8 },
  optional: { fontWeight: "400" },
  input: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 20,
    fontSize: 15, color: Colors.textPrimary, borderWidth: 1.5, borderColor: Colors.border,
  },

  btn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: "center", marginTop: 8,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
