import { useRef, useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import { Colors } from "../../constants/colors";
import api from "../../services/api";

const OTP_LENGTH = 6;

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const router = useRouter();
  const { setAuth, pendingRoute, setPendingRoute } = useAuthStore();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(30);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newDigits.every((d) => d !== "") && newDigits[index] !== "") {
      verify(newDigits.join(""));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verify = async (otp: string) => {
    setLoading(true);
    try {
      const res = await api.post("/api/auth/verify-otp", { phone, otp });
      await setAuth(res.data.token, res.data.user);

      if (res.data.isNewUser) {
        router.replace("/(auth)/profile-setup");
      } else {
        const target = pendingRoute ?? "/(tabs)";
        setPendingRoute(null);
        router.replace(target as any);
      }
    } catch (err: any) {
      Alert.alert("Invalid OTP", err.response?.data?.error || "Please check the code and try again");
      setDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await api.post("/api/auth/send-otp", { phone });
      setResendSeconds(30);
      setDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } catch {
      Alert.alert("Error", "Could not resend OTP");
    }
  };

  const maskedPhone = phone
    ? `+91 ${"X".repeat(5)}${phone.slice(-5)}`
    : "";

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Verify your number</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit OTP sent to{"\n"}
        <Text style={styles.phone}>{maskedPhone}</Text>
      </Text>

      <View style={styles.otpRow}>
        {digits.map((digit, i) => (
          <TextInput
            key={i}
            ref={(r) => { inputRefs.current[i] = r; }}
            style={[styles.box, digit !== "" && styles.boxFilled]}
            value={digit}
            onChangeText={(t) => handleChange(t, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={2}
            selectTextOnFocus
            textAlign="center"
          />
        ))}
      </View>

      {loading && (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
      )}

      <TouchableOpacity
        onPress={resend}
        disabled={resendSeconds > 0}
        style={styles.resendRow}
      >
        <Text style={[styles.resendText, resendSeconds > 0 && styles.resendDisabled]}>
          {resendSeconds > 0
            ? `Resend OTP in ${resendSeconds}s`
            : "Resend OTP"}
        </Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        💡 Check the Flask terminal window for the OTP (dev mode)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 28, paddingTop: 72 },
  back: { marginBottom: 32 },
  backText: { fontSize: 15, color: Colors.primary, fontWeight: "600" },

  title: { fontSize: 28, fontWeight: "800", color: Colors.textPrimary, marginBottom: 12 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 40 },
  phone: { fontWeight: "700", color: Colors.textPrimary },

  otpRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
  box: {
    width: 48, height: 56, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    fontSize: 22, fontWeight: "700", color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  boxFilled: { borderColor: Colors.primary, backgroundColor: "#f0f9ff" },

  resendRow: { marginTop: 32, alignItems: "center" },
  resendText: { fontSize: 14, color: Colors.primary, fontWeight: "600" },
  resendDisabled: { color: Colors.textSecondary },

  hint: {
    fontSize: 12, color: Colors.textSecondary,
    textAlign: "center", marginTop: 24,
    paddingHorizontal: 16,
  },
});
