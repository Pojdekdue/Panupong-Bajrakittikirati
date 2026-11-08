import { Ionicons } from "@expo/vector-icons"; // 🟢 เพิ่ม Import สำหรับไอคอน
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { auth, db } from "../src/config/firebase";

export default function LoginScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ⭐️ State สำหรับจัดการ Custom Alert Modal
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "error", // "warning" | "error" | "success"
    onConfirm: () => {},
  });

  const closeAlert = () => {
    setCustomAlert((prev) => ({ ...prev, visible: false }));
    if (customAlert.onConfirm) {
      customAlert.onConfirm();
    }
  };

  const showAlert = (
    title: string,
    message: string,
    type = "error",
    onConfirm = () => {},
  ) => {
    setCustomAlert({ visible: true, title, message, type, onConfirm });
  };

  const handleLogin = async () => {
    if (!phoneNumber || !password) {
      // 🟢 เรียกใช้ showAlert แทน
      showAlert("แจ้งเตือน", "กรุณากรอกข้อมูลให้ครบถ้วน", "warning");
      return;
    }

    setLoading(true);
    try {
      // 1. นำเบอร์โทรไปค้นหาในฐานข้อมูล ว่าตรงกับอีเมลอะไร
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("phone", "==", phoneNumber));
      const querySnapshot = await getDocs(q);

      // ถ้าหาเบอร์ไม่เจอในระบบ
      if (querySnapshot.empty) {
        // 🟢 เรียกใช้ showAlert แทน
        showAlert("ผิดพลาด", "ไม่พบเบอร์โทรศัพท์นี้ในระบบ", "error");
        setLoading(false);
        return;
      }

      // 2. ถ้าเจอเบอร์ ให้ดึงข้อมูลอีเมลและ Role ออกมา
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      const userEmail = userData.email;

      // 3. ใช้ "อีเมล" ที่หาเจอ นำไปเข้าสู่ระบบกับ Firebase Auth
      await signInWithEmailAndPassword(auth, userEmail, password);

      // 4. ตรวจสอบ Role เพื่อเด้งไปหน้าแอดมินหรือหน้าลูกค้า
      if (userData.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/"); // เปลี่ยนไปหน้าจองคิวของลูกค้า
      }
    } catch (error) {
      console.error("Login Error:", error);
      // 🟢 เรียกใช้ showAlert แทน
      showAlert(
        "เข้าสู่ระบบล้มเหลว",
        "รหัสผ่านไม่ถูกต้อง หรือเกิดข้อผิดพลาด",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>เข้าสู่ระบบ</Text>

      <View style={styles.form}>
        <Text style={styles.label}>เบอร์โทรศัพท์</Text>
        <TextInput
          style={styles.input}
          placeholder="08X-XXX-XXXX"
          placeholderTextColor="#94A3B8"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          maxLength={10}
        />

        <Text style={styles.label}>รหัสผ่าน</Text>
        <TextInput
          style={styles.input}
          placeholder="รหัสผ่านของคุณ"
          placeholderTextColor="#94A3B8"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.btn}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.btnText}>
            {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/register")}
          style={{ marginTop: 20, alignItems: "center" }}
        >
          <Text style={{ color: "#059669", fontWeight: "bold", fontSize: 16 }}>
            สร้างบัญชีใหม่
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/forgot-password")}
          style={{ marginTop: 15, alignItems: "center" }}
        >
          <Text style={{ color: "#64748B" }}>ลืมรหัสผ่าน?</Text>
        </TouchableOpacity>
      </View>

      {/* ⭐️ Custom Alert Modal */}
      <Modal transparent visible={customAlert.visible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.alertBox}>
            <View
              style={[
                styles.alertIconBg,
                customAlert.type === "warning" && {
                  backgroundColor: "#FEF3C7",
                },
                customAlert.type === "error" && { backgroundColor: "#FEE2E2" },
                customAlert.type === "success" && {
                  backgroundColor: "#D1FAE5",
                },
              ]}
            >
              <Ionicons
                name={
                  customAlert.type === "warning"
                    ? "warning"
                    : customAlert.type === "success"
                      ? "checkmark-circle"
                      : "close-circle"
                }
                size={35}
                color={
                  customAlert.type === "warning"
                    ? "#F59E0B"
                    : customAlert.type === "success"
                      ? "#10B981"
                      : "#EF4444"
                }
              />
            </View>

            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            <Text style={styles.alertMessage}>{customAlert.message}</Text>

            <TouchableOpacity style={styles.alertBtnMain} onPress={closeAlert}>
              <Text style={styles.alertBtnText}>ตกลง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    fontSize: 32,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 30,
    textAlign: "center",
  },
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
    color: "#1E293B",
  },
  btn: {
    backgroundColor: "#1E293B",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },

  // ⭐️ สไตล์สำหรับ Custom Alert Modal
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
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
  alertBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
  },
});
