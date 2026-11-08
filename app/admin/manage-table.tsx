import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch, // <-- เพิ่ม writeBatch
} from "firebase/firestore";
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
// @ts-ignore
import { db } from "../../src/config/firebase";

export default function ManageTableScreen() {
  const [tables, setTables] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const tableQuery = query(
      collection(db, "tables"),
      orderBy("tableNumber", "asc"),
    );
    const unsubscribe = onSnapshot(tableQuery, (snapshot) => {
      const tablesData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      tablesData.sort((a: any, b: any) => {
        const numA =
          parseInt(String(a.tableNumber || "0").replace(/\D/g, "")) || 0;
        const numB =
          parseInt(String(b.tableNumber || "0").replace(/\D/g, "")) || 0;
        return numA - numB;
      });
      setTables(tablesData);
    });
    return () => unsubscribe();
  }, []);

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

  const handleStartEating = async (tableId: string) => {
    confirmAction("เริ่มจับเวลา 90 นาที?", async () => {
      const newEndTime = new Date(Date.now() + 90 * 60000);
      await updateDoc(doc(db, "tables", tableId), {
        status: "occupied",
        endTime: Timestamp.fromDate(newEndTime),
      });
    });
  };

  const handleClearTable = async (tableId: string) => {
    confirmAction("ลูกค้าเช็คบิล?", async () => {
      await updateDoc(doc(db, "tables", tableId), {
        status: "available",
        endTime: Timestamp.now(),
      });
    });
  };

  // ฟังก์ชันสำหรับเคลียร์โต๊ะทั้งหมด
  const handleClearAllTables = async () => {
    // เช็คก่อนว่ามีโต๊ะที่กำลังใช้งานอยู่หรือไม่
    const occupiedTables = tables.filter((t) => t.status === "occupied");
    if (occupiedTables.length === 0) {
      if (Platform.OS === "web") {
        window.alert("ไม่มีโต๊ะที่กำลังใช้งานอยู่");
      } else {
        Alert.alert("แจ้งเตือน", "ไม่มีโต๊ะที่กำลังใช้งานอยู่");
      }
      return;
    }

    confirmAction("ยืนยันเคลียร์โต๊ะทั้งหมด (เช็คบิลทุกโต๊ะ)?", async () => {
      try {
        const batch = writeBatch(db);

        // อัปเดตเฉพาะโต๊ะที่ไม่ว่าง
        occupiedTables.forEach((table) => {
          const tableRef = doc(db, "tables", table.id);
          batch.update(tableRef, {
            status: "available",
            endTime: Timestamp.now(),
          });
        });

        await batch.commit();
      } catch (error) {
        console.error("Error clearing all tables: ", error);
      }
    });
  };

  return (
    <ScrollView
      style={styles.contentScroll}
      contentContainerStyle={{ paddingBottom: 50 }}
    >
      <View style={styles.cardPanel}>
        {/* เปลี่ยน View ตรงนี้เพื่อให้มีปุ่มด้านขวาของหัวข้อ */}
        <View style={styles.headerContainer}>
          <Text style={styles.panelTitle}>
            🪑 สถานะโต๊ะทั้งหมด ({tables.length} โต๊ะ)
          </Text>
          <TouchableOpacity
            style={styles.clearAllBtn}
            onPress={handleClearAllTables}
          >
            <Text style={{ color: "#EF4444", fontWeight: "bold" }}>
              เคลียร์โต๊ะทั้งหมด
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tableGridContainer}>
          {tables.map((table: any) => {
            const isOccupied = table.status === "occupied";
            let minsLeft = 0;
            if (isOccupied && table.endTime) {
              const endMs =
                typeof table.endTime.toDate === "function"
                  ? table.endTime.toDate().getTime()
                  : table.endTime;
              minsLeft = Math.max(0, Math.ceil((endMs - currentTime) / 60000));
            }
            return (
              <View key={table.id} style={styles.tableGridCard}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 20, fontWeight: "bold" }}>
                      {table.tableNumber}
                    </Text>
                    <Text
                      style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}
                    >
                      Type {table.type} ({table.capacity} ท่าน)
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: isOccupied ? "#EF4444" : "#059669",
                      fontWeight: "bold",
                    }}
                  >
                    {isOccupied ? `เหลือ ${minsLeft} นาที` : "ว่าง"}
                  </Text>
                </View>
                {isOccupied ? (
                  <TouchableOpacity
                    style={styles.clearTableBtn}
                    onPress={() => handleClearTable(table.id)}
                  >
                    <Text style={{ color: "#EF4444", textAlign: "center" }}>
                      เคลียร์โต๊ะ
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.startTableBtn}
                    onPress={() => handleStartEating(table.id)}
                  >
                    <Text style={{ color: "#FFF", textAlign: "center" }}>
                      เริ่มทาน
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contentScroll: { padding: 30 },
  cardPanel: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 25,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E293B",
  },
  clearAllBtn: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  tableGridContainer: { flexDirection: "row", flexWrap: "wrap", gap: 15 },
  tableGridCard: {
    width: "31%",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 15,
    backgroundColor: "#FAFAFA",
  },
  startTableBtn: {
    backgroundColor: "#E87A00",
    padding: 10,
    borderRadius: 8,
    marginTop: 15,
  },
  clearTableBtn: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EF4444",
    padding: 10,
    borderRadius: 8,
    marginTop: 15,
  },
});
