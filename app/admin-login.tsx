import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function AdminLoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // ⭐️ State สำหรับจัดการ Custom Alert Modal
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "error", // "warning" | "error"
  });

  const closeAlert = () => setCustomAlert({ ...customAlert, visible: false });

  const showAlert = (title: string, message: string, type = "error") => {
    setCustomAlert({ visible: true, title, message, type });
  };

  const handleLogin = () => {
    // เช็คว่ากรอกข้อมูลครบไหม
    if (!username.trim() || !password.trim()) {
      showAlert(
        "แจ้งเตือน",
        "กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน",
        "warning",
      );
      return;
    }

    // 🚨 กำหนดรหัสผ่านสำหรับแอดมินไว้ที่นี่ (แก้เป็นรหัสที่คุณต้องการได้เลย) 🚨
    const ADMIN_USERNAME = "admin";
    const ADMIN_PASSWORD = "password1234";

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // 🟢 ถ้ารหัสถูก ให้เด้งไปหน้า Admin Dashboard (app/admin/index.tsx)
      router.replace("/admin");
    } else {
      // ถ้ารหัสผิด ให้โชว์แจ้งเตือน
      showAlert(
        "เข้าสู่ระบบล้มเหลว",
        "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง",
        "error",
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.loginCard}>
        <View style={styles.iconContainer}>
          <Ionicons name="shield-checkmark" size={45} color="#E87A00" />
        </View>
        <Text style={styles.title}>Admin </Text>
        <Text style={styles.subtitle}>ระบบจัดการหลังร้าน (เฉพาะพนักงาน)</Text>

        <View style={styles.inputGroup}>
          <Ionicons
            name="person-outline"
            size={20}
            color="#64748B"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="ชื่อผู้ใช้ (Username)"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color="#64748B"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="รหัสผ่าน (Password)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
          <Text style={styles.loginBtnText}>เข้าสู่ระบบ</Text>
        </TouchableOpacity>
      </View>

      {/* ⭐️ Custom Alert Modal สำหรับแจ้งเตือนตอนรหัสผิด */}
      <Modal transparent visible={customAlert.visible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.alertBox}>
            <View
              style={[
                styles.alertIconBg,
                customAlert.type === "warning"
                  ? { backgroundColor: "#FEF3C7" }
                  : { backgroundColor: "#FEE2E2" },
              ]}
            >
              <Ionicons
                name={
                  customAlert.type === "warning" ? "warning" : "close-circle"
                }
                size={35}
                color={customAlert.type === "warning" ? "#F59E0B" : "#EF4444"}
              />
            </View>

            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            <Text style={styles.alertMessage}>{customAlert.message}</Text>

            <TouchableOpacity style={styles.alertBtnMain} onPress={closeAlert}>
              <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 16 }}>
                ตกลง
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A", // โทนสีมืด ให้ดูต่างจากหน้าลูกค้า
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loginCard: {
    backgroundColor: "#FFF",
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    backgroundColor: "#FFFBEB",
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 5,
  },
  subtitle: { fontSize: 14, color: "#64748B", marginBottom: 30 },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    width: "100%",
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, fontSize: 16, color: "#1E293B" },
  loginBtn: {
    backgroundColor: "#E87A00",
    width: "100%",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  loginBtnText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },

  // สไตล์สำหรับ Custom Alert Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  alertBox: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 25,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  alertIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 10,
    textAlign: "center",
  },
  alertMessage: {
    fontSize: 15,
    color: "#475569",
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 22,
  },
  alertBtnMain: {
    backgroundColor: "#1E293B",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
});
