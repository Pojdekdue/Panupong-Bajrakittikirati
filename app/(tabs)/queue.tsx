import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
// @ts-ignore
import { auth, db } from "../../src/config/firebase";

// @ts-ignore
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function QueueScreen() {
  const [queueData, setQueueData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [queuesAhead, setQueuesAhead] = useState<number>(0);
  const [tables, setTables] = useState<any[]>([]);
  const [waitMinutes, setWaitMinutes] = useState<number>(0);

  const prevNotified = useRef(false);
  const prevStatus = useRef("");

  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "info",
    isConfirm: false,
    onConfirm: () => {},
  });

  const closeAlert = () =>
    setCustomAlert((prev) => ({ ...prev, visible: false }));

  useEffect(() => {
    async function requestPermissions() {
      if (Platform.OS !== "web") {
        const { status: existingStatus } =
          await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") {
          console.log("Failed to get push token for push notification!");
          return;
        }
      }
    }
    requestPermissions();
  }, []);

  const triggerNotification = async (
    title: string,
    body: string,
    type: string = "info",
  ) => {
    setCustomAlert({
      visible: true,
      title: title,
      message: body,
      type: type,
      isConfirm: false,
      onConfirm: () => {},
    });

    if (Platform.OS !== "web") {
      await Notifications.scheduleNotificationAsync({
        content: { title: title, body: body, sound: true },
        trigger: null,
      });
    }
  };

  // ⭐️ 1. ดึงข้อมูลคิวของตัวเอง
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const myQueueQuery = query(
      collection(db, "queues"),
      where("userId", "==", currentUser.uid),
    );

    const unsubscribeQueue = onSnapshot(myQueueQuery, (snapshot) => {
      if (!snapshot.empty) {
        const allMyQueues = snapshot.docs.map((d: any) => ({
          id: d.id,
          ...d.data(),
        }));
        allMyQueues.sort((a: any, b: any) => b.queueNumber - a.queueNumber);
        const myData: any = allMyQueues[0];
        setQueueData(myData);
      } else {
        setQueueData(null);
      }
      setLoading(false);
    });

    return () => unsubscribeQueue();
  }, []);

  // ⭐️ 2. ฟังข้อมูลคิวที่รอก่อนหน้า และข้อมูลโต๊ะ แบบ Real-time
  useEffect(() => {
    if (!queueData || queueData.status !== "waiting") {
      setQueuesAhead(0);
      return;
    }

    const myTableType = queueData.tableType || "S";
    const myQueueNumber = queueData.queueNumber;

    // 2.1 ดึงคิวทั้งหมดที่กำลังรอ (waiting) เฉพาะประเภทโต๊ะเดียวกัน
    const aheadQuery = query(
      collection(db, "queues"),
      where("status", "==", "waiting"),
      where("tableType", "==", myTableType),
    );

    const unsubscribeAhead = onSnapshot(aheadQuery, (snapshot) => {
      // นับเฉพาะคิวที่มี queueNumber น้อยกว่าคิวของตัวเอง
      const countAhead = snapshot.docs.filter((d: any) => {
        const data = d.data();
        return data.queueNumber < myQueueNumber;
      }).length;
      setQueuesAhead(countAhead);
    });

    // 2.2 ดึงข้อมูลโต๊ะทั้งหมด
    const tableQuery = query(collection(db, "tables"));
    const unsubscribeTables = onSnapshot(tableQuery, (snapshot) => {
      const tablesData = snapshot.docs.map((d: any) => d.data());
      setTables(tablesData);
    });

    return () => {
      unsubscribeAhead();
      unsubscribeTables();
    };
  }, [queueData]);

  // ⭐️ 3. คำนวณเวลาแบบ Real-time ตามคิวที่เหลือและสถานะโต๊ะล่าสุด (ใช้ตรรกะเดิมที่ถูกต้อง)
  useEffect(() => {
    const calculateTime = () => {
      if (tables.length === 0 || !queueData || queueData.status !== "waiting") {
        setWaitMinutes(0);
        return;
      }

      const myTableType = queueData.tableType || "S";
      // กรองเฉพาะโต๊ะที่เป็นประเภทเดียวกับคิว
      const matchingTables = tables.filter((t: any) => t.type === myTableType);

      if (matchingTables.length === 0) return;

      // 1. เรียงลำดับโต๊ะตามเวลาที่จะว่าง (โต๊ะว่างให้อยู่คิวแรกสุด ตามด้วยโต๊ะที่เวลาเหลือน้อยสุด)
      const sortedTables = matchingTables.sort((a: any, b: any) => {
        const timeA =
          a.status !== "occupied"
            ? 0
            : typeof a.endTime?.toDate === "function"
              ? a.endTime.toDate().getTime()
              : a.endTime || Infinity;
        const timeB =
          b.status !== "occupied"
            ? 0
            : typeof b.endTime?.toDate === "function"
              ? b.endTime.toDate().getTime()
              : b.endTime || Infinity;
        return timeA - timeB;
      });

      // 2. จับคู่คิวกับโต๊ะเป้าหมาย (คิว 0 ได้โต๊ะ 0, คิว 1 ได้โต๊ะ 1...)
      const TIME_LIMIT_MS = 90 * 60 * 1000;
      const round = Math.floor(queuesAhead / sortedTables.length);
      const tableIndex = queuesAhead % sortedTables.length;
      const targetTable = sortedTables[tableIndex];

      if (!targetTable) return;

      // 3. คำนวณเวลาที่ต้องรอ
      let estimatedTimeMs = Date.now();
      if (targetTable.status === "occupied" && targetTable.endTime) {
        // กรณีเป้าหมายคือโต๊ะที่มีคนนั่ง
        const endTimeMs =
          typeof targetTable.endTime.toDate === "function"
            ? targetTable.endTime.toDate().getTime()
            : targetTable.endTime;
        estimatedTimeMs = endTimeMs + round * TIME_LIMIT_MS;
      } else {
        // กรณีเป้าหมายคือโต๊ะว่าง (บวกเวลาตามรอบ)
        estimatedTimeMs = Date.now() + round * TIME_LIMIT_MS;
      }

      const timeDiffMs = estimatedTimeMs - Date.now();
      const minutesLeft = Math.max(0, Math.ceil(timeDiffMs / 60000));

      setWaitMinutes(minutesLeft);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 60000); // ให้คำนวณใหม่ทุกๆ 1 นาที
    return () => clearInterval(interval);
  }, [tables, queuesAhead, queueData]);

  useEffect(() => {
    if (!queueData) return;

    if (
      queueData.isNotified &&
      !prevNotified.current &&
      queueData.status === "waiting"
    ) {
      triggerNotification(
        "เตรียมตัว! ใกล้ถึงคิวของคุณแล้ว",
        `อีก ${queuesAhead} คิวจะถึงคิวท่าน กรุณาเตรียมตัวบริเวณหน้าร้านครับ`,
        "warning",
      );
      prevNotified.current = true;
    }

    if (queueData.status === "called" && prevStatus.current !== "called") {
      triggerNotification(
        "ถึงคิวของคุณแล้ว!",
        "กรุณาติดต่อพนักงานเพื่อรับโต๊ะภายใน 10 นาที มิฉะนั้นระบบจะทำการข้ามคิวของท่าน",
        "success",
      );
    }

    if (
      queueData.status === "skipped" &&
      prevStatus.current !== "skipped" &&
      prevStatus.current !== ""
    ) {
      triggerNotification(
        "คิวของคุณถูกข้าม",
        "ระบบได้ทำการข้ามคิวของคุณ เนื่องจากคุณไม่ได้มาแสดงตัวเพื่อรับโต๊ะภายในเวลาที่กำหนดครับ",
        "error",
      );
    }

    if (
      queueData.status === "cancelled" &&
      prevStatus.current !== "cancelled" &&
      prevStatus.current !== ""
    ) {
      triggerNotification(
        "คิวของคุณถูกยกเลิก",
        "คิวของคุณถูกยกเลิกเรียบร้อยแล้ว หากต้องการใช้บริการกรุณาจองคิวใหม่อีกครั้งครับ",
        "error",
      );
    }

    prevStatus.current = queueData.status;
  }, [queueData, queuesAhead]);

  const handleCancelMyQueue = () => {
    if (!queueData?.id) return;
    setCustomAlert({
      visible: true,
      title: "ยืนยันการยกเลิก",
      message: "คุณแน่ใจหรือไม่ว่าต้องการยกเลิกคิวนี้?",
      type: "error",
      isConfirm: true,
      onConfirm: async () => {
        closeAlert();
        await updateDoc(doc(db, "queues", queueData.id), {
          status: "cancelled",
        });
      },
    });
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
      <ScrollView style={styles.container}>
        <Text style={styles.headerTitle}>รายละเอียดคิวของคุณ</Text>

        <View style={styles.ticketCard}>
          <Ionicons
            name="restaurant"
            size={50}
            color="#1E293B"
            style={{ alignSelf: "center", marginTop: 20 }}
          />
          <Text style={styles.restaurantName}>ร้านอาหารภาณุพงศ์</Text>
          <Text style={styles.branch}>สาขาหลัก</Text>

          {queueData ? (
            <>
              <View style={styles.queueInfo}>
                <Text style={styles.queueLabel}>หมายเลขคิวของคุณ</Text>
                <Text style={styles.queueNumber}>
                  Q{String(queueData.queueNumber || "").padStart(3, "0")}
                </Text>

                <Text
                  style={{
                    fontSize: 16,
                    color: "#1E293B",
                    fontWeight: "bold",
                    marginBottom: 15,
                  }}
                >
                  จำนวน: {queueData.pax} ท่าน (โต๊ะไซส์ {queueData.tableType})
                </Text>

                <View
                  style={[
                    styles.statusBadge,
                    queueData.status === "called" && {
                      backgroundColor: "#FEF3C7",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      queueData.status === "called"
                        ? { color: "#D97706" }
                        : queueData.status === "completed"
                          ? { color: "#2563EB" }
                          : queueData.status === "cancelled" ||
                              queueData.status === "skipped"
                            ? { color: "#EF4444" }
                            : {},
                    ]}
                  >
                    สถานะ:{" "}
                    {queueData.status === "waiting"
                      ? "กำลังรอเรียกคิว"
                      : queueData.status === "called"
                        ? "ถึงคิวของคุณแล้ว (รอรับโต๊ะ)"
                        : queueData.status === "completed"
                          ? "รับโต๊ะเรียบร้อยแล้ว"
                          : queueData.status === "cancelled"
                            ? "ยกเลิกคิวแล้ว"
                            : queueData.status === "skipped"
                              ? "ถูกข้ามคิว (ไม่มาแสดงตัว)"
                              : queueData.status}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {queueData.status === "waiting" && (
                <View
                  style={[
                    styles.waitBox,
                    queueData.isNotified && {
                      borderColor: "#3B82F6",
                      borderWidth: 2,
                      backgroundColor: "#EFF6FF",
                    },
                  ]}
                >
                  {queueData.isNotified && (
                    <Text
                      style={{
                        color: "#2563EB",
                        fontWeight: "bold",
                        fontSize: 16,
                        marginBottom: 10,
                      }}
                    >
                      🔔 เตรียมตัว! ใกล้ถึงคิวของคุณแล้ว
                    </Text>
                  )}
                  <Text style={styles.waitLabel}>
                    มีคิว(ไซส์เดียวกัน)ก่อนหน้าคุณ
                  </Text>
                  <Text style={styles.waitNumber}>
                    {queuesAhead} <Text style={styles.waitUnit}>คิว</Text>
                  </Text>
                  <Text style={styles.estimatedTime}>
                    🕒 รอประมาณ {waitMinutes} นาที
                  </Text>
                </View>
              )}

              {queueData.status === "called" && (
                <View
                  style={[
                    styles.waitBox,
                    {
                      backgroundColor: "#FFFBEB",
                      borderColor: "#F59E0B",
                      borderWidth: 2,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: "#E87A00",
                      fontSize: 18,
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    📢 ถึงคิวของคุณแล้ว!
                  </Text>
                  <Text
                    style={{
                      color: "#B45309",
                      fontSize: 14,
                      textAlign: "center",
                      marginTop: 8,
                    }}
                  >
                    กรุณาติดต่อพนักงานเพื่อรับโต๊ะภายใน 10 นาที{"\n"}
                    มิฉะนั้นระบบจะทำการข้ามคิวของท่าน
                  </Text>
                </View>
              )}

              {queueData.status === "waiting" && (
                <TouchableOpacity
                  style={{ marginTop: 20, padding: 15, alignItems: "center" }}
                  onPress={handleCancelMyQueue}
                >
                  <Text
                    style={{
                      color: "#EF4444",
                      fontWeight: "bold",
                      fontSize: 16,
                    }}
                  >
                    ❌ ยกเลิกคิว
                  </Text>
                </TouchableOpacity>
              )}

              {queueData.status === "completed" && (
                <View style={[styles.waitBox, { backgroundColor: "#EFF6FF" }]}>
                  <Text
                    style={{
                      color: "#2563EB",
                      fontSize: 18,
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    ได้โต๊ะแล้ว! ขอให้อร่อยกับมื้อนี้นะครับ 🍽️
                  </Text>
                </View>
              )}

              {(queueData.status === "cancelled" ||
                queueData.status === "skipped") && (
                <View style={[styles.waitBox, { backgroundColor: "#FEF2F2" }]}>
                  <Text
                    style={{
                      color: "#EF4444",
                      fontSize: 16,
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    {queueData.status === "skipped"
                      ? "คิวของคุณถูกข้ามเนื่องจากไม่ได้มาแสดงตัวภายใน 10 นาที"
                      : "คุณได้ยกเลิกคิวนี้เรียบร้อยแล้ว"}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Text style={{ color: "#94A3B8" }}>ยังไม่มีข้อมูลการจองคิว</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ⭐️ 6. UI ของ Popup Modal สวยๆ ⭐️ */}
      <Modal transparent visible={customAlert.visible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.alertBox}>
            {/* ไอคอนตามประเภท */}
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
                  style={[styles.alertBtnMain, { backgroundColor: "#E87A00" }]}
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
  container: { flex: 1, backgroundColor: "#1E293B" },
  headerTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 30,
  },
  ticketCard: {
    backgroundColor: "#FFFDF9",
    marginHorizontal: 20,
    borderRadius: 20,
    paddingBottom: 30,
  },
  restaurantName: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    color: "#1E293B",
    marginTop: 10,
  },
  branch: { fontSize: 14, color: "#94A3B8", textAlign: "center" },
  queueInfo: { alignItems: "center", marginTop: 20 },
  queueLabel: { fontSize: 14, color: "#475569" },
  queueNumber: {
    fontSize: 80,
    fontWeight: "bold",
    color: "#E87A00",
    marginVertical: 10,
  },
  statusBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: { color: "#059669", fontWeight: "bold" },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 20,
    borderStyle: "dashed",
  },
  waitBox: {
    backgroundColor: "#F8FAFC",
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
  },
  waitLabel: { color: "#64748B", marginBottom: 5 },
  waitNumber: { fontSize: 24, fontWeight: "bold", color: "#1E293B" },
  waitUnit: { fontSize: 16, fontWeight: "normal", color: "#94A3B8" },
  estimatedTime: {
    color: "#E87A00",
    marginTop: 10,
    fontWeight: "bold",
    fontSize: 16,
  },
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
  btnRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
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
