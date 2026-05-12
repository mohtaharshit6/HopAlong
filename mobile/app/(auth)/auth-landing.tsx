import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  Alert, ActivityIndicator, SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "../../constants/colors";
import api from "../../services/api";

export default function AuthLanding() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handlePhoneContinue = async () => {
    if (phone.length !== 10) return;
    setLoading(true);
    try {
      await api.post("/api/auth/send-otp", { phone });
      router.push({ pathname: "/(auth)/otp", params: { phone } });
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.error || "Could not send OTP. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const ready = phone.length === 10;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>HopAlong</Text>
            <Text style={styles.tagline}>Share rides · Save costs</Text>
          </View>

          {/* Phone input */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>MOBILE NUMBER</Text>
            <View style={styles.phoneRow}>
              <View style={styles.prefix}>
                <Text style={styles.prefixText}>+91</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="Enter 10-digit number"
                placeholderTextColor={Colors.textSecondary}
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/\D/g, "").slice(0, 10))}
                keyboardType="phone-pad"
                maxLength={10}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, !ready && styles.primaryBtnDisabled]}
              onPress={handlePhoneContinue}
              disabled={!ready || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Get OTP →</Text>}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email login */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push("/(auth)/login")}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>Continue with Email</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            New users will be asked to complete their profile after OTP verification.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    paddingBottom: 32,
  },

  header: { alignItems: "center", marginBottom: 40 },
  logo: {
    fontSize: 40, fontWeight: "800",
    color: Colors.primary, letterSpacing: -1,
  },
  tagline: {
    fontSize: 14, color: Colors.textSecondary, marginTop: 6,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: "700",
    color: Colors.textSecondary, letterSpacing: 1,
    marginBottom: 10,
  },
  phoneRow: {
    flexDirection: "row",
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  prefix: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  prefixText: {
    fontSize: 16, fontWeight: "700", color: Colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    color: Colors.textPrimary,
    letterSpacing: 3,
    backgroundColor: "#fff",
  },

  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryBtnDisabled: { backgroundColor: Colors.border },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
    paddingHorizontal: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
  },

  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  secondaryBtnText: {
    fontSize: 15, fontWeight: "700", color: Colors.primary,
  },

  hint: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
});
