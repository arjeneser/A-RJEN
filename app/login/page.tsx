"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";

type Mode = "login" | "register" | "forgot";

const SECURITY_QUESTIONS = [
  "Evcil hayvanınızın adı nedir?",
  "Annenizin kızlık soyadı nedir?",
  "İlk öğretmeninizin adı nedir?",
  "Doğduğunuz şehir neresidir?",
  "Çocukluk arkadaşınızın adı nedir?",
  "İlk arabanızın markası nedir?",
  "En sevdiğiniz çocukluk filmi hangisiydi?",
  "Büyüdüğünüz sokağın adı nedir?",
];

const INPUT_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
};
const INPUT_FOCUS  = "rgba(59,130,246,0.5)";
const INPUT_BLUR   = "rgba(255,255,255,0.1)";

export default function LoginPage() {
  const router = useRouter();
  const { login, register, resetPassword, currentUsername } = useAuthStore();

  const [mode, setMode]                       = useState<Mode>("login");
  const [username, setUsername]               = useState("");
  const [password, setPassword]               = useState("");
  const [confirm, setConfirm]                 = useState("");
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer]   = useState("");
  const [error, setError]                     = useState("");
  const [loading, setLoading]                 = useState(false);
  const [remember, setRemember]               = useState(false);

  // Forgot password state
  const [forgotStep, setForgotStep]           = useState<"username" | "answer" | "newpass">("username");
  const [forgotUsername, setForgotUsername]   = useState("");
  const [forgotQuestion, setForgotQuestion]   = useState("");
  const [forgotAnswer, setForgotAnswer]       = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [successMsg, setSuccessMsg]           = useState("");

  // Kayıtlı kullanıcı adını yükle (beni hatırla seçiliyse)
  useEffect(() => {
    const saved = localStorage.getItem("airjen-remember");
    if (saved) { setUsername(saved); setRemember(true); }
  }, []);

  // Giriş yapılmışsa ana sayfaya yönlendir
  useEffect(() => {
    if (currentUsername) router.replace("/");
  }, [currentUsername, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const u = username.trim();
    const p = password.trim();

    if (!u || !p) { setError("Kullanıcı adı ve şifre gerekli."); return; }
    if (u.length < 3) { setError("Kullanıcı adı en az 3 karakter olmalı."); return; }
    if (p.length < 4) { setError("Şifre en az 4 karakter olmalı."); return; }

    if (mode === "register") {
      if (p !== confirm) { setError("Şifreler eşleşmiyor."); return; }
      if (!securityAnswer.trim()) { setError("Güvenlik sorusu cevabı gerekli."); return; }
      setLoading(true);
      const res = await register(u, p, securityQuestion, securityAnswer);
      setLoading(false);
      if (res === "taken") { setError("Bu kullanıcı adı zaten alınmış."); return; }
      // Yeni kayıt → her zaman kalıcı oturum
      localStorage.setItem("airjen-session", u.trim().toLowerCase());
      sessionStorage.removeItem("airjen-session");
      router.replace("/");
      return;
    }

    // Login
    setLoading(true);
    await new Promise((r) => setTimeout(r, 300)); // UX delay
    const res = await login(u, p);
    setLoading(false);
    if (res === "not_found")      { setError("Kullanıcı bulunamadı."); return; }
    if (res === "wrong_password") { setError("Şifre hatalı."); return; }

    // Beni hatırla: localStorage (kalıcı) vs sessionStorage (sekme kapanınca sona erer)
    const key = u.trim().toLowerCase();
    if (remember) {
      localStorage.setItem("airjen-session", key);
      localStorage.setItem("airjen-remember", u);
      sessionStorage.removeItem("airjen-session");
    } else {
      sessionStorage.setItem("airjen-session", key);
      localStorage.removeItem("airjen-session");
      localStorage.removeItem("airjen-remember");
    }
    router.replace("/");
  }

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
    setSuccessMsg("");
    setConfirm("");
    setSecurityAnswer("");
    setSecurityQuestion(SECURITY_QUESTIONS[0]);
    if (m === "forgot") {
      setForgotStep("username");
      setForgotUsername("");
      setForgotQuestion("");
      setForgotAnswer("");
      setNewPassword("");
      setNewPasswordConfirm("");
    }
  }

  // ── Forgot password handlers ───────────────────────────────────────────────
  function handleForgotCheckUser() {
    setError("");
    const key = forgotUsername.trim().toLowerCase();
    if (!key) { setError("Kullanıcı adı girin."); return; }
    const { credentials } = useAuthStore.getState();
    const cred = credentials[key];
    if (!cred) { setError("Kullanıcı bulunamadı."); return; }
    const q = typeof cred === "string" ? "" : cred.securityQuestion;
    if (!q) { setError("Bu hesap için güvenlik sorusu tanımlı değil."); return; }
    setForgotQuestion(q);
    setForgotStep("answer");
  }

  function handleForgotVerifyAnswer() {
    setError("");
    const key = forgotUsername.trim().toLowerCase();
    const { credentials } = useAuthStore.getState();
    const cred = credentials[key];
    if (!cred || typeof cred === "string") { setError("Hesap bulunamadı."); return; }
    if (cred.securityAnswer !== forgotAnswer.trim().toLowerCase()) {
      setError("Cevap yanlış.");
      return;
    }
    setForgotStep("newpass");
  }

  async function handleForgotResetPassword() {
    setError("");
    if (newPassword.length < 4) { setError("Şifre en az 4 karakter olmalı."); return; }
    if (newPassword !== newPasswordConfirm) { setError("Şifreler eşleşmiyor."); return; }
    setLoading(true);
    await resetPassword(forgotUsername.trim().toLowerCase(), newPassword);
    setLoading(false);
    setSuccessMsg("Şifreniz güncellendi.");
    switchMode("login");
    setTimeout(() => setSuccessMsg(""), 4000);
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

        {/* Success message */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 px-4 py-3 rounded-2xl text-sm text-green-400 text-center font-semibold"
              style={{
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.25)",
              }}
            >
              {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card */}
        <div
          className="rounded-3xl p-7"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(16px)",
          }}
        >
          {/* Tab switch — gizle forgot modunda */}
          {mode !== "forgot" && (
            <div
              className="flex gap-1 p-1 rounded-xl mb-6"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              {(["login", "register"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
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
          )}

          {/* ── Şifremi Unuttum formu ───────────────────────────────────────── */}
          {mode === "forgot" && (
            <div className="space-y-4">
              <div className="text-center mb-5">
                <div className="text-2xl mb-2">🔑</div>
                <h2 className="text-base font-bold text-white" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                  Şifremi Unuttum
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {forgotStep === "username" && "Kullanıcı adınızı girin"}
                  {forgotStep === "answer"   && "Güvenlik sorusunu cevaplayın"}
                  {forgotStep === "newpass"  && "Yeni şifrenizi belirleyin"}
                </p>
              </div>

              {/* Adım 1: Kullanıcı adı */}
              {forgotStep === "username" && (
                <>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Kullanıcı Adı</label>
                    <input
                      type="text"
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                      placeholder="pilot123"
                      autoComplete="username"
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                      style={INPUT_STYLE}
                      onFocus={(e) => (e.target.style.borderColor = INPUT_FOCUS)}
                      onBlur={(e)  => (e.target.style.borderColor = INPUT_BLUR)}
                    />
                  </div>
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="px-3 py-2.5 rounded-xl text-sm text-red-400"
                        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleForgotCheckUser}
                    className="w-full py-3.5 rounded-xl font-bold text-white text-sm"
                    style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)", boxShadow: "0 4px 20px rgba(59,130,246,0.35)" }}
                  >
                    Güvenlik Sorusunu Göster
                  </motion.button>
                </>
              )}

              {/* Adım 2: Güvenlik sorusu cevabı */}
              {forgotStep === "answer" && (
                <>
                  <div
                    className="px-4 py-3 rounded-xl text-sm text-slate-300"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {forgotQuestion}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Cevabınız</label>
                    <input
                      type="text"
                      value={forgotAnswer}
                      onChange={(e) => setForgotAnswer(e.target.value)}
                      placeholder="Cevabı girin…"
                      autoComplete="off"
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                      style={INPUT_STYLE}
                      onFocus={(e) => (e.target.style.borderColor = INPUT_FOCUS)}
                      onBlur={(e)  => (e.target.style.borderColor = INPUT_BLUR)}
                    />
                  </div>
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="px-3 py-2.5 rounded-xl text-sm text-red-400"
                        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleForgotVerifyAnswer}
                    className="w-full py-3.5 rounded-xl font-bold text-white text-sm"
                    style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)", boxShadow: "0 4px 20px rgba(59,130,246,0.35)" }}
                  >
                    Doğrula
                  </motion.button>
                </>
              )}

              {/* Adım 3: Yeni şifre */}
              {forgotStep === "newpass" && (
                <>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Yeni Şifre</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                      style={INPUT_STYLE}
                      onFocus={(e) => (e.target.style.borderColor = INPUT_FOCUS)}
                      onBlur={(e)  => (e.target.style.borderColor = INPUT_BLUR)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Yeni Şifre Tekrar</label>
                    <input
                      type="password"
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                      style={INPUT_STYLE}
                      onFocus={(e) => (e.target.style.borderColor = INPUT_FOCUS)}
                      onBlur={(e)  => (e.target.style.borderColor = INPUT_BLUR)}
                    />
                  </div>
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="px-3 py-2.5 rounded-xl text-sm text-red-400"
                        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={loading}
                    onClick={handleForgotResetPassword}
                    className="w-full py-3.5 rounded-xl font-bold text-white text-sm disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)", boxShadow: "0 4px 20px rgba(59,130,246,0.35)" }}
                  >
                    {loading ? "⏳ Güncelleniyor..." : "Şifreyi Güncelle"}
                  </motion.button>
                </>
              )}

              {/* Giriş ekranına dön */}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="w-full py-2.5 rounded-xl text-xs text-slate-500 hover:text-slate-300 transition-colors"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                ← Giriş ekranına dön
              </button>
            </div>
          )}

          {mode !== "forgot" && <form onSubmit={handleSubmit} className="space-y-4">
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
                style={INPUT_STYLE}
                onFocus={(e) => (e.target.style.borderColor = INPUT_FOCUS)}
                onBlur={(e)  => (e.target.style.borderColor = INPUT_BLUR)}
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
                style={INPUT_STYLE}
                onFocus={(e) => (e.target.style.borderColor = INPUT_FOCUS)}
                onBlur={(e)  => (e.target.style.borderColor = INPUT_BLUR)}
              />
            </div>

            {/* Kayıt modu ek alanları */}
            <AnimatePresence>
              {mode === "register" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-4 overflow-hidden"
                >
                  {/* Şifre Tekrar */}
                  <div>
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
                      style={INPUT_STYLE}
                      onFocus={(e) => (e.target.style.borderColor = INPUT_FOCUS)}
                      onBlur={(e)  => (e.target.style.borderColor = INPUT_BLUR)}
                    />
                  </div>

                  {/* Güvenlik Sorusu */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                      🔒 Güvenlik Sorusu
                    </label>
                    <select
                      value={securityQuestion}
                      onChange={(e) => setSecurityQuestion(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all appearance-none cursor-pointer"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = INPUT_FOCUS)}
                      onBlur={(e)  => (e.target.style.borderColor = INPUT_BLUR)}
                    >
                      {SECURITY_QUESTIONS.map((q) => (
                        <option key={q} value={q} style={{ background: "#0A0F1E" }}>
                          {q}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Güvenlik Sorusu Cevabı */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                      Cevabınız
                    </label>
                    <input
                      type="text"
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      placeholder="Cevabı girin…"
                      autoComplete="off"
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                      style={INPUT_STYLE}
                      onFocus={(e) => (e.target.style.borderColor = INPUT_FOCUS)}
                      onBlur={(e)  => (e.target.style.borderColor = INPUT_BLUR)}
                    />
                    <p className="text-[10px] text-slate-600 mt-1.5 leading-relaxed">
                      Şifrenizi unutursanız bu cevap ile kimliğinizi doğrulayabilirsiniz. Büyük/küçük harf fark etmez.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Beni Hatırla — sadece giriş modunda */}
            {mode === "login" && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => setRemember(!remember)}
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all"
                  style={{
                    background: remember
                      ? "linear-gradient(135deg,#3B82F6,#1D4ED8)"
                      : "rgba(255,255,255,0.06)",
                    border: remember
                      ? "1px solid #3B82F6"
                      : "1px solid rgba(255,255,255,0.15)",
                    boxShadow: remember ? "0 0 8px rgba(59,130,246,0.4)" : undefined,
                  }}
                >
                  {remember && (
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                      <path d="M1 4.5L4 7.5L10 1.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div>
                  <span className="text-xs text-slate-400">Beni Hatırla</span>
                  <span className="text-[10px] text-slate-600 ml-2">
                    {remember ? "Tarayıcı kapansa bile giriş kalır" : "Sekme kapanınca çıkış yapılır"}
                  </span>
                </div>
              </label>
            )}

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

            {/* Şifremi Unuttum linki — sadece login modunda */}
            {mode === "login" && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                >
                  Şifremi Unuttum
                </button>
              </div>
            )}
          </form>}
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          Veriler yalnızca bu cihazda saklanır.
        </p>
      </motion.div>
    </div>
  );
}
