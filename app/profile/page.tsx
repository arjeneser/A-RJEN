"use client";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useUserStore, getLevel, LEVEL_CONFIG } from "@/store/user-store";
import { useAuthStore } from "@/store/auth-store";
import { getCityById, flagEmoji } from "@/data/cities";
import { formatMinutes } from "@/lib/utils";

// ─── Avatar seçenekleri ───────────────────────────────────────────────────────
const AVATARS = [
  "✈️","🚀","🛩️","🌍","🏔️","🌊","🦅","⭐","🔥","💫",
  "🎯","🏆","👨‍✈️","🌟","💎","🎖️","🌈","⚡","🦁","🐉",
  "🦊","🐬","🦋","🌙","☀️","🎵","📚","💻","🎨","🏄",
  "🧭","🗺️","🌺","🍀","🦚","🐺","🦜","🎭","🏹","🌋",
];

// ─── Hücre rengi (uçuş sayısına göre) ────────────────────────────────────────
function heatColor(count: number): string {
  if (count === 0) return "rgba(255,255,255,0.04)";
  if (count === 1) return "rgba(59,130,246,0.35)";
  if (count === 2) return "rgba(59,130,246,0.6)";
  return "rgba(59,130,246,0.9)";
}

// ─── Hafta başlangıcı (Pazartesi) ─────────────────────────────────────────────
function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

const TR_MONTHS = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
const TR_DAYS   = ["Pzt","Çar","Cum"];   // sadece belirli satırlara etiket

