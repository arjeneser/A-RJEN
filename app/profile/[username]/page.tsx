"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuthStore } from "@/store/auth-store";
import { getLevel, LEVEL_CONFIG } from "@/store/user-store";
import { getCityById, flagEmoji } from "@/data/cities";
import { formatMinutes } from "@/lib/utils";
import { loadUserSnapshot, type CloudUserSnapshot } from "@/lib/user-sync";
import { subscribeToPresence, type UserPresence } from "@/lib/presence";
import type { UserProfile, CompletedFlight, Stamp } from "@/types";

// ─── Isı haritası renkleri ─────────────────────────────────────────────────────
function heatColor(count: number): string {
  if (count === 0) return "rgba(255,255,255,0.04)";
  if (count === 1) return "rgba(59,130,246,0.35)";
  if (count === 2) return "rgba(59,130,246,0.6)";
  return "rgba(59,130,246,0.9)";
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

const TR_MONTHS = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];

// ─── Boş veri ─────────────────────────────────────────────────────────────────
const EMPTY_PROFILE: UserProfile = {
  name: "", totalXP: 0, totalFlights: 0, currentStreak: 0,
  longestStreak: 0, lastFlightDate: null, visitedCityIds: [],
  totalFocusMinutes: 0, completedSessionIds: [],
  avatarEmoji: "✈️", bio: "",
};

