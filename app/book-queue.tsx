import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// 🟢 1. Import AsyncStorage
import AsyncStorage from "@react-native-async-storage/async-storage";

// นำเข้า Firebase
import {
  collection,
  doc,
  getDoc,
  onSnapshot, // ⭐️ นำเข้า onSnapshot
  query,
  runTransaction,
  Timestamp,
} from "firebase/firestore";
// @ts-ignore
import { auth, db } from "../src/config/firebase";

export default function BookQueueScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pax, setPax] = useState(2);
  const [loading, setLoading] = useState(false);

  const [hasActiveQueue, setHasActiveQueue] = useState(false);
  const [checkingQueue, setCheckingQueue] = useState(true);

  // ⭐️ State เก็บเวลารอของแต่ละประเภทโต๊ะ
  const [waitTimes, setWaitTimes] = useState({ S: 0, M: 0, L: 0 });

  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "info",
    isConfirm: false,
    onConfirm: () => {},
    onSuccessRoute: false,
  });

  const closeAlert = () => {
    setCustomAlert((prev) => ({ ...prev, visible: false }));
    if (customAlert.onSuccessRoute) {
      router.replace("/queue");
    }
  };

  const showAlert = (title: string, message: string, type = "error") => {
    setCustomAlert({
      visible: true,
      title,
      message,
      type,
      isConfirm: false,
      onConfirm: () => {},
      onSuccessRoute: type === "success",
    });
  };

  useEffect(() => {
    const checkExistingQueue = async () => {
      try {
        const savedQueueId = await AsyncStorage.getItem("activeQueueId");
        if (savedQueueId) {
          const docRef = doc(db, "queues", savedQueueId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const status = docSnap.data().status;
            if (status === "waiting" || status === "called") {
              setHasActiveQueue(true);
            } else {
              await AsyncStorage.removeItem("activeQueueId");
            }
          } else {
            await AsyncStorage.removeItem("activeQueueId");
          }
        }
      } catch (e) {
        console.log("Error checking queue:", e);
      } finally {
        setCheckingQueue(false);
      }
    };
    checkExistingQueue();
  }, []);

  // ⭐️ ดึงข้อมูลเวลาจาก Firebase แบบ Real-time
  useEffect(() => {
    const q = query(collection(db, "tables"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let availS = 0,
        availM = 0,
        availL = 0;
      let minEndS = Infinity,
        minEndM = Infinity,
        minEndL = Infinity;

      snapshot.forEach((doc) => {
        const table = doc.data();
        const type = table.type;

        if (table.status !== "occupied") {
          // นับจำนวนโต๊ะว่าง
          if (type === "S") availS++;
          if (type === "M") availM++;
          if (type === "L") availL++;
        } else if (table.endTime) {
          // ถ้าไม่ว่าง ให้หาโต๊ะที่จะเสร็จเร็วที่สุด (ใช้เวลาจาก endTime)
          const endTimeMs =
            typeof table.endTime.toDate === "function"
              ? table.endTime.toDate().getTime()
              : table.endTime;

          if (type === "S" && endTimeMs < minEndS) minEndS = endTimeMs;
          if (type === "M" && endTimeMs < minEndM) minEndM = endTimeMs;
          if (type === "L" && endTimeMs < minEndL) minEndL = endTimeMs;
        }
      });

      // ฟังก์ชันคำนวณนาทีที่ต้องรอ
      const calcWait = (avail: number, minEnd: number) => {
        if (avail > 0) return 0; // ถ้ามีโต๊ะว่างเลย = รอ 0 นาที
        if (minEnd === Infinity) return 0;

        const diffMins = Math.ceil((minEnd - Date.now()) / 60000);
        return diffMins > 0 ? diffMins : 1; // ถ้าหมดเวลาแล้วแต่ยังไม่เคลียร์โต๊ะ ให้ขึ้นรอ 1 นาที
      };

      setWaitTimes({
        S: calcWait(availS, minEndS),
        M: calcWait(availM, minEndM),
        L: calcWait(availL, minEndL),
      });
    });

    return () => unsubscribe();
  }, []);

  // ⭐️ ฟังก์ชันจัดการการจองคิวใหม่ (ใช้ Transaction ป้องกันคิวซ้ำ)
  const handleBooking = async () => {
    if (!name.trim()) {
      showAlert("แจ้งเตือน", "กรุณากรอกชื่อของคุณครับ", "warning");
      return;
    }

    setLoading(true);

    try {
      let tableType = "S";
      if (pax >= 3 && pax <= 4) tableType = "M";
      else if (pax >= 5 && pax <= 8) tableType = "L";

      const currentUser = auth.currentUser;
      const counterRef = doc(db, "counters", "queue"); // อ้างอิงเอกสารสำหรับนับเลขคิว

      // เริ่ม Transaction
      const result = await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let nextNumber = 1;

        if (!counterSnap.exists()) {
          // ถ้าเพิ่งรันระบบครั้งแรก ให้สร้างตัวนับเริ่มต้นที่ 1
          transaction.set(counterRef, { lastNumber: 1 });
        } else {
          // ถ้ามีข้อมูลแล้ว ให้อ่านเลขล่าสุดแล้วบวก 1
          nextNumber = counterSnap.data().lastNumber + 1;
          transaction.update(counterRef, { lastNumber: nextNumber });
        }

        // สร้าง ID ใหม่สำหรับคิว
        const newQueueRef = doc(collection(db, "queues"));

        // บันทึกข้อมูลคิวใหม่ลงฐานข้อมูล
        transaction.set(newQueueRef, {
          customerName: name,
          pax: pax,
          tableType: tableType,
          queueNumber: nextNumber,
          source: "Mobile App",
          status: "waiting",
          timestamp: Timestamp.now(),
          updatedAt: Timestamp.now(),
          userId: currentUser?.uid || "guest",
        });

        // ส่งค่ากลับออกมาใช้งานต่อด้านนอก
        return { id: newQueueRef.id, queueNumber: nextNumber };
      });

      // จัดเก็บ ID ไว้ในเครื่อง
      await AsyncStorage.setItem("activeQueueId", result.id);

      setLoading(false);
      showAlert(
        "จองคิวสำเร็จ!",
        `คิวของคุณคือ Q${String(result.queueNumber).padStart(3, "0")} (โต๊ะ ${tableType})`,
        "success",
      );
    } catch (error) {
      console.error(error);
      showAlert(
        "ข้อผิดพลาด",
        "ไม่สามารถจองคิวได้ กรุณาลองใหม่อีกครั้ง",
        "error",
      );
      setLoading(false);
    }
  };

  if (checkingQueue) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#E87A00" />
      </View>
    );
  }

  // คำนวณประเภทโต๊ะและเวลารอตามจำนวนคนที่เลือกปัจจุบัน
  const currentTableType = pax <= 2 ? "S" : pax <= 4 ? "M" : "L";
  const currentWaitTime = waitTimes[currentTableType as keyof typeof waitTimes];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>จองคิวร้านอาหาร</Text>
          <View style={{ width: 24 }} />
        </View>

        {hasActiveQueue ? (
          <View style={styles.activeQueueContainer}>
            <Ionicons
              name="alert-circle"
              size={80}
              color="#F59E0B"
              style={{ marginBottom: 20 }}
            />
            <Text style={styles.activeQueueTitle}>คุณมีคิวที่กำลังรออยู่</Text>
            <Text style={styles.activeQueueDesc}>
              อุปกรณ์นี้มีการจองคิวค้างไว้ในระบบแล้ว
              กรุณารอรับบริการคิวเดิมให้เสร็จสิ้นก่อนทำการจองใหม่ครับ
            </Text>

            <TouchableOpacity
              style={styles.viewQueueBtn}
              onPress={() => router.replace("/queue")}
            >
              <Text style={styles.viewQueueBtnText}>ดูคิวของคุณ</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formContainer}>
            <Text style={styles.label}>ชื่อลูกค้า</Text>
            <TextInput
              style={styles.input}
              placeholder="กรอกชื่อของคุณ"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>จำนวนผู้ใช้บริการ (ท่าน)</Text>
            <View style={styles.paxContainer}>
              <TouchableOpacity
                style={styles.paxBtn}
                onPress={() => setPax((prev) => Math.max(1, prev - 1))}
              >
                <Ionicons name="remove" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.paxNumber}>{pax}</Text>
              <TouchableOpacity
                style={styles.paxBtn}
                onPress={() => setPax((prev) => Math.min(8, prev + 1))}
              >
                <Ionicons name="add" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* ⭐️ กล่องแสดงข้อมูลโต๊ะและเวลารอ */}
            <View style={styles.infoBox}>
              <Ionicons
                name="information-circle"
                size={24}
                color="#3B82F6"
                style={{ marginTop: 2 }}
              />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.infoText}>
                  ระบบจะจัดสรรโต๊ะประเภท{" "}
                  <Text style={{ fontWeight: "bold", color: "#1E293B" }}>
                    {pax <= 2
                      ? "Small (1-2 ท่าน)"
                      : pax <= 4
                        ? "Medium (3-4 ท่าน)"
                        : "Large (5-8 ท่าน)"}
                  </Text>{" "}
                  ให้คุณโดยอัตโนมัติ
                </Text>

                {/* ⭐️ แสดงเวลารอที่ถูกต้อง */}
                {currentWaitTime > 0 ? (
                  <Text
                    style={{
                      color: "#E87A00",
                      marginTop: 6,
                      fontWeight: "bold",
                      fontSize: 14,
                    }}
                  >
                    ⏳ เวลารอโดยประมาณ: {currentWaitTime} นาที (โต๊ะเต็ม)
                  </Text>
                ) : (
                  <Text
                    style={{
                      color: "#10B981",
                      marginTop: 6,
                      fontWeight: "bold",
                      fontSize: 14,
                    }}
                  >
                    ✅ มีโต๊ะว่าง สามารถเข้ารับบริการได้ทันที
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleBooking}
              disabled={loading}
            >
              <Text style={styles.submitBtnText}>
                {loading ? "กำลังดำเนินการ..." : "ยืนยันการจองคิว"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Modal Popup */}
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
  container: { flex: 1, backgroundColor: "#F4F4F5" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 40,
    backgroundColor: "#FFF",
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#1E293B" },
  backBtn: { padding: 5 },
  formContainer: { padding: 20, marginTop: 20 },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#475569",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#FFF",
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: 16,
    marginBottom: 25,
  },
  paxContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
  },
  paxBtn: {
    backgroundColor: "#E87A00",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  paxNumber: {
    fontSize: 30,
    fontWeight: "bold",
    marginHorizontal: 40,
    color: "#1E293B",
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF",
    padding: 15,
    borderRadius: 10,
    marginBottom: 30,
    alignItems: "flex-start",
  },
  infoText: { color: "#3B82F6", fontSize: 14, lineHeight: 22 },
  submitBtn: {
    backgroundColor: "#1E293B",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  submitBtnText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  activeQueueContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
  },
  activeQueueTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 15,
  },
  activeQueueDesc: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 30,
  },
  viewQueueBtn: {
    backgroundColor: "#E87A00",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 30,
  },
  viewQueueBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
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
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
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
