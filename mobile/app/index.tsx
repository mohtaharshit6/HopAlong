import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Colors } from "../constants/colors";

export default function SplashScreen() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <Text style={styles.logo}>HopAlong</Text>
        <Text style={styles.tagline}>Share rides, save costs</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    fontSize: 42,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    marginTop: 8,
  },
});
