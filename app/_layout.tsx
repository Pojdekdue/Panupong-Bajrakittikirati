import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* หน้า Login (ซ่อน Header) */}
      <Stack.Screen name="login" />
      {/* หน้า Tabs หลัก (ซ่อน Header) */}
      <Stack.Screen name="(tabs)" />
      {/* หน้าจองคิว (ตั้งเป็นแบบ Modal เด้งขึ้นมา) */}
      <Stack.Screen name="book-queue" options={{ presentation: "modal" }} />
    </Stack>
  );
}
