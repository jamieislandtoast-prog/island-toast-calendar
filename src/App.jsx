import React, { useEffect, useMemo, useRef, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

// ===== Firebase 設定（沿用你的）=====
const firebaseConfig = {
  apiKey: "AIzaSyBiP8A8PrlZd31AdbcF_BPVRz6Q4OymDEc",
  authDomain: "island-toast-app.firebaseapp.com",
  projectId: "island-toast-app",
  storageBucket: "island-toast-app.firebasestorage.app",
  messagingSenderId: "426992761060",
  appId: "1:426992761060:web:4cf940fedbc1fa2a3cd4f1",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ISLAND_APP_ID = "island-toast-live";
const FIXED_LINE_ID = "@516mdfqz";
const LINE_URL = `https://line.me/R/ti/p/${FIXED_LINE_ID}`;

// ===== Firestore Paths（保持你原本邏輯）=====
const PATHS = {
  eventsCol: () =>
    collection(db, "artifacts", ISLAND_APP_ID, "public", "data", "events"),
  settingsDoc: () =>
    doc(db, "artifacts", ISLAND_APP_ID, "public", "data", "settings", "general"),
  menuNewsCol: () =>
    collection(db, "artifacts", ISLAND_APP_ID, "public", "data", "menuNews"),
};

// ===== 圖片壓縮 base64（保留）=====
const compressImage = (file, maxWidth = 1400, quality = 0.82) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;

        if (w > maxWidth) {
          h = (maxWidth / w) * h;
          w = maxWidth;
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [viewMode, setViewMode] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  const [events, setEvents] = useState({});

  const [appSettings, setAppSettings] = useState({
    title: "島嶼生吐司",
    subtitle: "ISLAND TOAST\n來自大海氣息的蓬鬆柔軟",
    marquee: "🍞 每日口味限量，歡迎透過 LINE 提前預約！",
    logoUrl:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300",
  });

  const [menuNews, setMenuNews] = useState([]);
  const menuNewsInputRef = useRef(null);
  const logoInputRef = useRef(null);

  const [isUploading, setIsUploading] = useState(false);

  // 行程彈窗
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingEvent, setEditingEvent] = useState({
    location: "",
    address: "",
    time: "",
    note: "",
    type: "work",
  });

  // 點圖放大（Lightbox）
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState({ url: "", title: "" });

  // 進站：判斷 admin + 登入
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsAdmin(params.get("admin") === "1");

    // 為了減少「首次進站卡一下」，等瀏覽器先畫出畫面再登入
    const runLogin = () => {
      signInAnonymously(auth).catch((err) => {
        console.error(err);
        alert("Firebase 匿名登入失敗，請檢查網路或 Firebase 設定。");
      });
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(runLogin, { timeout: 1500 });
    } else {
      setTimeout(runLogin, 200);
    }

    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  // 同步 events
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(PATHS.eventsCol(), (snap) => {
      const data = {};
      snap.forEach((d) => (data[d.id] = d.data()));
      setEvents(data);
    });
    return () => unsub();
  }, [user]);

  // 同步 settings
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(PATHS.settingsDoc(), (snap) => {
      if (snap.exists()) setAppSettings((prev) => ({ ...prev, ...snap.data() }));
    });
    return () => unsub();
  }, [user]);

  // 同步 MENU & NEWS（最多 5）
  useEffect(() => {
    if (!user) return;
    const q = query(PATHS.menuNewsCol(), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = [];
      snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
      setMenuNews(data);
    });
    return () => unsub();
  }, [user]);

  // 點擊文字編輯（標題/副標題/跑馬燈）
  const editSettingField = async (field, label) => {
    if (!isAdmin) return;
    const current = appSettings?.[field] ? String(appSettings[field]) : "";
    const next = window.prompt(`編輯${label}`, current);
    if (next === null) return;

    setIsUploading(true);
    try {
      await setDoc(PATHS.settingsDoc(), { [field]: next }, { merge: true });
    } catch (err) {
      console.error(err);
      alert("更新失敗：請檢查 Firestore Rules 是否允許匿名寫入。");
    } finally {
      setIsUploading(false);
    }
  };

  // 點擊 Logo 更換
  const onPickLogo = () => {
    if (!isAdmin) return;
    logoInputRef.current?.click();
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const base64 = await compressImage(file, 500, 0.82);
      await setDoc(PATHS.settingsDoc(), { logoUrl: base64 }, { merge: true });
    } catch (err) {
      console.error(err);
      alert("Logo 上傳失敗：請檢查圖片大小/網路/Firestore Rules。");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  // MENU & NEWS 上傳（最多 5）
  const onPickMenuNews = () => {
    if (!isAdmin) return;
    menuNewsInputRef.current?.click();
  };

  const handleMenuNewsUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remain = Math.max(0, 5 - (menuNews?.length || 0));
    if (remain <= 0) {
      alert("MENU & NEWS 最多 5 張，請先刪除再上傳。");
      e.target.value = "";
      return;
    }

    const toUpload = files.slice(0, remain);
    setIsUploading(true);

    try {
      for (const file of toUpload) {
        const base64 = await compressImage(file, 1400, 0.82);
        await addDoc(PATHS.menuNewsCol(), {
          url: base64,
          title: (file.name || "menu-news").split(".")[0],
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error(err);
      alert("MENU & NEWS 上傳失敗：請檢查圖片大小/網路/Firestore Rules。");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const deleteMenuNews = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm("確定要刪除這張圖片嗎？")) return;

    setIsUploading(true);
    try {
      await deleteDoc(doc(PATHS.menuNewsCol(), id));
    } catch (err) {
      console.error(err);
      alert("刪除失敗：請檢查 Firestore Rules。");
    } finally {
      setIsUploading(false);
    }
  };

  // 日期工具
  const formatDateKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;

  const getWeekNumber = (date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  const changeMonth = (offset) => {
    const d = new Date(currentDate);
    d.setMonth(currentDate.getMonth() + offset);
    setCurrentDate(d);
  };

  const changeWeek = (offset) => {
    const d = new Date(currentDate);
    d.setDate(currentDate.getDate() + offset * 7);
    setCurrentDate(d);
  };

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const renderMonthCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const firstDayWeekday = firstDayOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = firstDayWeekday + daysInMonth;
    const totalRows = Math.ceil(totalCells / 7);

    const rows = [];
    for (let r = 0; r < totalRows; r++) {
      const cells = [];
      const rowFirstDay = new Date(year, month, r * 7 - firstDayWeekday + 1);

      // week cell
      cells.push(
        <div
          key={`w-${r}`}
          className="flex items-center justify-center bg-gray-50/50 border-r border-gray-100 text-[9px] font-black text-gray-400"
        >
          W{getWeekNumber(rowFirstDay)}
        </div>
      );

      for (let c = 0; c < 7; c++) {
        const cellIdx = r * 7 + c;
        const dayNum = cellIdx - firstDayWeekday + 1;

        if (dayNum > 0 && dayNum <= daysInMonth) {
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(
            dayNum
          ).padStart(2, "0")}`;
          const ev = events[dateKey];
          const isToday =
            new Date().toDateString() === new Date(year, month, dayNum).toDateString();

          cells.push(
            <div
              key={dateKey}
              onClick={() => {
                setSelectedDate(dateKey);
                setEditingEvent(
                  ev || { location: "", address: "", time: "", note: "", type: "work" }
                );
                setIsModalOpen(true);
              }}
              className="h-16 border-t border-r border-gray-100 p-1 cursor-pointer hover:bg-orange-50 transition-colors relative"
            >
              <span
                className={`text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                  isToday ? "bg-orange-500 text-white" : "text-gray-400"
                }`}
              >
                {dayNum}
              </span>

              {ev && (
                <div
                  className={`mt-1 text-[8px] p-0.5 rounded-sm truncate font-bold border-l-2 ${
                    ev.type === "work"
                      ? "bg-orange-100 text-orange-700 border-orange-500"
                      : "bg-gray-100 text-gray-400 border-gray-300"
                  }`}
                >
                  {ev.type === "rest" ? "休" : ev.location}
                </div>
              )}
            </div>
          );
        } else {
          cells.push(
            <div
              key={`e-${cellIdx}`}
              className="h-16 border-t border-r border-gray-100 bg-gray-50/20"
            />
          );
        }
      }

      rows.push(
        <div key={`r-${r}`} className="calendar-grid">
          {cells}
        </div>
      );
    }

    return rows;
  };

  const renderWeekView = () => {
    const weekLabel = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
    return (
      <div className="p-4 space-y-3">
        {weekDays.map((date, i) => {
          const dateKey = formatDateKey(date);
          const ev = events[dateKey];
          const isToday = new Date().toDateString() === date.toDateString();

          return (
            <div
              key={dateKey}
              onClick={() => {
                setSelectedDate(dateKey);
                setEditingEvent(
                  ev || { location: "", address: "", time: "", note: "", type: "work" }
                );
                setIsModalOpen(true);
              }}
              className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                isToday
                  ? "border-orange-500 bg-orange-50/30"
                  : "border-gray-100 bg-white hover:border-orange-200"
              }`}
            >
              <div className="flex flex-col items-center justify-center min-w-[50px]">
                <span className="text-[10px] font-bold text-gray-400">{weekLabel[i]}</span>
                <span className={`text-xl font-black ${isToday ? "text-orange-500" : "text-gray-700"}`}>
                  {date.getDate()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                {ev ? (
                  <div className="flex flex-col">
                    <div className={`text-sm font-black ${ev.type === "rest" ? "text-gray-400" : "text-gray-800"}`}>
                      {ev.type === "rest" ? "今日店休 REST DAY" : ev.location}
                    </div>

                    {ev.type === "work" && (
                      <div className="flex flex-col gap-0.5 mt-1">
                        <div className="text-[10px] text-orange-600 font-bold">🕒 {ev.time || "時間待定"}</div>
                        <div className="text-[10px] text-gray-400 truncate">📍 {ev.address || "地點詳洽"}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-300 font-medium">尚無安排行程</div>
                )}
              </div>

              <div className="text-gray-200 font-black">›</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen py-6 px-4 flex flex-col items-center bg-[#f8f8f8]">
      <div className="w-full max-w-md bg-white shadow-2xl rounded-[3rem] overflow-hidden relative border border-gray-100">
        {isAdmin && (
          <div className="no-print bg-yellow-300 text-[10px] font-black py-1 text-center">
            管理員模式（網址加 ?admin=1）
          </div>
        )}

        {/* 跑馬燈：字加大 */}
        <div
          className={`bg-orange-600 text-white py-3 overflow-hidden ${isAdmin ? "cursor-pointer" : ""}`}
          onClick={() => editSettingField("marquee", "跑馬燈")}
          title={isAdmin ? "點擊編輯跑馬燈" : ""}
        >
          <div className="animate-marquee whitespace-nowrap font-black text-sm tracking-widest">
            <span className="px-12">{appSettings.marquee}</span>
            <span className="px-12">{appSettings.marquee}</span>
            <span className="px-12">{appSettings.marquee}</span>
          </div>
        </div>

        {/* Head */}
        <div className="pt-14 pb-8 flex flex-col items-center">
          <div
            className={`relative ${isAdmin ? "cursor-pointer" : ""}`}
            onClick={onPickLogo}
            title={isAdmin ? "點擊更換 Logo" : ""}
          >
            <img
              src={appSettings.logoUrl}
              className="w-24 h-24 rounded-[2rem] object-cover shadow-xl border-4 border-white mb-4"
              alt="logo"
              loading="lazy"
            />
            {isAdmin && (
              <div className="absolute inset-0 rounded-[2rem] bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-black text-sm">更換</span>
              </div>
            )}
          </div>
          <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />

          <h1
            className={`text-3xl font-black text-gray-800 tracking-tight text-center ${isAdmin ? "cursor-pointer hover:opacity-80" : ""}`}
            onClick={() => editSettingField("title", "標題")}
            title={isAdmin ? "點擊編輯標題" : ""}
          >
            {appSettings.title}
          </h1>

          {/* 副標題：置中＋可換行 */}
          <p
            className={`text-orange-500 font-black text-[11px] tracking-[0.35em] uppercase mt-2 text-center whitespace-pre-wrap break-words px-6 leading-relaxed ${
              isAdmin ? "cursor-pointer hover:opacity-80" : ""
            }`}
            onClick={() => editSettingField("subtitle", "副標題")}
            title={isAdmin ? "點擊編輯副標題（可用 Enter 換行）" : ""}
          >
            {appSettings.subtitle}
          </p>
        </div>

        {/* Toggle */}
        <div className="px-6 flex gap-2 mb-4 no-print">
          <button
            onClick={() => setViewMode("month")}
            className={`flex-1 py-3 rounded-2xl font-black text-sm transition-all ${
              viewMode === "month" ? "bg-orange-500 text-white shadow-lg" : "bg-gray-100 text-gray-400"
            }`}
          >
            月檢視
          </button>
          <button
            onClick={() => setViewMode("week")}
            className={`flex-1 py-3 rounded-2xl font-black text-sm transition-all ${
              viewMode === "week" ? "bg-orange-500 text-white shadow-lg" : "bg-gray-100 text-gray-400"
            }`}
          >
            週行程
          </button>
        </div>

        {/* Calendar */}
        <div className="px-6 pb-6">
          <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between p-5 bg-orange-50/50">
              <button
                onClick={() => (viewMode === "month" ? changeMonth(-1) : changeWeek(-1))}
                className="p-2 bg-white rounded-full shadow-sm no-print"
                aria-label="prev"
              >
                ‹
              </button>

              <div className="flex flex-col items-center">
                <span className="font-black text-gray-700 text-base">
                  {viewMode === "month"
                    ? `${currentDate.getFullYear()} 年 ${currentDate.getMonth() + 1} 月`
                    : `W${getWeekNumber(currentDate)} 週行程`}
                </span>
              </div>

              <button
                onClick={() => (viewMode === "month" ? changeMonth(1) : changeWeek(1))}
                className="p-2 bg-white rounded-full shadow-sm no-print"
                aria-label="next"
              >
                ›
              </button>
            </div>

            {viewMode === "month" ? (
              <>
                <div className="calendar-grid text-center border-t border-gray-100 bg-gray-50/30">
                  <div className="py-2.5 text-[9px] font-black text-gray-300 border-r border-gray-100">
                    WEEK
                  </div>
                  {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
                    <div
                      key={d}
                      className="py-2.5 text-[10px] font-bold text-gray-400 border-r border-gray-100 last:border-0"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="flex flex-col border-t border-gray-100">{renderMonthCalendar()}</div>
              </>
            ) : (
              <div className="bg-gray-50/30">{renderWeekView()}</div>
            )}
          </div>
        </div>

        {/* LINE */}
        <div className="px-8 pb-10">
          <a
            href={LINE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-3 bg-[#06C755] text-white py-5 rounded-[1.5rem] font-black text-xl no-print transition-all active:scale-95 shadow-xl shadow-green-100"
          >
            LINE 預訂行程
          </a>
        </div>

        {/* MENU & NEWS */}
        <div className="px-8 pb-12">
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col">
              <div className="text-[10px] font-black text-orange-500 tracking-widest uppercase">
                Menu & News
              </div>
              <div className="text-xl font-black text-gray-800">MENU & NEWS</div>
            </div>

            {isAdmin && (
              <button
                onClick={onPickMenuNews}
                className="no-print px-4 py-2 rounded-full bg-black text-white text-[10px] font-black active:scale-95 transition-transform"
                title="最多 5 張"
              >
                新增圖片（最多5）
              </button>
            )}
          </div>

          <input
            type="file"
            ref={menuNewsInputRef}
            className="hidden"
            accept="image/*"
            multiple
            onChange={handleMenuNewsUpload}
          />

          <div className="grid grid-cols-2 gap-3">
            {menuNews.length === 0 ? (
              <div className="col-span-2 py-10 text-center text-gray-300 text-xs font-bold border-2 border-dashed border-gray-100 rounded-3xl">
                暫無內容
              </div>
            ) : (
              menuNews.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-square rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 shadow-sm group cursor-pointer"
                  onClick={() => {
                    setLightboxImage({ url: item.url, title: item.title || "MENU & NEWS" });
                    setIsLightboxOpen(true);
                  }}
                  title="點擊放大"
                >
                  <img
                    src={item.url}
                    className="w-full h-full object-cover"
                    alt={item.title || "MENU & NEWS"}
                    loading="lazy"
                  />

                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMenuNews(item.id);
                      }}
                      className="no-print absolute top-2 right-2 bg-red-500/90 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="刪除"
                    >
                      🗑
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {isAdmin && (
            <div className="no-print mt-3 text-[10px] text-gray-400 font-bold">
              目前：{menuNews.length} / 5（超過會自動限制上傳）
            </div>
          )}
        </div>
      </div>

      {/* 行程彈窗 */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-6 z-[100] no-print"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-[3rem] w-full max-w-sm p-8 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-orange-500 tracking-widest uppercase">
                  Schedule Detail
                </span>
                <h3 className="text-2xl font-black text-gray-800">{selectedDate}</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            {isAdmin ? (
              <div className="space-y-4">
                <div className="flex bg-gray-100 p-1.5 rounded-2xl">
                  <button
                    onClick={() => setEditingEvent({ ...editingEvent, type: "work" })}
                    className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${
                      editingEvent.type === "work" ? "bg-white shadow text-orange-600" : "text-gray-400"
                    }`}
                  >
                    出攤市集
                  </button>
                  <button
                    onClick={() => setEditingEvent({ ...editingEvent, type: "rest" })}
                    className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${
                      editingEvent.type === "rest" ? "bg-white shadow text-gray-600" : "text-gray-400"
                    }`}
                  >
                    今日店休
                  </button>
                </div>

                {editingEvent.type === "work" && (
                  <>
                    <input
                      className="w-full bg-gray-50 p-4 rounded-2xl font-bold border border-gray-100 outline-none focus:border-orange-500"
                      placeholder="市集名稱"
                      value={editingEvent.location}
                      onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                    />
                    <input
                      className="w-full bg-gray-50 p-4 rounded-2xl font-bold border border-gray-100 outline-none focus:border-orange-500"
                      placeholder="詳細地址"
                      value={editingEvent.address}
                      onChange={(e) => setEditingEvent({ ...editingEvent, address: e.target.value })}
                    />
                    <input
                      className="w-full bg-gray-50 p-4 rounded-2xl font-bold border border-gray-100 outline-none focus:border-orange-500"
                      placeholder="營業時間"
                      value={editingEvent.time}
                      onChange={(e) => setEditingEvent({ ...editingEvent, time: e.target.value })}
                    />
                  </>
                )}

                <textarea
                  className="w-full bg-gray-50 p-4 rounded-2xl font-bold border border-gray-100 outline-none focus:border-orange-500 h-28 resize-none"
                  placeholder="備註"
                  value={editingEvent.note}
                  onChange={(e) => setEditingEvent({ ...editingEvent, note: e.target.value })}
                />

                <button
                  onClick={async () => {
                    try {
                      setIsUploading(true);
                      await setDoc(doc(PATHS.eventsCol(), selectedDate), editingEvent);
                      setIsModalOpen(false);
                    } catch (err) {
                      console.error(err);
                      alert("更新失敗：請檢查 Firestore Rules 是否允許匿名寫入。");
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                  className="w-full bg-gray-800 text-white py-5 rounded-[1.5rem] font-black shadow-xl mt-4 active:scale-95 transition-all"
                >
                  更新排程
                </button>

                <button
                  onClick={async () => {
                    if (!window.confirm("確定刪除此日行程？")) return;
                    try {
                      setIsUploading(true);
                      await deleteDoc(doc(PATHS.eventsCol(), selectedDate));
                      setIsModalOpen(false);
                    } catch (err) {
                      console.error(err);
                      alert("刪除失敗：請檢查 Firestore Rules。");
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                  className="w-full text-red-500 py-2 text-xs font-bold"
                >
                  刪除此日行程
                </button>
              </div>
            ) : (
              <div className="text-center">
                {events[selectedDate] ? (
                  <div className="space-y-6">
                    <div
                      className={`p-8 rounded-[2rem] ${
                        events[selectedDate].type === "rest"
                          ? "bg-gray-50 border border-gray-100"
                          : "bg-orange-50/50 border border-orange-100"
                      }`}
                    >
                      <div className="text-2xl font-black text-gray-800 leading-tight mb-2">
                        {events[selectedDate].type === "rest"
                          ? "今日店休 REST DAY"
                          : events[selectedDate].location}
                      </div>

                      {events[selectedDate].type === "work" && (
                        <div className="space-y-3 mt-4">
                          <div className="text-orange-600 font-black">🕒 {events[selectedDate].time || "14:00 - 完售"}</div>
                          {(events[selectedDate].address || "").trim() && (
                            <div className="text-gray-400 text-sm font-bold leading-relaxed">
                              📍 {events[selectedDate].address}
                            </div>
                          )}
                          {(events[selectedDate].note || "").trim() && (
                            <div className="text-gray-500 text-sm font-medium italic leading-relaxed mt-4">
                              「{events[selectedDate].note}」
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {events[selectedDate].type === "work" && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          events[selectedDate].address || events[selectedDate].location
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-3 w-full bg-blue-500 text-white py-5 rounded-[1.5rem] font-black shadow-xl transition-all active:scale-95"
                      >
                        Google 地圖導航
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-300 font-bold py-12 text-lg italic">此日暫無公開行程</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute -top-12 right-0 text-white/90 hover:text-white font-black text-xl px-3 py-1 rounded-lg"
              onClick={() => setIsLightboxOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>

            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="w-full h-auto max-h-[80vh] object-contain bg-black"
              />
              <div className="px-4 py-3 text-sm font-black text-gray-700">{lightboxImage.title}</div>
            </div>
          </div>
        </div>
      )}

      {/* 上傳中遮罩 */}
      {isUploading && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center z-[200]">
          <div className="w-14 h-14 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mb-4 shadow-xl" />
          <p className="font-black text-orange-600 animate-pulse tracking-widest">正在同步至雲端...</p>
        </div>
      )}
    </div>
  );
}
