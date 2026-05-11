import { Slot, useSegments, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useAuthStore } from "../store/authStore";
import { registerForPushNotifications } from "../utils/notifications";

export default function RootLayout() {
  const { token, onboardingDone, hydrated, loadStoredAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Register push token whenever user logs in
  useEffect(() => {
    if (hydrated && token) {
      registerForPushNotifications();
    }
  }, [hydrated, token]);

  // Handle notification taps — navigate to the screen in data.screen
  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const screen = response.notification.request.content.data?.screen as string | undefined;
        if (screen) {
          try { router.push(screen as any); } catch {}
        }
      }
    );
    return () => {
      responseListener.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const inTabs = segments[0] === "(tabs)";
    const inOnboarding = segments[0] === "onboarding";

    if (token) {
      if (!inTabs) router.replace("/(tabs)");
      return;
    }

    if (!onboardingDone && !inOnboarding) {
      router.replace("/onboarding");
    } else if (onboardingDone && !inTabs) {
      router.replace("/(tabs)");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, token, onboardingDone]);

  if (!hydrated) return null;

  return <Slot />;
}