// ─── Ana sayfa ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const {
    profile,
    history,
    stamps,
    achievements: earned,
    updateName,
    updateBio,
    updateAvatar,
  } = useUserStore();
  const { currentUsername } = useAuthStore();

  const [editingName, setEditingName]   = useState(false);
  const [nameInput, setNameInput]       = useState(profile.name);
  const [editingBio, setEditingBio]     = useState(false);
  const [bioInput, setBioInput]         = useState(profile.bio ?? "");
  const [avatarOpen, setAvatarOpen]     = useState(false);

  const level     = getLevel(profile.totalFlights);
  const visitedCountries = useMemo(
    () => new Set(stamps.map((s) => s.countryCode)).size,
    [stamps]
  );

  // ── Aktivite ısı haritası ─────────────────────────────────────────────────
  const heatmapData = useMemo(() => {
    const byDate: Record<string, number> = {};
    history.forEach((f) => {
      const d = f.completedAt.split("T")[0];
      byDate[d] = (byDate[d] ?? 0) + 1;
    });

    const today  = new Date();
    today.setHours(0, 0, 0, 0);
    const start  = getMonday(new Date(today.getTime() - 51 * 7 * 24 * 3600 * 1000));

    const weeks: Array<{ label: string; days: Array<{ date: string; count: number; isFuture: boolean }> }> = [];
    let cur = new Date(start);
    let prevMonth = -1;

    for (let w = 0; w < 52; w++) {
      const days = [];
      let label = "";
      for (let d = 0; d < 7; d++) {
        const iso = cur.toISOString().split("T")[0];
        if (d === 0 && cur.getMonth() !== prevMonth) {
          label = TR_MONTHS[cur.getMonth()];
          prevMonth = cur.getMonth();
        }
        days.push({ date: iso, count: byDate[iso] ?? 0, isFuture: cur > today });
        cur = new Date(cur.getTime() + 24 * 3600 * 1000);
      }
      weeks.push({ label, days });
    }
    return weeks;
  }, [history]);

  const totalHeatFlights = useMemo(
    () => history.filter((f) => {
      const d = new Date(f.completedAt);
      const now = new Date();
      return now.getTime() - d.getTime() < 364 * 24 * 3600 * 1000;
    }).length,
    [history]
  );

  // ── Haftalık XP (son 8 hafta) ─────────────────────────────────────────────
  const weeklyStats = useMemo(() => {
    const weeks = [];
    const now = new Date();
    for (let w = 7; w >= 0; w--) {
      const wEnd   = new Date(now);
      wEnd.setDate(wEnd.getDate() - w * 7);
      wEnd.setHours(23, 59, 59, 999);
      const wStart = new Date(wEnd);
      wStart.setDate(wStart.getDate() - 6);
      wStart.setHours(0, 0, 0, 0);

      const wFlights = history.filter((f) => {
        const t = new Date(f.completedAt).getTime();
        return t >= wStart.getTime() && t <= wEnd.getTime();
      });

      weeks.push({
        label: `${wStart.getDate()} ${TR_MONTHS[wStart.getMonth()]}`,
        xp: wFlights.reduce((s, f) => s + f.xpEarned, 0),
        flights: wFlights.length,
      });
    }
    return weeks;
  }, [history]);

  const maxWeekXP = useMemo(() => Math.max(...weeklyStats.map((w) => w.xp), 1), [weeklyStats]);

  // ── En çok gidilen destinasyonlar ─────────────────────────────────────────
  const topDests = useMemo(() => {
    const counts: Record<string, number> = {};
    history.forEach((f) => {
      counts[f.destinationId] = (counts[f.destinationId] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, count]) => ({ city: getCityById(id), count }))
      .filter((d) => d.city);
  }, [history]);

  // ── Uçuş süresi dağılımı ─────────────────────────────────────────────────
  const durationDist = useMemo(() => {
    const dist: Record<string, number> = {};
    history.forEach((f) => {
      const h = Math.round(f.durationMinutes / 60);
      const key = `${h}s`;
      dist[key] = (dist[key] ?? 0) + 1;
    });
    return Object.entries(dist)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([key, count]) => ({ label: key, count }));
  }, [history]);
  const maxDurCount = useMemo(() => Math.max(...durationDist.map((d) => d.count), 1), [durationDist]);

  // ── En çok ziyaret edilen ülkeler ─────────────────────────────────────────
  const topCountries = useMemo(() => {
    const counts: Record<string, number> = {};
    stamps.forEach((s) => {
      counts[s.countryCode] = (counts[s.countryCode] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, count }));
  }, [stamps]);

  function saveNameFn() {
    updateName(nameInput.trim() || "Pilot");
    setEditingName(false);
  }
  function saveBioFn() {
    updateBio(bioInput.trim().slice(0, 140));
    setEditingBio(false);
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#070918] pt-16">
        {/* Ambient */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/3 w-[500px] h-[400px] bg-violet-900/15 rounded-full blur-[130px]" />
          <div className="absolute bottom-1/3 right-1/4 w-[350px] h-[250px] bg-sky-900/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">

          {/* ══════════════════ HERO CARD ══════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl p-6 sm:p-8"
            style={{
              background: "linear-gradient(135deg, rgba(109,40,217,0.12) 0%, rgba(14,165,233,0.06) 100%)",
              border: "1px solid rgba(139,92,246,0.2)",
            }}
          >
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              {/* Avatar */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setAvatarOpen((p) => !p)}
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl transition-all hover:scale-105 active:scale-95 relative"
                  style={{
                    background: `${level.color}18`,
                    border: `2px solid ${level.color}50`,
                    boxShadow: `0 0 24px ${level.color}20`,
                  }}
                  title="Avatar değiştir"
                >
                  {profile.avatarEmoji ?? "✈️"}
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center text-[9px] text-white border border-[#070918]">✏</span>
                </button>

                {/* Avatar picker */}
                <AnimatePresence>
                  {avatarOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-24 left-0 z-50 p-3 rounded-2xl shadow-2xl"
                      style={{
                        background: "rgba(10,14,32,0.97)",
                        border: "1px solid rgba(139,92,246,0.3)",
                        width: 256,
                        backdropFilter: "blur(12px)",
                      }}
                    >
                      <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider font-semibold">Avatar seç</p>
                      <div className="grid grid-cols-8 gap-1">
                        {AVATARS.map((em) => (
                          <button
                            key={em}
                            onClick={() => { updateAvatar(em); setAvatarOpen(false); }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-lg transition-all hover:scale-110 hover:bg-white/10"
                            style={
                              profile.avatarEmoji === em
                                ? { background: "rgba(139,92,246,0.3)", border: "1px solid rgba(139,92,246,0.6)" }
                                : {}
                            }
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Name / username / bio */}
              <div className="flex-1 min-w-0">
                {/* Display name */}
                <div className="flex items-center gap-2 mb-0.5">
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveNameFn(); if (e.key === "Escape") setEditingName(false); }}
                        maxLength={24}
                        className="text-xl font-bold bg-white/[0.06] border border-violet-500/40 rounded-lg px-2 py-0.5 text-white outline-none focus:border-violet-400"
                        style={{ fontFamily: "Space Grotesk, sans-serif" }}
                      />
                      <button onClick={saveNameFn} className="text-green-400 hover:text-green-300 text-sm">✓</button>
                      <button onClick={() => setEditingName(false)} className="text-red-400 hover:text-red-300 text-sm">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setNameInput(profile.name); setEditingName(true); }}
                      className="group flex items-center gap-2"
                    >
                      <span className="text-2xl font-bold text-white" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                        {profile.name}
                      </span>
                      <span className="text-slate-600 group-hover:text-slate-400 text-xs transition-colors">✏</span>
                    </button>
                  )}
                </div>

                {/* Username */}
                <p className="text-sm text-slate-500 mb-2">@{currentUsername}</p>

                {/* Level badge */}
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mb-3"
                  style={{
                    background: `${level.color}18`,
                    border: `1px solid ${level.color}40`,
                    color: level.color,
                  }}
                >
                  {level.emoji} {level.name}
                </div>

                {/* Bio */}
                {editingBio ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      autoFocus
                      value={bioInput}
                      onChange={(e) => setBioInput(e.target.value.slice(0, 140))}
                      onKeyDown={(e) => { if (e.key === "Escape") setEditingBio(false); }}
                      rows={2}
                      placeholder="Kendini tanıt... (maks 140 karakter)"
                      className="w-full text-sm bg-white/[0.05] border border-violet-500/40 rounded-xl px-3 py-2 text-white placeholder-slate-600 outline-none resize-none focus:border-violet-400"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-600">{bioInput.length}/140</span>
                      <button onClick={saveBioFn} className="text-xs px-3 py-1 rounded-lg font-semibold text-white" style={{ background: "rgba(139,92,246,0.4)", border: "1px solid rgba(139,92,246,0.5)" }}>Kaydet</button>
                      <button onClick={() => setEditingBio(false)} className="text-xs text-slate-500 hover:text-slate-300">İptal</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setBioInput(profile.bio ?? ""); setEditingBio(true); }}
                    className="group text-left"
                  >
                    {profile.bio ? (
                      <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors flex items-start gap-1.5">
                        <span>{profile.bio}</span>
                        <span className="text-slate-600 group-hover:text-slate-400 text-xs mt-0.5 shrink-0">✏</span>
                      </p>
                    ) : (
                      <p className="text-sm text-slate-600 group-hover:text-slate-500 transition-colors italic">
                        + Biyografi ekle...
                      </p>
                    )}
                  </button>
                )}
              </div>

              {/* Sağ: büyük istatistikler */}
              <div className="grid grid-cols-2 gap-3 shrink-0">
                {[
                  { value: profile.totalFlights,                  label: "Uçuş",      color: "#818CF8" },
                  { value: profile.totalXP,                       label: "XP",         color: "#F59E0B" },
                  { value: profile.currentStreak,                 label: "Seri",       color: "#F97316" },
                  { value: visitedCountries,                      label: "Ülke",       color: "#4ADE80" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="text-center px-4 py-3 rounded-2xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <div className="text-xl font-bold" style={{ color: s.color, fontFamily: "Space Grotesk, sans-serif" }}>
                      {s.value}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ══════════════════ AKTİVİTE ISISI ══════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl p-5 sm:p-6"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                  Uçuş Aktivitesi
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">Son 52 hafta · {totalHeatFlights} uçuş</p>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                <span>Az</span>
                {[0,1,2,3].map((l) => (
                  <div
                    key={l}
                    className="w-3 h-3 rounded-sm"
                    style={{ background: heatColor(l) }}
                  />
                ))}
                <span>Çok</span>
              </div>
            </div>

            {/* Heatmap */}
            <div className="overflow-x-auto pb-1">
              <div className="flex gap-[3px]" style={{ minWidth: "fit-content" }}>
                {/* Gün etiketleri (sol sütun) */}
                <div className="flex flex-col gap-[3px] mr-1 pt-5">
                  {["", "Pzt", "", "Çar", "", "Cum", ""].map((d, i) => (
                    <div key={i} className="h-[11px] text-[8px] text-slate-700 leading-none flex items-center">
                      {d}
                    </div>
                  ))}
                </div>
                {/* Hafta sütunları */}
                {heatmapData.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {/* Ay etiketi */}
                    <div className="h-4 text-[9px] text-slate-600 leading-none flex items-end">
                      {week.label}
                    </div>
                    {week.days.map((day, di) => (
                      <div
                        key={di}
                        title={`${day.date}: ${day.count} uçuş`}
                        className="w-[11px] h-[11px] rounded-[2px] transition-all hover:scale-125 cursor-default"
                        style={{
                          background: day.isFuture ? "transparent" : heatColor(day.count),
                          border: day.isFuture ? "none" : "1px solid rgba(255,255,255,0.04)",
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ══════════════════ ORTA SATIR ══════════════════ */}
          <div className="grid lg:grid-cols-2 gap-6">

            {/* Haftalık XP grafiği */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-3xl p-5"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                Haftalık XP
              </h2>
              <p className="text-xs text-slate-600 mb-4">Son 8 hafta</p>
              <div className="flex items-end gap-2 h-32">
                {weeklyStats.map((w, i) => {
                  const pct = maxWeekXP > 0 ? (w.xp / maxWeekXP) : 0;
                  const isLast = i === weeklyStats.length - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="text-[9px] text-slate-600 group-hover:text-slate-400 transition-colors font-mono">
                        {w.xp > 0 ? w.xp : ""}
                      </div>
                      <div className="w-full flex items-end" style={{ height: 96 }}>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(pct * 88, w.xp > 0 ? 6 : 0)}px` }}
                          transition={{ duration: 0.8, delay: i * 0.07, ease: "easeOut" }}
                          className="w-full rounded-t-lg"
                          style={{
                            background: isLast
                              ? "linear-gradient(to top, #7C3AED, #A78BFA)"
                              : "linear-gradient(to top, #1D4ED8, #3B82F6)",
                            boxShadow: isLast ? "0 0 12px rgba(139,92,246,0.4)" : undefined,
                            minHeight: w.xp > 0 ? 4 : 0,
                          }}
                        />
                      </div>
                      <div
                        className="text-[8px] text-center truncate w-full"
                        style={{ color: isLast ? "#A78BFA" : "#475569" }}
                      >
                        {w.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Uçuş süresi dağılımı */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-3xl p-5"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                Süre Dağılımı
              </h2>
              <p className="text-xs text-slate-600 mb-4">Hangi sürelerde uçtun?</p>

              {durationDist.length === 0 ? (
                <div className="flex items-center justify-center h-28 text-slate-700 text-sm">
                  Henüz uçuş yok
                </div>
              ) : (
                <div className="space-y-2.5">
                  {durationDist.map((d) => (
                    <div key={d.label} className="flex items-center gap-3">
                      <div className="w-8 text-xs text-slate-500 shrink-0 font-mono">{d.label}</div>
                      <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(d.count / maxDurCount) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{ background: "linear-gradient(90deg, #1D4ED8, #38BDF8)" }}
                        />
                      </div>
                      <div className="w-6 text-xs text-slate-400 text-right font-semibold shrink-0">{d.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* ══════════════════ ALT SATIR ══════════════════ */}
          <div className="grid lg:grid-cols-2 gap-6">

            {/* En çok gidilen şehirler */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-3xl p-5"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                Favori Destinasyonlar
              </h2>
              <p className="text-xs text-slate-600 mb-4">En çok uçtuğun şehirler</p>

              {topDests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-700">
                  <span className="text-3xl mb-2">🌍</span>
                  <p className="text-sm">Henüz uçuş yok</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {topDests.map(({ city, count }, i) => (
                    <div key={city!.id} className="flex items-center gap-3 p-2.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          background: i === 0 ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)",
                          color: i === 0 ? "#F59E0B" : "#64748B",
                        }}
                      >
                        {i + 1}
                      </div>
                      <span className="text-xl shrink-0">{flagEmoji(city!.countryCode)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-200 truncate">{city!.name}</div>
                        <div className="text-xs text-slate-600 truncate">{city!.country}</div>
                      </div>
                      <div
                        className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: "rgba(59,130,246,0.12)",
                          border: "1px solid rgba(59,130,246,0.2)",
                          color: "#60A5FA",
                        }}
                      >
                        {count}×
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Ülke dağılımı + seviye yolu */}
            <div className="space-y-6">
              {/* En çok ziyaret edilen ülkeler */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-3xl p-5"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                  En Çok Ziyaret Edilen Ülkeler
                </h2>
                <p className="text-xs text-slate-600 mb-3">Damga sayısına göre</p>
                {topCountries.length === 0 ? (
                  <p className="text-sm text-slate-700 py-2">Henüz yurt dışı uçuşu yok</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {topCountries.map(({ code, count }) => (
                      <div
                        key={code}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <span className="text-base">{flagEmoji(code)}</span>
                        <span className="text-slate-300">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Seviye yolu */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="rounded-3xl p-5"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <h2 className="text-base font-bold text-white mb-4" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                  Seviye Yolu
                </h2>
                <div className="relative">
                  {/* bağlantı çizgisi */}
                  <div className="absolute top-5 left-5 right-5 h-0.5" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <div className="flex justify-between relative">
                    {LEVEL_CONFIG.map((l) => {
                      const unlocked = profile.totalFlights >= l.requiredFlights;
                      const isCurrent = getLevel(profile.totalFlights).name === l.name;
                      return (
                        <div key={l.name} className="flex flex-col items-center gap-2">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all z-10"
                            style={{
                              background: unlocked ? `${l.color}20` : "rgba(255,255,255,0.03)",
                              borderColor: isCurrent ? l.color : unlocked ? `${l.color}60` : "rgba(255,255,255,0.08)",
                              opacity: unlocked ? 1 : 0.35,
                              boxShadow: isCurrent ? `0 0 16px ${l.color}40` : undefined,
                            }}
                          >
                            {l.emoji}
                          </div>
                          <div className="text-center">
                            <div
                              className="text-[9px] font-bold"
                              style={{ color: unlocked ? l.color : "#334155" }}
                            >
                              {l.name}
                            </div>
                            <div className="text-[8px] text-slate-700">{l.requiredFlights}✈</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* ══════════════════ TAM İSTATİSTİK TABLOSU ══════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-3xl p-5 sm:p-6"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <h2 className="text-base font-bold text-white mb-4" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              Tüm İstatistikler
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                { icon: "✈️",  label: "Toplam Uçuş",         value: profile.totalFlights },
                { icon: "⭐",  label: "Toplam XP",            value: profile.totalXP },
                { icon: "⏱️", label: "Toplam Odak",          value: formatMinutes(profile.totalFocusMinutes) },
                { icon: "🔥",  label: "Mevcut Seri",          value: `${profile.currentStreak} gün` },
                { icon: "🏆",  label: "En İyi Seri",          value: `${profile.longestStreak} gün` },
                { icon: "🌍",  label: "Ziyaret Edilen Ülke",  value: visitedCountries },
                { icon: "📖",  label: "Pasaport Damgası",     value: stamps.length },
                { icon: "🏅",  label: "Kazanılan Başarım",    value: earned.length },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <span className="text-xl shrink-0">{s.icon}</span>
                  <div>
                    <div className="text-sm font-bold text-white" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                      {s.value}
                    </div>
                    <div className="text-[10px] text-slate-600">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>

      {/* Avatar picker dışına tıklayınca kapat */}
      {avatarOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setAvatarOpen(false)}
        />
      )}
    </AuthGuard>
  );
}
