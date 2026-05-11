import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { getMyKyc, submitKyc } from "../services/api";
import { Colors } from "../constants/colors";

const STATUS_CONFIG = {
  submitted: { label: "Under Review", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  verified:  { label: "Verified ✓",   color: "#10b981", bg: "#ecfdf5", border: "#6ee7b7" },
  rejected:  { label: "Rejected",     color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
};

async function pickPhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission needed", "Allow photo access to upload documents");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.5,
    base64: true,
  });
  if (!result.canceled && result.assets[0].base64) {
    return `data:image/jpeg;base64,${result.assets[0].base64}`;
  }
  return null;
}

export default function KYCScreen() {
  const router = useRouter();

  const [existing, setExisting] = useState<any>(null);
  const [loadingKyc, setLoadingKyc] = useState(true);

  const [dlNumber, setDlNumber] = useState("");
  const [rcNumber, setRcNumber] = useState("");
  const [dlPhoto, setDlPhoto] = useState<string | null>(null);
  const [rcPhoto, setRcPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getMyKyc()
      .then((res) => {
        const kyc = res.data;
        if (kyc) {
          setExisting(kyc);
          setDlNumber(kyc.dl_number || "");
          setRcNumber(kyc.rc_number || "");
          setDlPhoto(kyc.dl_photo || null);
          setRcPhoto(kyc.rc_photo || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingKyc(false));
  }, []);

  const handleSubmit = async () => {
    if (!dlNumber.trim() || !rcNumber.trim()) {
      Alert.alert("Required", "Please enter both DL number and RC number.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitKyc({
        dl_number: dlNumber.trim(),
        rc_number: rcNumber.trim(),
        dl_photo: dlPhoto,
        rc_photo: rcPhoto,
      });
      setExisting(res.data);
      Alert.alert(
        "Submitted!",
        "Your KYC documents have been submitted for review. We'll notify you once verified.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.error || "Failed to submit KYC");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingKyc) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  const cfg = existing ? STATUS_CONFIG[existing.status as keyof typeof STATUS_CONFIG] : null;
  const isVerified = existing?.status === "verified";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Driver Verification</Text>
      <Text style={styles.subtitle}>
        Upload your Driving Licence and Vehicle RC to get verified. Verified drivers earn more trust from riders.
      </Text>

      {/* Status banner */}
      {cfg && (
        <View style={[styles.statusBanner, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
          {existing.rejection_reason && (
            <Text style={styles.rejectionReason}>Reason: {existing.rejection_reason}</Text>
          )}
          {existing.status === "rejected" && (
            <Text style={[styles.rejectionReason, { marginTop: 4 }]}>
              Update your details below and resubmit.
            </Text>
          )}
        </View>
      )}

      {!isVerified && (
        <>
          {/* DL Number */}
          <Text style={styles.label}>Driving Licence Number *</Text>
          <TextInput
            style={styles.input}
            value={dlNumber}
            onChangeText={(t) => setDlNumber(t.toUpperCase())}
            placeholder="MH-1234567890123"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="characters"
          />

          {/* RC Number */}
          <Text style={styles.label}>Vehicle RC Number *</Text>
          <TextInput
            style={styles.input}
            value={rcNumber}
            onChangeText={(t) => setRcNumber(t.toUpperCase())}
            placeholder="MH01AB1234"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="characters"
          />

          {/* DL Photo */}
          <Text style={styles.label}>DL Photo <Text style={styles.optional}>(optional but recommended)</Text></Text>
          <TouchableOpacity
            style={styles.photoBox}
            onPress={async () => {
              const p = await pickPhoto();
              if (p) setDlPhoto(p);
            }}
          >
            {dlPhoto ? (
              <Image source={{ uri: dlPhoto }} style={styles.photoPreview} resizeMode="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoIcon}>🪪</Text>
                <Text style={styles.photoHint}>Tap to upload DL photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* RC Photo */}
          <Text style={styles.label}>RC Photo <Text style={styles.optional}>(optional but recommended)</Text></Text>
          <TouchableOpacity
            style={styles.photoBox}
            onPress={async () => {
              const p = await pickPhoto();
              if (p) setRcPhoto(p);
            }}
          >
            {rcPhoto ? (
              <Image source={{ uri: rcPhoto }} style={styles.photoPreview} resizeMode="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoIcon}>📄</Text>
                <Text style={styles.photoHint}>Tap to upload RC photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>
                  {existing ? "Resubmit for Review" : "Submit for Verification"}
                </Text>}
          </TouchableOpacity>
        </>
      )}

      {isVerified && (
        <View style={styles.verifiedCard}>
          <Text style={styles.verifiedIcon}>✅</Text>
          <Text style={styles.verifiedTitle}>You're Verified!</Text>
          <Text style={styles.verifiedSub}>
            Your DL and RC have been verified. Riders will see a verified badge on your profile.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 24, paddingTop: 60, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  back: { marginBottom: 24 },
  backText: { fontSize: 15, color: Colors.primary, fontWeight: "600" },

  title: { fontSize: 26, fontWeight: "800", color: Colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, marginBottom: 24 },

  statusBanner: {
    borderRadius: 12, padding: 14, borderWidth: 1.5, marginBottom: 24,
  },
  statusLabel: { fontSize: 15, fontWeight: "800" },
  rejectionReason: { fontSize: 13, color: "#6b7280", marginTop: 4 },

  label: {
    fontSize: 12, fontWeight: "700", color: Colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginTop: 16,
  },
  optional: { fontWeight: "400", textTransform: "none", letterSpacing: 0 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    fontSize: 15, color: Colors.textPrimary,
    borderWidth: 1.5, borderColor: Colors.border, marginBottom: 4,
  },

  photoBox: {
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
    borderStyle: "dashed", overflow: "hidden", marginBottom: 4, height: 140,
  },
  photoPreview: { width: "100%", height: "100%" },
  photoPlaceholder: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.surface,
  },
  photoIcon: { fontSize: 32 },
  photoHint: { fontSize: 13, color: Colors.textSecondary },

  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: "center", marginTop: 24,
  },
  submitBtnDisabled: { backgroundColor: Colors.border },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  verifiedCard: { alignItems: "center", paddingTop: 24, gap: 12 },
  verifiedIcon: { fontSize: 64 },
  verifiedTitle: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary },
  verifiedSub: { fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 21 },
});
