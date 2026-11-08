import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// นำเข้า Firebase Auth และ Firestore
import {
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
// @ts-ignore
import { db } from "../../src/config/firebase";

export default function ProfileScreen() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ⭐️ State สำหรับจัดการ Modal
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "info",
    isConfirm: false,
    onConfirm: () => {},
  });

  // ⭐️ State สำหรับ Modal เปลี่ยนรหัสผ่าน
  const [changePwdModal, setChangePwdModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  const closeAlert = () =>
    setCustomAlert((prev) => ({ ...prev, visible: false }));
  const showAlert = (
    title: string,
    message: string,
    type = "info",
    isConfirm = false,
    onConfirm = () => {},
  ) => {
    setCustomAlert({
      visible: true,
      title,
      message,
      type,
      isConfirm,
      onConfirm,
    });
  };

  // 1. ดึงข้อมูลผู้ใช้งานจาก Firebase
  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          } else {
            // ถ้าไม่มีใน Firestore ให้ใช้ข้อมูลจาก Auth แทน
            setUserData({
              name: user.displayName || "ผู้ใช้งาน",
              phone: user.email,
            });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUserData({
            name: user.email?.split("@")[0] || "ผู้ใช้งาน",
            phone: user.email,
          });
        }
      }
      setLoading(false);
    };
    fetchUserData();
  }, [user]);

  // 2. ฟังก์ชันออกจากระบบ (ลูกค้า)
  const handleLogout = () => {
    showAlert(
      "ยืนยันการออกจากระบบ",
      "คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบบัญชีนี้?",
      "warning",
      true,
      async () => {
        closeAlert();
        try {
          await AsyncStorage.removeItem("activeQueueId"); // เคลียร์คิว
          await signOut(auth);

          // 🟢 ใช้เทคนิคเคลียร์ Stack ทั้งหมดเพื่อป้องกันการกดย้อนกลับมาหน้าเดิม
          setTimeout(() => {
            if (router.canDismiss()) {
              router.dismissAll();
            }
            router.replace("/login"); // เด้งไปไฟล์ app/login.tsx
          }, 300);
        } catch (error) {
          showAlert("ข้อผิดพลาด", "ไม่สามารถออกจากระบบได้", "error");
        }
      },
    );
  };

  // 3. ฟังก์ชันเปลี่ยนรหัสผ่าน
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showAlert("แจ้งเตือน", "กรุณากรอกข้อมูลให้ครบทุกช่อง", "warning");
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert("แจ้งเตือน", "รหัสผ่านใหม่ไม่ตรงกัน", "warning");
      return;
    }
    if (newPassword.length < 6) {
      showAlert(
        "แจ้งเตือน",
        "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร",
        "warning",
      );
      return;
    }

    setPwdLoading(true);
    try {
      // ต้อง Re-authenticate ด้วยรหัสเดิมก่อนถึงจะยอมให้เปลี่ยนรหัสใหม่
      if (user && user.email) {
        const credential = EmailAuthProvider.credential(
          user.email,
          currentPassword,
        );
        await reauthenticateWithCredential(user, credential);

        // ยืนยันสำเร็จ ทำการเปลี่ยนรหัสผ่านใหม่
        await updatePassword(user, newPassword);

        setChangePwdModal(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");

        showAlert(
          "สำเร็จ",
          "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว ในการเข้าสู่ระบบครั้งหน้าโปรดใช้รหัสผ่านใหม่",
          "success",
        );
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === "auth/wrong-password") {
        showAlert("ข้อผิดพลาด", "รหัสผ่านปัจจุบันไม่ถูกต้อง", "error");
      } else {
        showAlert(
          "ข้อผิดพลาด",
          "ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง",
          "error",
        );
      }
    } finally {
      setPwdLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#E87A00" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 50 }}
      >
        {/* ส่วนหัวโปรไฟล์ */}
        <View style={styles.profileHeader}>
          <Text style={styles.headerTitle}>โปรไฟล์ของฉัน</Text>

          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={50} color="#94A3B8" />
          </View>

          <Text style={styles.userName}>
            {userData?.name || userData?.customerName || "กำลังโหลด..."}
          </Text>
          <Text style={styles.userPhone}>
            {userData?.phone || "ไม่มีเบอร์โทรศัพท์"}
          </Text>
        </View>

        {/* ส่วนเมนูการตั้งค่า */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>ตั้งค่าและความปลอดภัย</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setChangePwdModal(true)}
          >
            <Ionicons
              name="lock-closed"
              size={20}
              color="#64748B"
              style={styles.menuIcon}
            />
            <Text style={styles.menuText}>เปลี่ยนรหัสผ่าน</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <Ionicons
              name="log-out"
              size={20}
              color="#EF4444"
              style={styles.menuIcon}
            />
            <Text
              style={[
                styles.menuText,
                { color: "#EF4444", fontWeight: "bold" },
              ]}
            >
              ออกจากระบบ
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>Version 2.0.4</Text>
      </ScrollView>

      {/* ⭐️ 1. Modal เปลี่ยนรหัสผ่าน */}
      <Modal transparent visible={changePwdModal} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>เปลี่ยนรหัสผ่าน</Text>
              <TouchableOpacity onPress={() => setChangePwdModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>รหัสผ่านปัจจุบัน</Text>
            <TextInput
              style={styles.input}
              placeholder="กรอกรหัสผ่านปัจจุบันของคุณ"
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <Text style={styles.inputLabel}>รหัสผ่านใหม่</Text>
            <TextInput
              style={styles.input}
              placeholder="กรอกรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <Text style={styles.inputLabel}>ยืนยันรหัสผ่านใหม่</Text>
            <TextInput
              style={styles.input}
              placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <TouchableOpacity
              style={[styles.submitPwdBtn, pwdLoading && { opacity: 0.7 }]}
              onPress={handleChangePassword}
              disabled={pwdLoading}
            >
              {pwdLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitPwdText}>บันทึกรหัสผ่านใหม่</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ⭐️ 2. Custom Alert Modal (สำหรับแจ้งเตือนและยืนยันล็อกเอาต์) */}
      <Modal transparent visible={customAlert.visible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.alertBox}>
            <View
              style={[
                styles.alertIconBg,
                customAlert.type === "success"
                  ? { backgroundColor: "#D1FAE5" }
                  : customAlert.type === "warning"
                    ? { backgroundColor: "#FEF3C7" }
                    : customAlert.type === "error"
                      ? { backgroundColor: "#FEE2E2" }
                      : { backgroundColor: "#DBEAFE" },
              ]}
            >
              <Ionicons
                name={
                  customAlert.type === "success"
                    ? "checkmark-circle"
                    : customAlert.type === "warning"
                      ? "warning"
                      : customAlert.type === "error"
                        ? "close-circle"
                        : "information-circle"
                }
                size={35}
                color={
                  customAlert.type === "success"
                    ? "#10B981"
                    : customAlert.type === "warning"
                      ? "#F59E0B"
                      : customAlert.type === "error"
                        ? "#EF4444"
                        : "#3B82F6"
                }
              />
            </View>

            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            <Text style={styles.alertMessage}>{customAlert.message}</Text>

            <View style={styles.btnRow}>
              {customAlert.isConfirm ? (
                <>
                  <TouchableOpacity
                    style={styles.alertBtnCancel}
                    onPress={closeAlert}
                  >
                    <Text style={{ color: "#64748B", fontWeight: "bold" }}>
                      ยกเลิก
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.alertBtnMain,
                      { backgroundColor: "#EF4444" },
                    ]}
                    onPress={customAlert.onConfirm}
                  >
                    <Text style={{ color: "#FFF", fontWeight: "bold" }}>
                      ยืนยัน
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.alertBtnMain, { backgroundColor: "#1E293B" }]}
                  onPress={closeAlert}
                >
                  <Text
                    style={{ color: "#FFF", fontWeight: "bold", fontSize: 16 }}
                  >
                    ตกลง
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  profileHeader: {
    backgroundColor: "#FFF",
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1E293B",
    position: "absolute",
    top: Platform.OS === "web" ? 30 : 60,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
    marginBottom: 20,
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 5,
  },
  userPhone: { fontSize: 16, color: "#64748B" },

  settingsSection: { padding: 20, marginTop: 10 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#94A3B8",
    marginBottom: 15,
    marginLeft: 5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 18,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  menuIcon: { marginRight: 15 },
  menuText: { flex: 1, fontSize: 16, color: "#1E293B", fontWeight: "500" },
  versionText: {
    textAlign: "center",
    color: "#CBD5E1",
    marginTop: 30,
    fontSize: 14,
  },

  // ⭐️ Styles สำหรับ Modal เปลี่ยนรหัสผ่าน (Bottom Sheet สไตล์)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  bottomSheet: {
    backgroundColor: "#FFF",
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    padding: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  sheetTitle: { fontSize: 20, fontWeight: "bold", color: "#1E293B" },
  inputLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#475569",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  submitPwdBtn: {
    backgroundColor: "#1E293B",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  submitPwdText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },

  // ⭐️ Styles สำหรับ Custom Alert Modal
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
  btnRow: { flexDirection: "row", width: "100%", gap: 12 },
  alertBtnMain: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  alertBtnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#F1F5F9",
  },
});
