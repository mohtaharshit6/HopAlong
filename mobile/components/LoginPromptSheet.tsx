import { useEffect, useRef } from "react";
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "../constants/colors";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function LoginPromptSheet({ visible, onClose }: Props) {
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(320)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 320,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [visible]);

  const handleLogin = () => {
    onClose();
    router.push("/(auth)/auth-landing");
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity activeOpacity={1} style={styles.inner}>
            <View style={styles.handle} />
            <Text style={styles.title}>Login or Sign Up to continue</Text>
            <Text style={styles.subtitle}>
              Create a free account to book rides, offer rides, and manage your trips.
            </Text>
            <TouchableOpacity style={styles.btn} onPress={handleLogin}>
              <Text style={styles.btnText}>Get Started</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Maybe later</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: 40,
  },
  inner: { paddingHorizontal: 24, paddingTop: 12 },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center", marginBottom: 24,
  },
  title: {
    fontSize: 22, fontWeight: "800",
    color: Colors.textPrimary, marginBottom: 10,
  },
  subtitle: {
    fontSize: 15, color: Colors.textSecondary,
    lineHeight: 22, marginBottom: 28,
  },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: "center", marginBottom: 12,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelBtn: { alignItems: "center", paddingVertical: 8 },
  cancelText: { fontSize: 15, color: Colors.textSecondary, fontWeight: "600" },
});
