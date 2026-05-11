import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import { Colors } from "../../constants/colors";
import api from "../../services/api";

export default function AuthLanding() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const handlePhoneContinue = async () => {
    if (phone.length !== 10) return;
    setLoading(true);
    try {
      await api.post("/api/auth/send-otp", { phone });
      router.push({ pathname: "/(auth)/otp", params: { phone } });
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.response?.data?.error || "Could not send OTP. Make sure Flask is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const canContinue = phone.length === 10;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>HopAlong</Text>
        <Text style={styles.tagline}>Share rides, save costs</Text>

        <Text style={styles.label}>Enter your mobile number</Text>
        <View style={styles.phoneRow}>
          <View style={styles.prefix}>
            <Text style={styles.prefixText}>🇮🇳 +91</Text>
          </View>
          <TextInput
            style={styles.phoneInput}
            placeholder="10-digit number"
            placeholderTextColor={Colors.textSecondary}
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, "").slice(0, 10))}
            keyboardType="phone-pad"
            maxLength={10}
          />
        </View>

        <TouchableOpacity
          style={[styles.btn, !canContinue && styles.btnDisabled]}
          onPress={handlePhoneContinue}
          disabled={!canContinue || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Continue →</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.emailBtn}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={styles.emailBtnText}>✉️  Continue with Email</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 28, paddingBottom: 40 },

  logo: {
    fontSize: 38, fontWeight: "800", color: Colors.primary,
    textAlign: "center", letterSpacing: -1,
  },
  tagline: {
    fontSize: 14, color: Colors.textSecondary,
    textAlign: "center", marginBottom: 48,
  },

  label: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary, marginBottom: 8 },
  phoneRow: {
    flexDirection: "row", borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 14, overflow: "hidden", marginBottom: 16,
  },
  prefix: {
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: Colors.surface, borderRightWidth: 1,
    borderRightColor: Colors.border, justifyContent: "center",
  },
  prefixText: { fontSize: 15, fontWeight: "600", color: Colors.textPrimary },
  phoneInput: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 17, color: Colors.textPrimary, letterSpacing: 2,
  },

  btn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: "center", marginBottom: 24,
  },
  btnDisabled: { backgroundColor: Colors.border },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  dividerRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: 12, color: Colors.textSecondary, fontSize: 13 },

  emailBtn: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14,
    paddingVertical: 14, alignItems: "center",
  },
  emailBtnText: { fontSize: 15, fontWeight: "600", color: Colors.textPrimary },
});
