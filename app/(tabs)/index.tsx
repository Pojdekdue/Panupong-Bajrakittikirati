import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// นำเข้า Firebase
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../src/config/firebase";

export default function HomeScreen() {
  const router = useRouter();
  const [waitingCount, setWaitingCount] = useState(0);
  const [availableTables, setAvailableTables] = useState(0);
  const [totalTables, setTotalTables] = useState(20); // จำนวนโต๊ะทั้งหมดตามที่คุยไว้
  const [estimatedWait, setEstimatedWait] = useState(0);
  const [isQueueOpen, setIsQueueOpen] = useState(true);

  // 1. ดึงสถานะเปิด/ปิดร้านจากแอดมิน
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "store"), (docSnap) => {
      if (docSnap.exists()) {
        setIsQueueOpen(docSnap.data().isQueueOpen);
      }
    });
    return () => unsub();
  }, []);

  // 2. ดึงจำนวนคิวที่กำลังรอ (waiting)
  useEffect(() => {
    const qQueue = query(
      collection(db, "queues"),
      where("status", "==", "waiting"),
    );
    const unsubQueue = onSnapshot(qQueue, (snap) => {
      setWaitingCount(snap.size);
    });
    return () => unsubQueue();
  }, []);

  // 3. ดึงข้อมูลโต๊ะจาก Firebase
  useEffect(() => {
    const qTable = query(collection(db, "tables"));
    const unsubTable = onSnapshot(qTable, (snap) => {
      if (!snap.empty) {
        const tablesData = snap.docs.map((doc) => doc.data());
        const emptyCount = tablesData.filter(
          (t) => t.status === "available",
        ).length;
        setAvailableTables(emptyCount);
        setTotalTables(tablesData.length);
      } else {
        // หากยังไม่ได้เพิ่มข้อมูลโต๊ะใน Firebase ให้ใช้ค่าจำลองเพื่อการพรีเซนต์ไปก่อน
        setAvailableTables(0); // สมมติว่าโต๊ะเต็ม
        setTotalTables(20); // จำนวน 20 โต๊ะ
      }
    });
    return () => unsubTable();
  }, []);

  // 4. คำนวณเวลารอคิวใหม่ ทุกครั้งที่คิว หรือ โต๊ะ มีการเปลี่ยนแปลง
  useEffect(() => {
    if (availableTables > 0) {
      // ถ้ามีโต๊ะว่าง ไม่ต้องรอ
      setEstimatedWait(0);
    } else {
      // สูตรคำนวณเวลารอ: (จำนวนคิวที่รอ * เวลาทานต่อโต๊ะ) / จำนวนโต๊ะทั้งหมด
      // กำหนดให้เวลาทานเฉลี่ย = 90 นาที
      const calculatedTime = Math.ceil((waitingCount * 90) / totalTables);

      // ถ้าโต๊ะเต็มแต่ยังไม่มีคิวรอ (เราเป็นคิวแรก) ให้ประเมินขั้นต่ำไว้ 5 นาที
      setEstimatedWait(waitingCount === 0 ? 5 : calculatedTime);
    }
  }, [waitingCount, availableTables, totalTables]);

  const handleBooking = () => {
    if (!isQueueOpen) {
      if (Platform.OS === "web") {
        window.alert("ขออภัยค่ะ ขณะนี้ร้านปิดรับคิวแล้ว");
      } else {
        Alert.alert("แจ้งเตือน", "ขออภัยค่ะ ขณะนี้ร้านปิดรับคิวแล้ว");
      }
      return;
    }
    router.push("/book-queue");
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="restaurant" size={40} color="#1E293B" />
        <Text style={styles.restaurantName}>ร้านอาหารภาณุพงศ์</Text>
        <Text style={styles.restaurantSub}>PANUPONG RESTAURANT</Text>
      </View>

      {/* Promo Card */}
      <View style={styles.promoHeader}>
        <Text style={styles.sectionTitle}>โปรโมชั่นพิเศษ</Text>
        <Text style={styles.seeAll}>ดูทั้งหมด</Text>
      </View>
      <View style={styles.promoCard}>
        <Text style={styles.promoLabel}>NEW ARRIVAL</Text>
        <Text style={styles.promoTitle}>
          ต้อนรับสมาชิกใหม่{"\n"}รับส่วนลดทันที 10%
        </Text>
        <TouchableOpacity style={styles.promoButton}>
          <Text style={styles.promoButtonText}>รับสิทธิ์เลย</Text>
        </TouchableOpacity>
      </View>

      {/* Queue Card */}
      <View style={styles.queueCard}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: isQueueOpen ? "#D1FAE5" : "#FEE2E2" },
          ]}
        >
          <Ionicons
            name={isQueueOpen ? "checkmark-circle" : "close-circle"}
            size={14}
            color={isQueueOpen ? "#059669" : "#EF4444"}
          />
          <Text
            style={[
              styles.statusText,
              { color: isQueueOpen ? "#059669" : "#EF4444" },
            ]}
          >
            {isQueueOpen ? " เปิดรับคิว" : " ปิดรับคิว"}
          </Text>
        </View>

        <Text style={styles.queueTitle}>คิวปัจจุบันหน้าร้าน</Text>

        <Text style={styles.queueNumber}>{waitingCount}</Text>

        <Text style={styles.estimatedTime}>
          เวลารอโดยประมาณ{" "}
          {!isQueueOpen ? (
            <Text style={{ color: "#EF4444", fontWeight: "bold" }}>
              ไม่สามารถประเมินได้ (ร้านปิดรับคิว)
            </Text>
          ) : availableTables > 0 ? (
            <Text style={styles.orangeText}>
              ไม่ต้องรอคิว (มีโต๊ะว่าง {availableTables} โต๊ะ)
            </Text>
          ) : (
            <Text style={{ color: "#EF4444", fontWeight: "bold" }}>
              รอประมาณ {estimatedWait} นาที (โต๊ะเต็ม)
            </Text>
          )}
        </Text>

        <TouchableOpacity
          style={[
            styles.bookButton,
            !isQueueOpen && { backgroundColor: "#94A3B8" },
          ]}
          onPress={handleBooking}
          disabled={!isQueueOpen}
        >
          <Text style={styles.bookButtonText}>
            {isQueueOpen ? "จองคิวเลย" : "ปิดรับคิว"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F5", padding: 20 },
  header: { alignItems: "center", marginTop: 40, marginBottom: 30 },
  restaurantName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0F172A",
    marginTop: 10,
  },
  restaurantSub: { fontSize: 12, color: "#94A3B8", letterSpacing: 1 },
  promoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "bold" },
  seeAll: { color: "#E87A00", fontSize: 14 },
  promoCard: {
    backgroundColor: "#E87A00",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  promoLabel: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 5,
  },
  promoTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },
  promoButton: {
    backgroundColor: "#FFF",
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  promoButtonText: { color: "#E87A00", fontWeight: "bold" },
  queueCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  statusBadge: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    alignSelf: "flex-end",
  },
  statusText: { fontSize: 12, fontWeight: "bold" },
  queueTitle: { fontSize: 16, color: "#475569", marginTop: 10 },
  queueNumber: { fontSize: 80, fontWeight: "bold", color: "#1E293B" },
  estimatedTime: { color: "#94A3B8", marginBottom: 20 },
  orangeText: { color: "#E87A00", fontWeight: "bold" },
  bookButton: {
    backgroundColor: "#E87A00",
    width: "100%",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  bookButtonText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
});
