// ไฟล์: app/admin/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import { Slot, usePathname, useRouter } from "expo-router";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// @ts-ignore
import { db } from "../../src/config/firebase";

export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(true);

  const confirmAction = (message: string, onConfirm: () => void) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(message)) onConfirm();
    } else {
      Alert.alert("ยืนยัน", message, [
        { text: "ยกเลิก", style: "cancel" },
        { text: "ตกลง", onPress: onConfirm },
      ]);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "store"), (docSnap) => {
      if (docSnap.exists()) {
        setIsQueueOpen(docSnap.data().isQueueOpen);
      } else {
        setDoc(doc(db, "settings", "store"), { isQueueOpen: true });
      }
    });
    return () => unsub();
  }, []);

  const toggleQueueStatus = async () => {
    confirmAction(
      `ต้องการ ${isQueueOpen ? "ปิด" : "เปิด"} รับคิวใช่หรือไม่?`,
      async () => {
        await setDoc(
          doc(db, "settings", "store"),
          { isQueueOpen: !isQueueOpen },
          { merge: true },
        );
      },
    );
  };

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarHeader}>
          <Ionicons name="restaurant" size={24} color="#1E293B" />
          <Text style={styles.sidebarTitle}>ร้านภาณุพงศ์</Text>
        </View>
        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={[
              styles.menuItem,
              pathname === "/admin" && styles.menuItemActive,
            ]}
            onPress={() => router.push("/admin")}
          >
            <Ionicons
              name="pie-chart"
              size={20}
              color={pathname === "/admin" ? "#E87A00" : "#64748B"}
            />
            <Text
              style={[
                styles.menuText,
                pathname === "/admin" && styles.menuTextActive,
              ]}
            >
              สรุปรายงาน
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.menuItem,
              pathname === "/admin/manage-queue" && styles.menuItemActive,
            ]}
            onPress={() => router.push("/admin/manage-queue")}
          >
            <Ionicons
              name="list"
              size={20}
              color={pathname === "/admin/manage-queue" ? "#E87A00" : "#64748B"}
            />
            <Text
              style={[
                styles.menuText,
                pathname === "/admin/manage-queue" && styles.menuTextActive,
              ]}
            >
              จัดการคิว
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.menuItem,
              pathname === "/admin/manage-table" && styles.menuItemActive,
            ]}
            onPress={() => router.push("/admin/manage-table")}
          >
            <Ionicons
              name="grid"
              size={20}
              color={pathname === "/admin/manage-table" ? "#E87A00" : "#64748B"}
            />
            <Text
              style={[
                styles.menuText,
                pathname === "/admin/manage-table" && styles.menuTextActive,
              ]}
            >
              จัดการโต๊ะ
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            confirmAction("ต้องการออกจากระบบผู้ดูแลระบบใช่หรือไม่?", () => {
              if (router.canDismiss()) {
                router.dismissAll();
              }
              // 🟢 เด้งกลับไปหน้า Admin Login ที่อยู่ข้างนอก
              router.replace("/admin-login");
            });
          }}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>ออกจากระบบ</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <View style={styles.topHeader}>
          <Text style={styles.topHeaderTitle}>
            {pathname === "/admin/manage-queue"
              ? "ระบบจัดการคิว"
              : pathname === "/admin/manage-table"
                ? "จัดการโต๊ะ"
                : "ภาพรวมร้านอาหาร"}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 15 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              <Ionicons
                name="ellipse"
                size={12}
                color={isQueueOpen ? "#059669" : "#EF4444"}
              />
              <Text
                style={{
                  fontWeight: "bold",
                  color: isQueueOpen ? "#059669" : "#EF4444",
                }}
              >
                {isQueueOpen ? "เปิดรับคิว" : "ปิดรับคิว"}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                { backgroundColor: isQueueOpen ? "#EF4444" : "#059669" },
              ]}
              onPress={toggleQueueStatus}
            >
              <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 12 }}>
                {isQueueOpen ? "ปิดรับคิวร้าน" : "เปิดรับคิวร้าน"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Slot />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: "row", backgroundColor: "#F4F7F6" },
  sidebar: {
    width: 250,
    backgroundColor: "#FFF",
    borderRightWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 20,
    justifyContent: "space-between",
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E293B",
    marginLeft: 10,
  },
  menuContainer: { flex: 1, paddingHorizontal: 15 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 10,
    marginBottom: 5,
  },
  menuItemActive: { backgroundColor: "#FFF7ED" },
  menuText: {
    fontSize: 16,
    color: "#64748B",
    marginLeft: 15,
    fontWeight: "500",
  },
  menuTextActive: { color: "#E87A00", fontWeight: "bold" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
  },
  logoutText: { color: "#EF4444", fontWeight: "bold", marginLeft: 10 },
  mainContent: { flex: 1 },
  topHeader: {
    backgroundColor: "#FFF",
    paddingHorizontal: 30,
    paddingVertical: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  topHeaderTitle: { fontSize: 20, fontWeight: "bold", color: "#1E293B" },
  toggleBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
});
