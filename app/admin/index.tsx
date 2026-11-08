import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  where, // 🟢 เพิ่ม doc
  writeBatch, // 🟢 เพิ่ม writeBatch
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, // 🟢 เพิ่ม Platform
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

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [stats, setStats] = useState({
    totalQueues: 0,
    successQueues: 0,
    avgWaitTime: 0,
    maxWaitTime: 0,
    hourlyStats: [] as {
      hour: string;
      avgWait: number;
      count: number;
      heightRate: number;
    }[],
  });

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const isToday = new Date().toDateString() === selectedDate.toDateString();

  // 🔴 ฟังก์ชันสร้างข้อมูลจำลองย้อนหลัง 7 วัน (สำหรับทดสอบ)
  const handleGenerateMockData = async () => {
    if (Platform.OS === "web") {
      if (!window.confirm("ต้องการสร้างข้อมูลจำลองย้อนหลัง 7 วัน ใช่หรือไม่?"))
        return;
    } else {
      const confirm = await new Promise((resolve) => {
        Alert.alert(
          "ยืนยัน",
          "ต้องการสร้างข้อมูลจำลองย้อนหลัง 7 วัน ใช่หรือไม่?",
          [
            { text: "ยกเลิก", onPress: () => resolve(false), style: "cancel" },
            { text: "ตกลง", onPress: () => resolve(true) },
          ],
        );
      });
      if (!confirm) return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const queuesRef = collection(db, "queues");

      // วนลูปย้อนหลัง 1-7 วัน
      for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - dayOffset);

        // สุ่มจำนวนคิว 20 - 40 คิวต่อวัน
        const numQueues = Math.floor(Math.random() * 21) + 20;

        for (let q = 1; q <= numQueues; q++) {
          const hour = Math.floor(Math.random() * 11) + 10; // 10:00 - 20:00
          const minute = Math.floor(Math.random() * 60);

          const createdTime = new Date(targetDate);
          createdTime.setHours(hour, minute, 0, 0);

          // สุ่มเวลารอ 5 - 45 นาที
          const waitMinutes = Math.floor(Math.random() * 41) + 5;
          const calledTime = new Date(
            createdTime.getTime() + waitMinutes * 60000,
          );

          const status = Math.random() > 0.1 ? "completed" : "cancelled"; // สำเร็จ 90%

          const newDocRef = doc(queuesRef);
          batch.set(newDocRef, {
            queueNumber: `M${q.toString().padStart(3, "0")}`,
            status: status,
            timestamp: Timestamp.fromDate(createdTime),
            calledAt: Timestamp.fromDate(calledTime),
            customerName: `Mock Customer ${dayOffset}-${q}`,
            partySize: Math.floor(Math.random() * 4) + 1,
            type: "A",
          });
        }
      }

      await batch.commit();

      if (Platform.OS === "web") {
        window.alert("สร้างข้อมูลจำลองสำเร็จ 7 วัน!");
      } else {
        Alert.alert("สำเร็จ", "สร้างข้อมูลจำลองสำเร็จ 7 วัน!");
      }

      // รีเฟรชหน้าจอ
      setSelectedDate(new Date(selectedDate));
    } catch (error) {
      console.error("Mock Data Error: ", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchDailyReport = async () => {
      setLoading(true);
      try {
        const startOfDay = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          0,
          0,
          0,
        );
        const endOfDay = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          23,
          59,
          59,
        );

        const q = query(
          collection(db, "queues"),
          where("timestamp", ">=", Timestamp.fromDate(startOfDay)),
          where("timestamp", "<=", Timestamp.fromDate(endOfDay)),
        );

        const snap = await getDocs(q);

        let totalQ = snap.size;
        let successQ = 0;
        let totalWaitMs = 0;
        let maxWait = 0;
        let calledCount = 0;

        const hourMap: Record<number, { totalWait: number; count: number }> =
          {};

        snap.docs.forEach((doc) => {
          const data = doc.data();

          if (data.status === "completed") {
            successQ++;
          }

          const createdTs = data.timestamp?.toDate
            ? data.timestamp.toDate()
            : new Date(data.timestamp);

          if (data.calledAt) {
            const calledTs = data.calledAt?.toDate
              ? data.calledAt.toDate()
              : new Date(data.calledAt);

            const waitMs = calledTs.getTime() - createdTs.getTime();
            const waitMins = Math.max(0, Math.floor(waitMs / 60000));

            totalWaitMs += waitMs;
            calledCount++;

            if (waitMins > maxWait) {
              maxWait = waitMins;
            }

            const hour = createdTs.getHours();
            if (!hourMap[hour]) hourMap[hour] = { totalWait: 0, count: 0 };
            hourMap[hour].totalWait += waitMs;
            hourMap[hour].count++;
          }
        });

        const avgWait =
          calledCount > 0 ? Math.floor(totalWaitMs / calledCount / 60000) : 0;

        let maxHourlyAvg = 0;
        const hourlyArray = Object.keys(hourMap).map((h) => {
          const hNum = parseInt(h);
          const stat = hourMap[hNum];
          const hourlyAvgMins = Math.floor(stat.totalWait / stat.count / 60000);

          if (hourlyAvgMins > maxHourlyAvg) maxHourlyAvg = hourlyAvgMins;

          return {
            hour: `${hNum.toString().padStart(2, "0")}:00 - ${(hNum + 1).toString().padStart(2, "0")}:00`,
            avgWait: hourlyAvgMins,
            count: stat.count,
            heightRate: 0,
          };
        });

        hourlyArray.forEach((item) => {
          item.heightRate =
            maxHourlyAvg > 0 ? (item.avgWait / maxHourlyAvg) * 100 : 0;
        });

        setStats({
          totalQueues: totalQ,
          successQueues: successQ,
          avgWaitTime: avgWait,
          maxWaitTime: maxWait,
          hourlyStats: hourlyArray.sort((a, b) => a.hour.localeCompare(b.hour)),
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDailyReport();
  }, [selectedDate]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 30 }}
    >
      <View style={styles.headerContainer}>
        <View>
          <Text style={styles.pageTitle}>รายงานประจำวัน (Daily Report)</Text>
          <Text style={styles.pageSubtitle}>
            ข้อมูลสรุปและวิเคราะห์การดำเนินงาน
          </Text>

          {/* 🔴 ปุ่มชั่วคราวสำหรับสร้างข้อมูลจำลอง (ลบออกเมื่อทดสอบเสร็จ) */}
          <TouchableOpacity
            onPress={handleGenerateMockData}
            style={{
              marginTop: 10,
              backgroundColor: "#E2E8F0",
              padding: 8,
              borderRadius: 8,
              alignSelf: "flex-start",
            }}
          >
            <Text
              style={{ fontSize: 12, color: "#475569", fontWeight: "bold" }}
            >
              +
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dateNavigator}>
          <TouchableOpacity
            style={styles.dateBtn}
            onPress={() => changeDate(-1)}
          >
            <Ionicons name="chevron-back" size={20} color="#475569" />
          </TouchableOpacity>

          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>

          <TouchableOpacity
            style={[styles.dateBtn, isToday && { opacity: 0.3 }]}
            onPress={() => !isToday && changeDate(1)}
            disabled={isToday}
          >
            <Ionicons name="chevron-forward" size={20} color="#475569" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ padding: 50, alignItems: "center" }}>
          <ActivityIndicator size="large" color="#E87A00" />
          <Text style={{ marginTop: 15, color: "#64748B" }}>
            กำลังโหลดข้อมูลของวันที่เลือก...
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { borderTopColor: "#3B82F6" }]}>
              <View style={[styles.iconBox, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="people" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.cardLabel}>จำนวนคิวทั้งหมด</Text>
              <Text style={styles.cardValue}>
                {stats.totalQueues} <Text style={styles.unitText}>คิว</Text>
              </Text>
            </View>

            <View style={[styles.summaryCard, { borderTopColor: "#10B981" }]}>
              <View style={[styles.iconBox, { backgroundColor: "#D1FAE5" }]}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              </View>
              <Text style={styles.cardLabel}>รับบริการสำเร็จ</Text>
              <Text style={styles.cardValue}>
                {stats.successQueues} <Text style={styles.unitText}>คิว</Text>
              </Text>
            </View>

            <View style={[styles.summaryCard, { borderTopColor: "#F59E0B" }]}>
              <View style={[styles.iconBox, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="time" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.cardLabel}>เวลารอคิวเฉลี่ย</Text>
              <Text style={styles.cardValue}>
                {stats.avgWaitTime}{" "}
                <Text style={styles.unitText}>นาที / คิว</Text>
              </Text>
            </View>

            <View style={[styles.summaryCard, { borderTopColor: "#EF4444" }]}>
              <View style={[styles.iconBox, { backgroundColor: "#FEE2E2" }]}>
                <Ionicons name="warning" size={24} color="#EF4444" />
              </View>
              <Text style={styles.cardLabel}>เวลารอคิวสูงสุด</Text>
              <Text style={styles.cardValue}>
                {stats.maxWaitTime} <Text style={styles.unitText}>นาที</Text>
              </Text>
            </View>
          </View>

          <View style={styles.chartPanel}>
            <View style={styles.chartHeader}>
              <Ionicons
                name="bar-chart"
                size={20}
                color="#1E293B"
                style={{ marginRight: 10 }}
              />
              <Text style={styles.chartTitle}>
                วิเคราะห์ช่วงเวลาหนาแน่น (เวลารอเฉลี่ยรายชั่วโมง)
              </Text>
            </View>
            <Text style={styles.chartDesc}>
              ใช้เพื่อวิเคราะห์ว่าช่วงเวลาใดที่ลูกค้าต้องรอนานที่สุด
              เพื่อเตรียมพร้อมพนักงาน
            </Text>

            {stats.hourlyStats.length === 0 ? (
              <View style={styles.emptyChart}>
                <Text style={{ color: "#94A3B8" }}>
                  ไม่มีข้อมูลการเรียกคิวสำหรับวันที่เลือก
                </Text>
              </View>
            ) : (
              <View style={styles.hourlyList}>
                {stats.hourlyStats.map((item, index) => (
                  <View key={index} style={styles.hourlyItem}>
                    <Text style={styles.hourText}>{item.hour}</Text>

                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.max(item.heightRate, 5)}%`,
                            backgroundColor:
                              item.heightRate > 80
                                ? "#EF4444"
                                : item.heightRate > 50
                                  ? "#F59E0B"
                                  : "#10B981",
                          },
                        ]}
                      />
                    </View>

                    <Text style={styles.hourlyWaitText}>
                      {item.avgWait} นาที
                    </Text>
                    <Text style={styles.hourlyCountText}>
                      ({item.count} คิว)
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30,
    flexWrap: "wrap",
    gap: 15,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 5,
  },
  pageSubtitle: { fontSize: 14, color: "#64748B" },

  dateNavigator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dateBtn: {
    padding: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
    marginHorizontal: 15,
    minWidth: 120,
    textAlign: "center",
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
    flexWrap: "wrap",
    marginBottom: 30,
  },
  summaryCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: "#FFF",
    padding: 25,
    borderRadius: 16,
    borderTopWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#64748B",
    marginBottom: 5,
  },
  cardValue: { fontSize: 32, fontWeight: "bold", color: "#1E293B" },
  unitText: { fontSize: 16, fontWeight: "normal", color: "#94A3B8" },

  chartPanel: {
    backgroundColor: "#FFF",
    padding: 30,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 30,
  },
  chartHeader: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  chartTitle: { fontSize: 18, fontWeight: "bold", color: "#1E293B" },
  chartDesc: { fontSize: 14, color: "#64748B", marginBottom: 25 },

  emptyChart: {
    padding: 40,
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
  },

  hourlyList: { gap: 15 },
  hourlyItem: { flexDirection: "row", alignItems: "center" },
  hourText: { width: 110, fontSize: 14, fontWeight: "bold", color: "#475569" },
  barTrack: {
    flex: 1,
    height: 12,
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    marginHorizontal: 15,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 6 },
  hourlyWaitText: {
    width: 60,
    fontSize: 14,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "right",
  },
  hourlyCountText: {
    width: 60,
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "right",
  },
});
