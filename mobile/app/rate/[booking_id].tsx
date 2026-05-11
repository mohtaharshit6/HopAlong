import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  StyleSheet, Alert, ActivityIndicator, ScrollView, Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { submitRating } from "../../services/api";
import { Colors } from "../../constants/colors";

const DRIVER_CHIPS = [
  "Smooth ride", "On time", "Safe driver", "Clean car",
  "Great conversation", "Helpful", "Professional",
];

const RIDER_CHIPS = [
  "Respectful", "On time", "Good communication",
  "Kept seat clean", "Easy to find", "Polite",
];

const SCORE_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

export default function RateScreen() {
  const { booking_id, rated_user_id, name, context } = useLocalSearchParams<{
    booking_id: string;
    rated_user_id: string;
    name: string;
    context?: string; // "driver" | "rider"
  }>();
  const router = useRouter();

  const [score, setScore] = useState(0);
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const isRatingDriver = context !== "rider";
  const chips = isRatingDriver ? DRIVER_CHIPS : RIDER_CHIPS;
  const subject = isRatingDriver ? "driver" : "rider";

  const toggleChip = (chip: string) => {
    setSelectedChips((prev) => {
      const next = new Set(prev);
      next.has(chip) ? next.delete(chip) : next.add(chip);
      return next;
    });
  };

  const buildComment = () => {
    const chipText = Array.from(selectedChips).join(", ");
    if (!chipText) return comment.trim();
    if (!comment.trim()) return chipText;
    return `${chipText}. ${comment.trim()}`;
  };

  const handleSubmit = async () => {
    if (score === 0) {
      Alert.alert("Select a rating", "Please tap a star before submitting.");
      return;
    }
    setLoading(true);
    try {
      await submitRating(booking_id, rated_user_id, score, buildComment() || undefined);
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Rate your {subject}</Text>
      <Text style={styles.subtitle}>
        How was your experience with{" "}
        <Text style={styles.nameHighlight}>{name || `your ${subject}`}</Text>?
      </Text>

      {/* Stars */}
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((s) => (
          <TouchableOpacity key={s} onPress={() => setScore(s)} activeOpacity={0.7}>
            <Text style={[styles.star, s <= score && styles.starActive]}>★</Text>
          </TouchableOpacity>
        ))}
      </View>
      {score > 0 && (
        <Text style={styles.scoreLabel}>{SCORE_LABELS[score]}</Text>
      )}

      {/* Feedback chips */}
      {score > 0 && (
        <View style={styles.chipsSection}>
          <Text style={styles.chipsHeading}>What stood out?</Text>
          <View style={styles.chipsWrap}>
            {chips.map((chip) => {
              const active = selectedChips.has(chip);
              return (
                <TouchableOpacity
                  key={chip}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleChip(chip)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {active ? "✓ " : ""}{chip}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Free-text comment */}
      <Text style={styles.label}>Additional comments <Text style={styles.optional}>(optional)</Text></Text>
      <TextInput
        style={styles.commentInput}
        placeholder="Anything else to add…"
        placeholderTextColor={Colors.textSecondary}
        multiline
        numberOfLines={3}
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
  content: { padding: 24, paddingTop: 64, paddingBottom: 48 },

  back: { marginBottom: 28 },
  backText: { fontSize: 15, color: Colors.primary, fontWeight: "600" },

  title: { fontSize: 28, fontWeight: "800", color: Colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 32 },
  nameHighlight: { fontWeight: "700", color: Colors.textPrimary },

  starsRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 10 },
  star: { fontSize: 48, color: Colors.border },
  starActive: { color: Colors.accent },
  scoreLabel: {
    textAlign: "center", fontSize: 16, fontWeight: "700",
    color: Colors.accent, marginBottom: 24,
  },

  chipsSection: { marginBottom: 24 },
  chipsHeading: {
    fontSize: 12, fontWeight: "700", color: Colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12,
  },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.surface,
  },
  chipActive: { borderColor: Colors.primary, backgroundColor: "#eff6ff" },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  chipTextActive: { color: Colors.primary },

  label: {
    fontSize: 12, fontWeight: "700", color: Colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8,
  },
  optional: { fontWeight: "400", textTransform: "none" },
  commentInput: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    fontSize: 15, color: Colors.textPrimary,
    borderWidth: 1.5, borderColor: Colors.border,
    height: 96, marginBottom: 32,
  },

  btn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: "center",
  },
  btnDisabled: { backgroundColor: Colors.border },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
