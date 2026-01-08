import React from "react";

export default function App() {
  return (
    <div className="min-h-screen bg-[#f8f8f8] flex flex-col items-center py-10 px-4">
      
      {/* ===== Tailwind 測試區（看到紅底大字代表 Tailwind 正常） ===== */}
      <div className="text-5xl bg-red-200 p-6 rounded-2xl shadow-xl mb-10">
        TEST Tailwind OK
      </div>

      {/* ===== 主卡片容器 ===== */}
      <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-gray-100">
        
        {/* 跑馬燈 */}
        <div className="bg-orange-600 text-white py-3 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap font-black text-sm tracking-widest">
            <span className="px-12">🍞 每日口味限量，歡迎透過 LINE 提前預約！</span>
            <span className="px-12">🍞 每日口味限量，歡迎透過 LINE 提前預約！</span>
            <span className="px-12">🍞 每日口味限量，歡迎透過 LINE 提前預約！</span>
          </div>
        </div>

        {/* Logo + 標題 */}
        <div className="pt-14 pb-10 flex flex-col items-center">
          <img
            src="https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300"
            className="w-24 h-24 rounded-[2rem] object-cover shadow-xl border-4 border-white mb-4"
            alt="logo"
          />
          <h1 className="text-3xl font-black text-gray-800 tracking-tight text-center">
            島嶼生吐司
          </h1>
          <p className="text-orange-500 font-black text-[11px] tracking-[0.35em] uppercase mt-2 text-center whitespace-pre-wrap break-words px-6 leading-relaxed">
            ISLAND TOAST
            <br />
            來自大海氣息的蓬鬆柔軟
          </p>
        </div>

        {/* 內容區 */}
        <div className="px-8 pb-12 space-y-6 text-center">
          <div className="text-gray-600 font-bold">
            這是一個乾淨的 Vite + Tailwind 結構測試頁
          </div>

          <div className="text-sm text-gray-400 leading-relaxed">
            如果你有看到：
            <br />
            ✔ 紅色 TEST 區塊  
            <br />
            ✔ 圓角白色卡片  
            <br />
            ✔ 橘色跑馬燈  
            <br />
            代表 Tailwind 已完全生效，版面跑掉問題已根治。
          </div>

          <a
            href="https://line.me/R/ti/p/@516mdfqz"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-3 bg-[#06C755] text-white py-4 px-6 rounded-[1.5rem] font-black text-lg transition-all active:scale-95 shadow-xl shadow-green-100"
          >
            前往 LINE 詢問
          </a>
        </div>
      </div>
    </div>
  );
}
