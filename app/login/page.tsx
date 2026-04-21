"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const { login, register, currentUsername } = useAuthStore();

  const [mode, setMode]         = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  // Already logged in → go home
  useEffect(() => {
    if (currentUsername) router.replace("/");
  }, [currentUsername, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const u = username.trim();
    const p = password.trim();

    if (!u || !p) { setError("Kullanıcı adı ve şifre gerekli."); return; }
    if (u.length < 3) { setError("Kullanıcı adı en az 3 karakter olmalı."); return; }
    if (p.length < 4) { setError("Şifre en az 4 karakter olmalı."); return; }

    if (mode === "register") {
      if (p !== confirm) { setError("Şifreler eşleşmiyor."); return; }
      const res = register(u, p);
      if (res === "taken") { setError("Bu kullanıcı adı zaten alınmış."); return; }
      router.replace("/");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const res = login(u, p);
      setLoading(false);
      if (res === "not_found")     { setError("Kullanıcı bulunamadı."); return; }
      if (res === "wrong_password") { setError("Şifre hatalı."); return; }
      router.replace("/");
    }, 300);
  }

  return (
    <div className="min-h-screen bg-[#070918] flex items-center justify-center px-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-900/15 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">✈️</div>
          <h1
            className="text-3xl font-bold text-white"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            AIRJEN
          </h1>
          <p className="text-slate-500 text-sm mt-1">Odak uçuşlarına hoş geldin</p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-7"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(16px)",
          }}
        >
          {/* Tab switch */}
          <div
            className="flex gap-1 p-1 rounded-xl mb-6"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                style={
                  mode === m
                    ? {
                        background: "linear-gradient(135deg,#3B82F6,#1D4ED8)",
                        color: "white",
                        boxShadow: "0 2px 12px rgba(59,130,246,0.3)",
                      }
                    : { color: "#64748B" }
                }
              >
                {m === "login" ? "Giriş Yap" : "Kayıt Ol"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                Kullanıcı Adı
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="pilot123"
                autoComplete="username"
                className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(59,130,246,0.5)")}
                onBlur={(e)  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(59,130,246,0.5)")}
                onBlur={(e)  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>

            {/* Confirm password (register only) */}
            <AnimatePresence>
              {mode === "register" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                    Şifre Tekrar
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "rgba(59,130,246,0.5)")}
                    onBlur={(e)  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="px-3 py-2.5 rounded-xl text-sm text-red-400"
                  style={{
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.25)",
                  }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #3B82F6, #1D4ED8)",
                boxShadow: "0 4px 20px rgba(59,130,246,0.35)",
              }}
            >
              {loading ? "⏳ Kontrol ediliyor..." : mode === "login" ? "🛫 Giriş Yap" : "✈ Hesap Oluştur"}
            </motion.button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          Veriler yalnızca bu cihazda saklanır.
        </p>
      </motion.div>
    </div>
  );
}
