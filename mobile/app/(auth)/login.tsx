import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { login } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { Colors } from "../../constants/colors";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const res = await login(email.trim().toLowerCase(), password);
      setAuth(res.data.token, res.data.user);
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Login failed", err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <Text style={styles.logo}>HopAlong</Text>
      <Text style={styles.subtitle}>Share rides, save costs</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor={Colors.textSecondary}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor={Colors.textSecondary}
      />

      <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
        <Text style={styles.btnText}>{loading ? "Logging in…" : "Log In"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
        <Text style={styles.link}>Don't have an account? <Text style={styles.linkBold}>Register</Text></Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: Colors.background },
  logo: { fontSize: 36, fontWeight: "800", color: Colors.primary, textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: "center", marginBottom: 32 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 12,
    fontSize: 15, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border,
  },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 12, padding: 16, marginTop: 8, alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  link: { textAlign: "center", marginTop: 20, color: Colors.textSecondary, fontSize: 14 },
  linkBold: { color: Colors.primary, fontWeight: "700" },
});