// ─── Yükleme iskeleti ─────────────────────────────────────────────────────────
function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${className ?? ""}`}
      style={{ background: "rgba(255,255,255,0.05)", ...style }}
    />
  );
}

export default function FriendProfilePage() {
  const params   = useParams();
  const router   = useRouter();
  const username = typeof params.username === "string" ? params.username : "";
  const { currentUsername } = useAuthStore();

  const [snap, setSnap]         = useState<CloudUserSnapshot | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [presence, setPresence] = useState<UserPresence | null>(null);

  // kendi profiliyse /profile'a yönlendir
  useEffect(() => {
    if (currentUsername && username === currentUsername) {
      router.replace("/profile");
    }
  }, [currentUsername, username, router]);

  // Firebase'den yükle
  useEffect(() => {
    if (!username) return;
    setLoading(true);
    loadUserSnapshot(username).then((data) => {
      if (!data) setNotFound(true);
      else setSnap(data);
      setLoading(false);
    });
  }, [username]);

  // Online durumu
  useEffect(() => {
    if (!username) return;
    return subscribeToPresence(username, setPresence);
  }, [username]);

  const profile  = snap?.profile  ?? EMPTY_PROFILE;
  const history  = snap?.history  ?? [];
  const stamps   = snap?.stamps   ?? [];

  const level = getLevel(profile.totalFlights);

  const visitedCountries = useMemo(
    () => new Set(stamps.map((s: Stamp) => s.countryCode)).size,
    [stamps]
  );

  // ── Heatmap ──────────────────────────────────────────────────────────────────
  const heatmapData = useMemo(() => {
    const byDate: Record<string, number> = {};
    history.forEach((f: CompletedFlight) => {
      const d = f.completedAt.split("T")[0];
      byDate[d] = (byDate[d] ?? 0) + 1;
    });
    const today  = new Date(); today.setHours(0, 0, 0, 0);
    const start  = getMonday(new Date(today.getTime() - 51 * 7 * 24 * 3600 * 1000));
    const weeks: Array<{ label: string; days: Array<{ date: string; count: number; isFuture: boolean }> }> = [];
    let cur = new Date(start); let prevMonth = -1;
    for (let w = 0; w < 52; w++) {
      const days = []; let label = "";
      for (let d = 0; d < 7; d++) {
        const iso = cur.toISOString().split("T")[0];
        if (d === 0 && cur.getMonth() !== prevMonth) { label = TR_MONTHS[cur.getMonth()]; prevMonth = cur.getMonth(); }
        days.push({ date: iso, count: byDate[iso] ?? 0, isFuture: cur > today });
        cur = new Date(cur.getTime() + 24 * 3600 * 1000);
      }
      weeks.push({ label, days });
    }
    return weeks;
  }, [history]);

  const totalHeatFlights = useMemo(
    () => history.filter((f: CompletedFlight) => Date.now() - new Date(f.completedAt).getTime() < 364 * 86400 * 1000).length,
    [history]
  );

  // ── Haftalık XP ──────────────────────────────────────────────────────────────
  const weeklyStats = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 8 }, (_, i) => {
      const w = 7 - i;
      const wEnd = new Date(now); wEnd.setDate(wEnd.getDate() - (w - 1) * 7); wEnd.setHours(23,59,59,999);
      const wStart = new Date(wEnd); wStart.setDate(wStart.getDate() - 6); wStart.setHours(0,0,0,0);
      const wf = history.filter((f: CompletedFlight) => {
        const t = new Date(f.completedAt).getTime();
        return t >= wStart.getTime() && t <= wEnd.getTime();
      });
      return { label: `${wStart.getDate()} ${TR_MONTHS[wStart.getMonth()]}`, xp: wf.reduce((s: number, f: CompletedFlight) => s + f.xpEarned, 0), flights: wf.length };
    });
  }, [history]);
  const maxWeekXP = useMemo(() => Math.max(...weeklyStats.map((w) => w.xp), 1), [weeklyStats]);

  // ── Top destinasyonlar ───────────────────────────────────────────────────────
  const topDests = useMemo(() => {
    const counts: Record<string, number> = {};
    history.forEach((f: CompletedFlight) => { counts[f.destinationId] = (counts[f.destinationId] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, count]) => ({ city: getCityById(id), count })).filter((d) => d.city);
  }, [history]);

  // ── Süre dağılımı ────────────────────────────────────────────────────────────
  const durationDist = useMemo(() => {
    const dist: Record<string, number> = {};
    history.forEach((f: CompletedFlight) => { const k = `${Math.round(f.durationMinutes / 60)}s`; dist[k] = (dist[k] ?? 0) + 1; });
    return Object.entries(dist).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([label, count]) => ({ label, count }));
  }, [history]);
  const maxDurCount = useMemo(() => Math.max(...durationDist.map((d) => d.count), 1), [durationDist]);

  // ── Bulunamadı ─────────────────────────────────────────────���─────────────────
  if (!loading && notFound) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-[#070918] pt-16 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              Kullanıcı bulunamadı
            </h2>
            <p className="text-slate-500 mb-6">@{username} henüz uçuş verisi paylaşmamış.</p>
            <button onClick={() => router.back()} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
              ← Geri Dön
            </button>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#070918] pt-16">
        {/* Ambient */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/3 w-[500px] h-[400px] bg-sky-900/12 rounded-full blur-[130px]" />
          <div className="absolute bottom-1/3 right-1/4 w-[350px] h-[250px] bg-indigo-900/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">

          {/* ═══ GERİ + AKSİYON BAŞLIĞI ═══ */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
            >
              ← Geri
            </button>
            {!loading && snap && currentUsername && (
              <div className="flex items-center gap-2">
                <Link href={`/?dm=${username}`}>
                  <button
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.35)" }}
                  >
                    💬 Mesaj Gönder
                  </button>
                </Link>
              </div>
            )}
          </div>

          {/* ═══ HERO KART ═══ */}
          {loading ? (
            <div className="rounded-3xl p-6 sm:p-8" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex gap-6 items-center">
                <Skeleton className="w-20 h-20 rounded-2xl" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl p-6 sm:p-8"
              style={{
                background: "linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(109,40,217,0.06) 100%)",
                border: "1px solid rgba(14,165,233,0.15)",
              }}
            >
              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                {/* Avatar */}
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shrink-0"
                  style={{
                    background: `${level.color}18`,
                    border: `2px solid ${level.color}50`,
                    boxShadow: `0 0 24px ${level.color}20`,
                  }}
                >
                  {profile.avatarEmoji ?? "✈️"}
                </div>

                {/* İsim + bio */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                      {profile.name || username}
                    </h1>
                    {/* Online badge */}
                    {presence?.online ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ADE80" }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Çevrimiçi
                      </span>
                    ) : presence ? (
                      <span className="text-[10px] text-slate-600">{Math.floor((Date.now() - presence.lastSeen) / 60000)} dk önce</span>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-500 mb-2">@{username}</p>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mb-3"
                    style={{ background: `${level.color}18`, border: `1px solid ${level.color}40`, color: level.color }}>
                    {level.emoji} {level.name}
                  </div>
                  {profile.bio && (
                    <p className="text-sm text-slate-400">{profile.bio}</p>
                  )}
                </div>

                {/* İstatistik kutuları */}
                <div className="grid grid-cols-2 gap-3 shrink-0">
                  {[
                    { value: profile.totalFlights, label: "Uçuş",  color: "#818CF8" },
                    { value: profile.totalXP,      label: "XP",     color: "#F59E0B" },
                    { value: profile.currentStreak,label: "Seri",   color: "#F97316" },
                    { value: visitedCountries,     label: "Ülke",   color: "#4ADE80" },
                  ].map((s) => (
                    <div key={s.label} className="text-center px-4 py-3 rounded-2xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="text-xl font-bold" style={{ color: s.color, fontFamily: "Space Grotesk, sans-serif" }}>{s.value}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ AKTİVİTE ISISI ═══ */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-3xl p-5 sm:p-6"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Uçuş Aktivitesi</h2>
                <p className="text-xs text-slate-600 mt-0.5">Son 52 hafta · {loading ? "–" : totalHeatFlights} uçuş</p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                <span>Az</span>
                {[0,1,2,3].map((l) => <div key={l} className="w-3 h-3 rounded-sm" style={{ background: heatColor(l) }} />)}
                <span>Çok</span>
              </div>
            </div>
            {loading ? (
              <div className="h-20 animate-pulse rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }} />
            ) : (
              <div className="overflow-x-auto pb-1">
                <div className="flex gap-[3px]" style={{ minWidth: "fit-content" }}>
                  <div className="flex flex-col gap-[3px] mr-1 pt-5">
                    {["", "Pzt", "", "Çar", "", "Cum", ""].map((d, i) => (
                      <div key={i} className="h-[11px] text-[8px] text-slate-700 leading-none flex items-center">{d}</div>
                    ))}
                  </div>
                  {heatmapData.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[3px]">
                      <div className="h-4 text-[9px] text-slate-600 leading-none flex items-end">{week.label}</div>
                      {week.days.map((day, di) => (
                        <div key={di} title={`${day.date}: ${day.count} uçuş`}
                          className="w-[11px] h-[11px] rounded-[2px] transition-all hover:scale-125 cursor-default"
                          style={{ background: day.isFuture ? "transparent" : heatColor(day.count), border: day.isFuture ? "none" : "1px solid rgba(255,255,255,0.04)" }} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* ═══ ORTA SATIR ═══ */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Haftalık XP */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="rounded-3xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Haftalık XP</h2>
              <p className="text-xs text-slate-600 mb-4">Son 8 hafta</p>
              {loading ? <Skeleton className="h-32" /> : (
                <div className="flex items-end gap-2 h-32">
                  {weeklyStats.map((w, i) => {
                    const pct = w.xp / maxWeekXP;
                    const isLast = i === weeklyStats.length - 1;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="text-[9px] text-slate-600 group-hover:text-slate-400 font-mono">{w.xp > 0 ? w.xp : ""}</div>
                        <div className="w-full flex items-end" style={{ height: 96 }}>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(pct * 88, w.xp > 0 ? 6 : 0)}px` }}
                            transition={{ duration: 0.8, delay: i * 0.07, ease: "easeOut" }}
                            className="w-full rounded-t-lg"
                            style={{
                              background: isLast ? "linear-gradient(to top, #0369A1, #38BDF8)" : "linear-gradient(to top, #1D4ED8, #3B82F6)",
                              boxShadow: isLast ? "0 0 12px rgba(56,189,248,0.4)" : undefined,
                              minHeight: w.xp > 0 ? 4 : 0,
                            }}
                          />
                        </div>
                        <div className="text-[8px] text-center truncate w-full" style={{ color: isLast ? "#38BDF8" : "#475569" }}>{w.label}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Favori destinasyonlar */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="rounded-3xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Favori Destinasyonlar</h2>
              <p className="text-xs text-slate-600 mb-4">En çok uçtuğu şehirler</p>
              {loading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div> : topDests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-700">
                  <span className="text-3xl mb-2">🌍</span>
                  <p className="text-sm">Henüz uçuş yok</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {topDests.map(({ city, count }, i) => (
                    <div key={city!.id} className="flex items-center gap-3 p-2.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: i === 0 ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)", color: i === 0 ? "#F59E0B" : "#64748B" }}>
                        {i + 1}
                      </div>
                      <span className="text-xl shrink-0">{flagEmoji(city!.countryCode)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-200 truncate">{city!.name}</div>
                        <div className="text-xs text-slate-600 truncate">{city!.country}</div>
                      </div>
                      <div className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)", color: "#60A5FA" }}>
                        {count}×
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* ═══ ALT SATIR: süre dağılımı + seviye yolu ═══ */}
          <div className="grid lg:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="rounded-3xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h2 className="text-base font-bold text-white mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Süre Dağılımı</h2>
              <p className="text-xs text-slate-600 mb-4">Hangi sürelerde uçtu?</p>
              {loading ? <Skeleton className="h-24" /> : durationDist.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-slate-700 text-sm">Henüz uçuş yok</div>
              ) : (
                <div className="space-y-2.5">
                  {durationDist.map((d) => (
                    <div key={d.label} className="flex items-center gap-3">
                      <div className="w-8 text-xs text-slate-500 shrink-0 font-mono">{d.label}</div>
                      <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(d.count / maxDurCount) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #1D4ED8, #38BDF8)" }} />
                      </div>
                      <div className="w-6 text-xs text-slate-400 text-right font-semibold shrink-0">{d.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Seviye yolu */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="rounded-3xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h2 className="text-base font-bold text-white mb-4" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Seviye Yolu</h2>
              {loading ? <Skeleton className="h-20" /> : (
                <div className="relative">
                  <div className="absolute top-5 left-5 right-5 h-0.5" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <div className="flex justify-between relative">
                    {LEVEL_CONFIG.map((l) => {
                      const unlocked = profile.totalFlights >= l.requiredFlights;
                      const isCurrent = getLevel(profile.totalFlights).name === l.name;
                      return (
                        <div key={l.name} className="flex flex-col items-center gap-2">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all z-10"
                            style={{ background: unlocked ? `${l.color}20` : "rgba(255,255,255,0.03)", borderColor: isCurrent ? l.color : unlocked ? `${l.color}60` : "rgba(255,255,255,0.08)", opacity: unlocked ? 1 : 0.35, boxShadow: isCurrent ? `0 0 16px ${l.color}40` : undefined }}>
                            {l.emoji}
                          </div>
                          <div className="text-center">
                            <div className="text-[9px] font-bold" style={{ color: unlocked ? l.color : "#334155" }}>{l.name}</div>
                            <div className="text-[8px] text-slate-700">{l.requiredFlights}✈</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* ═══ TAM İSTATİSTİK TABLOSU ═══ */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="rounded-3xl p-5 sm:p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <h2 className="text-base font-bold text-white mb-4" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Tüm İstatistikler</h2>
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[
                  { icon: "✈️", label: "Toplam Uçuş",        value: profile.totalFlights },
                  { icon: "⭐", label: "Toplam XP",           value: profile.totalXP },
                  { icon: "⏱️",label: "Toplam Odak",         value: formatMinutes(profile.totalFocusMinutes) },
                  { icon: "🔥", label: "Mevcut Seri",         value: `${profile.currentStreak} gün` },
                  { icon: "🏆", label: "En İyi Seri",         value: `${profile.longestStreak} gün` },
                  { icon: "🌍", label: "Ziyaret Edilen Ülke", value: visitedCountries },
                  { icon: "📖", label: "Pasaport Damgası",    value: stamps.length },
                  { icon: "🏅", label: "Kazanılan Başarım",   value: snap?.achievements?.length ?? 0 },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-3 p-3 rounded-2xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <span className="text-xl shrink-0">{s.icon}</span>
                    <div>
                      <div className="text-sm font-bold text-white" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{s.value}</div>
                      <div className="text-[10px] text-slate-600">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

        </div>
      </div>
    </AuthGuard>
  );
}
