import { Ionicons } from "@expo/vector-icons";
import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// @ts-ignore
import { db } from "../../src/config/firebase";

export default function ManageQueueScreen() {
  const [waitingQueues, setWaitingQueues] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const skippingRef = useRef(new Set());

  // ⭐️ State สำหรับจัดการ Custom Alert Modal
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

  // ⭐️ ฟังก์ชันเรียกใช้ Popup (แทนที่ window.confirm เดิม)
  const confirmAction = (message: string, onConfirm: () => void) => {
    setCustomAlert({
      visible: true,
      title: "ยืนยันการทำรายการ",
      message: message,
      type: "warning",
      isConfirm: true,
      onConfirm: () => {
        onConfirm();
        closeAlert();
      },
    });
  };

  useEffect(() => {
    // 🟢 ดึงข้อมูลคิวทั้งหมดที่เรียงตามหมายเลขคิว
    const queueQuery = query(
      collection(db, "queues"),
      orderBy("queueNumber", "asc"),
    );
    const unsubscribe = onSnapshot(queueQuery, (snapshot) => {
      const queuesData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setWaitingQueues(
        queuesData.filter(
          (q: any) => q.status === "waiting" || q.status === "called",
        ),
      );
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);

      const TIME_LIMIT_MS = 1 * 60 * 1000; // 10 นาที หมดเวลาข้ามคิว

      waitingQueues.forEach((q) => {
        if (q.status === "called" && q.calledAt) {
          const calledTimeMs =
            typeof q.calledAt.toDate === "function"
              ? q.calledAt.toDate().getTime()
              : q.calledAt;

          if (
            now - calledTimeMs >= TIME_LIMIT_MS &&
            !skippingRef.current.has(q.id)
          ) {
            skippingRef.current.add(q.id);

            updateDoc(doc(db, "queues", q.id), { status: "skipped" })
              .then(() => {
                skippingRef.current.delete(q.id);
                console.log(`Auto skipped queue: ${q.id}`);
              })
              .catch((err) => {
                console.error(err);
                skippingRef.current.delete(q.id);
              });
          }
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [waitingQueues]);

  const handleDemoMode = async () => {
    confirmAction(
      "จัดฉากโต๊ะ 20 ตัว (S, M, L) ตามขอบเขตงานใช่หรือไม่?",
      async () => {
        try {
          const batch = writeBatch(db);
          const customTimes = [
            40, 70, 20, 30, 50, 15, 80, 25, 60, 35, 45, 10, 55, 20, 65, 30, 85,
            25, 15, 50,
          ];
          for (let i = 1; i <= 20; i++) {
            const tableRef = doc(db, "tables", `T${i}`);
            const newEndTime = new Date(
              Date.now() + customTimes[i - 1] * 60000,
            );
            let type = "S";
            let cap = 2;
            if (i > 10 && i <= 17) {
              type = "M";
              cap = 4;
            } else if (i > 17) {
              type = "L";
              cap = 8;
            }
            batch.set(tableRef, {
              tableNumber: `T${i}`,
              type: type,
              capacity: cap,
              status: "occupied",
              endTime: Timestamp.fromDate(newEndTime),
            });
          }
          await batch.commit();

          // โชว์แจ้งเตือนเมื่อจัดฉากสำเร็จ
          setCustomAlert({
            visible: true,
            title: "สำเร็จ",
            message: "จัดฉากโต๊ะ 20 โต๊ะเรียบร้อย!",
            type: "success",
            isConfirm: false,
            onConfirm: () => {},
          });
        } catch (error) {
          console.error(error);
        }
      },
    );
  };

  const handleNotifyQueue = async (queueId: string) => {
    confirmAction(
      "ส่งการแจ้งเตือนใกล้ถึงคิวไปยังลูกค้ารายนี้หรือไม่?",
      async () =>
        await updateDoc(doc(db, "queues", queueId), { isNotified: true }),
    );
  };

  const handleCallQueue = async (queueId: string) => {
    confirmAction(
      "เรียกคิวนี้ใช่ไหม? (ระบบจะเริ่มจับเวลา 10 นาที)",
      async () => {
        await updateDoc(doc(db, "queues", queueId), {
          status: "called",
          calledAt: Timestamp.now(),
        });
      },
    );
  };

  const handleCompleteQueue = async (queueId: string) => {
    confirmAction(
      "ลูกค้ารับโต๊ะเรียบร้อยแล้วใช่หรือไม่?",
      async () =>
        await updateDoc(doc(db, "queues", queueId), { status: "completed" }),
    );
  };

  const handleCancelQueue = async (queueId: string) =>
    confirmAction(
      "คุณต้องการยกเลิกคิวนี้ใช่หรือไม่?",
      async () =>
        await updateDoc(doc(db, "queues", queueId), { status: "cancelled" }),
    );

  const formatCountdown = (calledAt: any) => {
    if (!calledAt) return "10:00";
    const calledTimeMs =
      typeof calledAt.toDate === "function"
        ? calledAt.toDate().getTime()
        : calledAt;
    const TIME_LIMIT_MS = 1 * 60 * 1000;
    const timeLeftMs = Math.max(0, calledTimeMs + TIME_LIMIT_MS - currentTime);

    const totalSec = Math.floor(timeLeftMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={{ paddingBottom: 50 }}
      >
        <View style={styles.cardPanel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>รายการคิวปัจจุบัน</Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: "#8B5CF6" }]}
              onPress={handleDemoMode}
            >
              <Ionicons name="star" size={16} color="#FFF" />
              <Text
                style={{ color: "#FFF", fontWeight: "bold", marginLeft: 5 }}
              ></Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 1 }]}>คิว</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>ลูกค้า</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>
              ท่าน(ไซส์)
            </Text>
            <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>
              สถานะ
            </Text>
            <Text style={[styles.th, { flex: 3.5, textAlign: "center" }]}>
              จัดการ
            </Text>
          </View>

          {waitingQueues.length === 0 ? (
            <Text
              style={{ textAlign: "center", padding: 30, color: "#94A3B8" }}
            >
              ไม่มีคิวในขณะนี้
            </Text>
          ) : (
            waitingQueues.map((q: any) => (
              <View key={q.id} style={styles.tr}>
                {/* แสดงเลขคิวให้ตรงกับฝั่งลูกค้า */}
                <Text
                  style={[
                    styles.td,
                    { flex: 1, fontWeight: "bold", color: "#E87A00" },
                  ]}
                >
                  Q{String(q.queueNumber || "").padStart(3, "0")}
                </Text>

                <Text
                  style={[
                    styles.td,
                    { flex: 1.5, fontWeight: "bold", color: "#1E293B" },
                  ]}
                >
                  {q.customerName || q.phone}
                </Text>
                <Text style={[styles.td, { flex: 1, textAlign: "center" }]}>
                  {q.pax} (โต๊ะ {q.tableType})
                </Text>

                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text
                    style={[
                      styles.td,
                      {
                        color: q.status === "called" ? "#8B5CF6" : "#EF4444",
                        fontWeight: q.status === "called" ? "bold" : "normal",
                        textAlign: "center",
                      },
                    ]}
                  >
                    {q.status === "called" ? "เรียกแล้ว" : "รอโต๊ะ"}
                  </Text>
                  {q.status === "called" && (
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#EF4444",
                        fontWeight: "bold",
                        marginTop: 2,
                      }}
                    >
                      ⏱️ {formatCountdown(q.calledAt)}
                    </Text>
                  )}
                </View>

                <View
                  style={{
                    flex: 3.5,
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 5,
                    flexWrap: "wrap",
                  }}
                >
                  {q.status === "waiting" && (
                    <>
                      <TouchableOpacity
                        style={styles.actionBtnNotify}
                        onPress={() => handleNotifyQueue(q.id)}
                      >
                        <Text style={{ color: "#FFF", fontSize: 12 }}>
                          เตือน
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionBtnCall}
                        onPress={() => handleCallQueue(q.id)}
                      >
                        <Text style={{ color: "#FFF", fontSize: 12 }}>
                          เรียก
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionBtnCancel}
                        onPress={() => handleCancelQueue(q.id)}
                      >
                        <Text style={{ color: "#EF4444", fontSize: 12 }}>
                          ยกเลิก
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {q.status === "called" && (
                    <>
                      <TouchableOpacity
                        style={styles.actionBtnComplete}
                        onPress={() => handleCompleteQueue(q.id)}
                      >
                        <Text
                          style={{
                            color: "#FFF",
                            fontSize: 12,
                            fontWeight: "bold",
                          }}
                        >
                          ✅ รับโต๊ะแล้ว
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ⭐️ Custom Alert Modal สำหรับแอดมิน */}
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
  contentScroll: { padding: 30, backgroundColor: "#F8FAFC" },
  cardPanel: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 25,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  panelTitle: { fontSize: 18, fontWeight: "bold", color: "#1E293B" },
  addBtn: {
    flexDirection: "row",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    paddingBottom: 10,
    marginBottom: 10,
  },
  th: { color: "#64748B", fontSize: 14, fontWeight: "bold" },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  td: { fontSize: 14 },
  actionBtnNotify: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionBtnCall: {
    backgroundColor: "#E87A00",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionBtnComplete: {
    backgroundColor: "#10B981",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionBtnCancel: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  // ⭐️ สไตล์สำหรับ Custom Modal
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
