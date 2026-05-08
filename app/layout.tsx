import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { AuthProvider } from "@/components/auth/auth-provider";
import { NotificationHub } from "@/components/notifications/notification-hub";
import { ErrorBoundary } from "@/components/error-boundary";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AIRJEN — Focus Timer as Virtual Flights",
    template: "%s | AIRJEN",
  },
  description:
    "Transform your focus sessions into virtual flights. Book a destination, choose your seat, and watch your plane fly as you stay focused.",
  keywords: ["focus timer", "productivity", "pomodoro", "study", "flights", "gamification"],
  authors: [{ name: "AIRJEN" }],
  openGraph: {
    title: "AIRJEN — Focus Timer as Virtual Flights",
    description: "Your focus sessions are now virtual flights.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#070918",
  viewportFit: "cover", // iOS notch / safe-area desteği
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={`dark ${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-[#070918] text-[#F8FAFC] antialiased min-h-screen">
        <AuthProvider>
          <ErrorBoundary>
            <Navbar />
          </ErrorBoundary>
          <ErrorBoundary>
            <main>{children}</main>
          </ErrorBoundary>
          <ErrorBoundary>
            <NotificationHub />
          </ErrorBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}
