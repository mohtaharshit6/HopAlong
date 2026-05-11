import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { register } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { Colors } from "../../constants/colors";

export default function RegisterScreen() {
  const [step, setStep] = useState(1);

  // Step 1
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Step 2
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const goToStep2 = () => {
    if (!name.trim()) return Alert.alert("Error", "Please enter your full name");
    if (!email.trim() || !email.includes("@")) return Alert.alert("Error", "Please enter a valid email");
    if (!phone.trim() || phone.length < 10) return Alert.alert("Error", "Please enter a valid 10-digit phone number");
    setStep(2);
  };

  const handleRegister = async () => {
    if (!password) return Alert.alert("Error", "Please enter a password");
    if (password.length < 8) return Alert.alert("Error", "Password must be at least 8 characters");
    if (password !== confirmPassword) return Alert.alert("Error", "Passwords do not match");

    setLoading(true);
    try {
      const res = await register(name.trim(), email.trim().toLowerCase(), password, phone.trim());
      setAuth(res.data.token, res.data.user);
      router.replace("/(tabs)");
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Something went wrong";
      Alert.alert("Registration failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>HopAlong</Text>
        <Text style={styles.subtitle}>
          {step === 1 ? "Create your account" : "Set your password"}
        </Text>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, styles.stepActive]} />
          <View style={styles.stepLine} />
          <View style={[styles.stepDot, step === 2 && styles.stepActive]} />
        </View>

        {step === 1 ? (
          <>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Harshit Mohta"
              value={name}
              onChangeText={setName}
              placeholderTextColor={Colors.textSecondary}
            />

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={Colors.textSecondary}
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="10-digit mobile number"
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/\D/g, ""))}
              keyboardType="phone-pad"
              maxLength={10}
              placeholderTextColor={Colors.textSecondary}
            />

            <TouchableOpacity style={styles.btn} onPress={goToStep2}>
              <Text style={styles.btnText}>Continue →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Min 8 characters"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor={Colors.textSecondary}
              />
              <TouchableOpacity style={styles.eye} onPress={() => setShowPassword((v) => !v)}>
                <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                placeholderTextColor={Colors.textSecondary}
              />
              <TouchableOpacity style={styles.eye} onPress={() => setShowConfirm((v) => !v)}>
                <Text style={styles.eyeText}>{showConfirm ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
              <Text style={styles.btnText}>{loading ? "Creating account…" : "Create Account"}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep(1)}>
              <Text style={styles.link}>← Back</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.linkBottom}>
            Already have an account? <Text style={styles.linkBold}>Log In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  logo: { fontSize: 36, fontWeight: "800", color: Colors.primary, textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: "center", marginBottom: 24 },

  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 32 },
  stepDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.border,
  },
  stepActive: { backgroundColor: Colors.primary },
  stepLine: { width: 48, height: 2, backgroundColor: Colors.border, marginHorizontal: 8 },

  label: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 16,
    fontSize: 15, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border,
  },
  passwordRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, marginBottom: 16,
  },
  passwordInput: {
    flex: 1, padding: 14, fontSize: 15, color: Colors.textPrimary,
  },
  eye: { paddingHorizontal: 14 },
  eyeText: { fontSize: 18 },

  btn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, marginTop: 8, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  link: { textAlign: "center", marginTop: 16, color: Colors.primary, fontSize: 14, fontWeight: "600" },
  linkBottom: { textAlign: "center", marginTop: 28, color: Colors.textSecondary, fontSize: 14 },
  linkBold: { color: Colors.primary, fontWeight: "700" },
});
