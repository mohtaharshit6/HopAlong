import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { submitRating } from "../../services/api";
import { Colors } from "../../constants/colors";

export default function RateScreen() {
  const { booking_id, rated_user_id, name } = useLocalSearchParams<{
    booking_id: string;
    rated_user_id: string;
    name: string;
  }>();
  const router = useRouter();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const labels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

  const handleSubmit = async () => {
    if (score === 0) {
      Alert.alert("Select a rating", "Please tap a star before submitting.");
      return;
    }
    setLoading(true);
    try {
      await submitRating(booking_id, rated_user_id, score, comment.trim());
      Alert.alert("Thanks!", "Your rating has been submitted.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.error || "Failed to submit rating");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Rate your ride</Text>
      <Text style={styles.subtitle}>
        How was your experience with{" "}
        <Text style={styles.driverName}>{name || "your driver"}</Text>?
      </Text>

      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((s) => (
          <TouchableOpacity key={s} onPress={() => setScore(s)} activeOpacity={0.7}>
            <Text style={[styles.star, s <= score && styles.starActive]}>★</Text>
          </TouchableOpacity>
        ))}
      </View>
      {score > 0 && (
        <Text style={styles.scoreLabel}>{labels[score]}</Text>
      )}

      <Text style={styles.label}>Comment (optional)</Text>
      <TextInput
        style={styles.commentInput}
        placeholder="Share what you liked or what could improve…"
        placeholderTextColor={Colors.textSecondary}
        multiline
        numberOfLines={4}
        value={comment}
        onChangeText={setComment}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.btn, score === 0 && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={loading || score === 0}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Submit Rating</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 24, paddingTop: 64 },

  back: { marginBottom: 32 },
  backText: { fontSize: 15, color: Colors.primary, fontWeight: "600" },

  title: { fontSize: 28, fontWeight: "800", color: Colors.textPrimary, marginBottom: 10 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 36 },
  driverName: { fontWeight: "700", color: Colors.textPrimary },

  starsRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 12 },
  star: { fontSize: 48, color: Colors.border },
  starActive: { color: Colors.accent },
  scoreLabel: {
    textAlign: "center", fontSize: 16, fontWeight: "700",
    color: Colors.accent, marginBottom: 32,
  },

  label: {
    fontSize: 12, fontWeight: "700", color: Colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.8,
    marginBottom: 8, marginTop: 16,
  },
  commentInput: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    fontSize: 15, color: Colors.textPrimary,
    borderWidth: 1.5, borderColor: Colors.border,
    height: 110, marginBottom: 32,
  },

  btn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: "center",
  },
  btnDisabled: { backgroundColor: Colors.border },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
