import { Slot, useSegments, useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "../store/authStore";

export default function RootLayout() {
  const { token, onboardingDone, hydrated, loadStoredAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    loadStoredAuth();
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const inTabs = segments[0] === "(tabs)";
    const inOnboarding = segments[0] === "onboarding";

    if (token) {
      // Logged-in users should always be in tabs
      if (!inTabs) router.replace("/(tabs)");
      return;
    }

    // Unauthenticated: Preview First model
    if (!onboardingDone && !inOnboarding) {
      router.replace("/onboarding");
    } else if (onboardingDone && !inTabs) {
      router.replace("/(tabs)"); // skip login, show map
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, token, onboardingDone]);

  if (!hydrated) return null;

  return <Slot />;
}
