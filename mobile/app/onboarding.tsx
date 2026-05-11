import { useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../store/authStore";
import { Colors } from "../constants/colors";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    emoji: "💰",
    title: "Ride at Your Price",
    subtitle: "Offer or book rides at fares you agree on. No surge pricing surprises.",
  },
  {
    id: "2",
    emoji: "🛡️",
    title: "Safe & Verified Drivers",
    subtitle: "Every driver is manually reviewed. Real-time location shared with contacts.",
  },
  {
    id: "3",
    emoji: "💳",
    title: "Multiple Payment Options",
    subtitle: "Pay via UPI, card, wallet, or cash. Split fares with co-passengers easily.",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { setOnboardingDone } = useAuthStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const finish = async () => {
    await setOnboardingDone();
    router.replace("/(tabs)");
  };

  const next = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
      setActiveIndex((i) => i + 1);
    } else {
      finish();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skip} onPress={finish}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(index);
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.btn} onPress={next}>
          <Text style={styles.btnText}>
            {activeIndex === SLIDES.length - 1 ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  skip: { position: "absolute", top: 56, right: 24, zIndex: 10 },
  skipText: { fontSize: 15, color: Colors.textSecondary, fontWeight: "600" },

  slide: {
    width,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 120,
  },
  emoji: { fontSize: 80, marginBottom: 32 },
  title: {
    fontSize: 28, fontWeight: "800", color: Colors.textPrimary,
    textAlign: "center", marginBottom: 16,
  },
  subtitle: {
    fontSize: 16, color: Colors.textSecondary,
    textAlign: "center", lineHeight: 24,
  },

  bottom: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24, paddingBottom: 48, paddingTop: 16,
    backgroundColor: "#fff",
  },
  dots: { flexDirection: "row", justifyContent: "center", marginBottom: 24, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { width: 24, backgroundColor: Colors.primary },

  btn: {
    backgroundColor: Colors.primary, borderRadius: 16,
    paddingVertical: 16, alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
