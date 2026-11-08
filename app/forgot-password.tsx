import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../src/config/firebase";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Platform.OS === "web"
        ? window.alert("กรุณากรอกอีเมล")
        : Alert.alert("แจ้งเตือน", "กรุณากรอกอีเมล");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);

      Platform.OS === "web"
        ? window.alert("ส่งลิงก์สำเร็จ! กรุณาตรวจสอบกล่องข้อความในอีเมลของคุณ")
        : Alert.alert(
            "สำเร็จ",
            "ส่งลิงก์สำเร็จ! กรุณาตรวจสอบกล่องข้อความในอีเมลของคุณ",
          );

      router.back();
    } catch (error: any) {
      console.error("Reset Password Error:", error);
      if (error.code === "auth/user-not-found") {
        Platform.OS === "web"
          ? window.alert("ไม่พบอีเมลนี้ในระบบ")
          : Alert.alert("ผิดพลาด", "ไม่พบอีเมลนี้ในระบบ");
      } else {
        Platform.OS === "web"
          ? window.alert("เกิดข้อผิดพลาด: " + error.code)
          : Alert.alert("ผิดพลาด", error.code);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ marginBottom: 20 }}
      >
        <Ionicons name="arrow-back" size={30} color="#1E293B" />
      </TouchableOpacity>

      <Text style={styles.title}>ลืมรหัสผ่าน</Text>
      <Text style={styles.subtitle}>
        กรุณากรอกอีเมลที่ใช้สมัครสมาชิก เพื่อรับลิงก์รีเซ็ตรหัสผ่าน
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>อีเมล</Text>
        <TextInput
          style={styles.input}
          placeholder="example@gmail.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={styles.btn}
          onPress={handleReset}
          disabled={loading}
        >
          <Text style={styles.btnText}>
            {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E2E8F0",
    padding: 30,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 10,
  },
  subtitle: { fontSize: 16, color: "#64748B", marginBottom: 30 },
  form: {
    backgroundColor: "#FFF",
    padding: 25,
    borderRadius: 15,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#475569",
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: "#F8FAFC",
  },
  btn: {
    backgroundColor: "#3B82F6",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
});
