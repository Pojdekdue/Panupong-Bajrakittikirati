import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../src/config/firebase";

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

  const handleRegister = async () => {
    if (!name || !phoneNumber || !email || !password || !confirmPassword) {
      showAlert(
        "ข้อมูลไม่ครบถ้วน",
        "กรุณากรอกข้อมูลในทุกช่องให้ครบถ้วนเพื่อทำการสมัคร",
        "warning",
      );
      return;
    }

    // 🟢 ใช้ Regex ตรวจสอบเบอร์มือถือไทย (ต้องขึ้นต้นด้วย 06, 08 หรือ 09 และมี 10 หลัก)
    const phoneRegex = /^0[689]\d{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
      showAlert(
        "เบอร์โทรศัพท์ไม่ถูกต้อง",
        "กรุณากรอกเบอร์มือถือให้ถูกต้อง (เช่น 0812345678)",
        "warning",
      );
      return;
    }

    if (password !== confirmPassword) {
      showAlert(
        "รหัสผ่านไม่ตรงกัน",
        "รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง",
        "warning",
      );
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: name,
        phone: phoneNumber,
        email: email,
        role: "customer",
        createdAt: Timestamp.now(),
      });

      showAlert("สำเร็จ", "สมัครสมาชิกสำเร็จ!", "success", () => {
        router.replace("/login");
      });
    } catch (error: any) {
      console.error("Firebase Error:", error);
      let errorMsg = "เกิดข้อผิดพลาดในการสมัคร กรุณาลองใหม่อีกครั้ง";

      if (error.code === "auth/email-already-in-use") {
        errorMsg = "อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น";
      } else if (error.code === "auth/weak-password") {
        errorMsg = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
      } else if (error.code === "auth/invalid-email") {
        errorMsg = "รูปแบบอีเมลไม่ถูกต้อง";
      }

      showAlert("เกิดข้อผิดพลาด", errorMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity
          onPress={() => router.replace("/login")}
          style={{ marginBottom: 20 }}
        >
          <Ionicons name="arrow-back" size={30} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.title}>สมัครสมาชิกใหม่</Text>

        <View style={styles.form}>
          <Text style={styles.label}>ชื่อ-นามสกุล</Text>
          <TextInput
            style={styles.input}
            placeholder="ชื่อของคุณ"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>เบอร์โทรศัพท์</Text>
          <TextInput
            style={styles.input}
            placeholder="08X-XXX-XXXX"
            placeholderTextColor="#94A3B8"
            value={phoneNumber}
            onChangeText={(text) => {
              const numericValue = text.replace(/[^0-9]/g, "");
              setPhoneNumber(numericValue);
            }}
            keyboardType="numeric"
            maxLength={10}
          />

          <Text style={styles.label}>อีเมล</Text>
          <TextInput
            style={styles.input}
            placeholder="example@gmail.com"
            placeholderTextColor="#94A3B8"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>รหัสผ่าน</Text>
          <TextInput
            style={styles.input}
            placeholder="ตั้งรหัสผ่าน 6 ตัวขึ้นไป"
            placeholderTextColor="#94A3B8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text style={styles.label}>ยืนยันรหัสผ่าน</Text>
          <TextInput
            style={styles.input}
            placeholder="กรอกรหัสผ่านอีกครั้ง"
            placeholderTextColor="#94A3B8"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.btn}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.btnText}>
              {loading ? "กำลังสมัคร..." : "ยืนยันการสมัคร"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
    flexGrow: 1,
    backgroundColor: "#E2E8F0",
    padding: 30,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 30,
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
    backgroundColor: "#059669",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
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
