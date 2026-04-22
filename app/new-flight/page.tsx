import type { Metadata } from "next";
import { WizardShell } from "@/components/flight-wizard/wizard-shell";
import { AuthGuard } from "@/components/auth/auth-guard";

export const metadata: Metadata = {
  title: "New Flight",
};

export default function NewFlightPage() {
  return (
    <AuthGuard>
    <div className="min-h-screen bg-[#070918] pt-16">
      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-900/20 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-slate-500 mb-4">
            <span>✈</span> Odak Uçuşu Rezerv Et
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold text-white"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            Yeni Uçuş
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Güzergahını ve koltuğunu seç, kalkışa hazırlan.
          </p>
        </div>

        <WizardShell />
      </div>
    </div>
    </AuthGuard>
  );
}
