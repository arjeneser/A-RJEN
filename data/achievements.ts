import type { UserProfile, CompletedFlight, Stamp, Achievement } from "@/types";

// ─── Kıta haritası ────────────────────────────────────────────────────────────

const CONTINENT_MAP: Record<string, string> = {
  // Avrupa
  GB:"EU",FR:"EU",DE:"EU",IT:"EU",ES:"EU",NL:"EU",BE:"EU",CH:"EU",AT:"EU",
  SE:"EU",NO:"EU",DK:"EU",FI:"EU",PL:"EU",CZ:"EU",SK:"EU",HU:"EU",RO:"EU",
  BG:"EU",GR:"EU",PT:"EU",HR:"EU",RS:"EU",SI:"EU",BA:"EU",ME:"EU",AL:"EU",
  MK:"EU",LT:"EU",LV:"EU",EE:"EU",BY:"EU",UA:"EU",MD:"EU",IE:"EU",IS:"EU",
  LU:"EU",MT:"EU",CY:"EU",
  // Asya
  CN:"AS",JP:"AS",IN:"AS",KR:"AS",SG:"AS",TH:"AS",MY:"AS",ID:"AS",PH:"AS",
  VN:"AS",BD:"AS",PK:"AS",SA:"AS",AE:"AS",IR:"AS",IQ:"AS",TR:"AS",IL:"AS",
  JO:"AS",KW:"AS",QA:"AS",BH:"AS",OM:"AS",YE:"AS",AF:"AS",UZ:"AS",KZ:"AS",
  TM:"AS",AZ:"AS",GE:"AS",AM:"AS",LB:"AS",SY:"AS",MN:"AS",NP:"AS",LK:"AS",
  MM:"AS",KH:"AS",LA:"AS",KG:"AS",TJ:"AS",HK:"AS",MO:"AS",TW:"AS",
  // Afrika
  ZA:"AF",NG:"AF",KE:"AF",EG:"AF",TZ:"AF",GH:"AF",ET:"AF",CI:"AF",CM:"AF",
  SN:"AF",MZ:"AF",MG:"AF",ZW:"AF",ZM:"AF",UG:"AF",TN:"AF",SO:"AF",DZ:"AF",
  MA:"AF",LY:"AF",SD:"AF",AO:"AF",CD:"AF",RW:"AF",BI:"AF",BJ:"AF",BF:"AF",
  // Kuzey Amerika
  US:"NA",CA:"NA",MX:"NA",CU:"NA",GT:"NA",HN:"NA",SV:"NA",NI:"NA",CR:"NA",
  PA:"NA",JM:"NA",HT:"NA",DO:"NA",PR:"NA",TT:"NA",BB:"NA",BS:"NA",
  // Güney Amerika
  BR:"SA",AR:"SA",CL:"SA",CO:"SA",VE:"SA",PE:"SA",EC:"SA",BO:"SA",PY:"SA",
  UY:"SA",GY:"SA",SR:"SA",
  // Okyanusya
  AU:"OC",NZ:"OC",FJ:"OC",PG:"OC",SB:"OC",VU:"OC",WS:"OC",TO:"OC",
};

export function getContinents(countryCodes: string[]): Set<string> {
  const result = new Set<string>();
  for (const cc of countryCodes) {
    const c = CONTINENT_MAP[cc];
    if (c) result.add(c);
  }
  return result;
}

// ─── Tüm başarımlar ───────────────────────────────────────────────────────────

export const ALL_ACHIEVEMENTS: Achievement[] = [
  // ── Uçuş sayısı ───────────────────────────────────────────────────────────
  { id: "first_flight",    emoji: "✈️",  name: "İlk Kalkış",           description: "İlk uçuşunu tamamla",                   rarity: "common"    },
  { id: "flights_5",       emoji: "🛫",  name: "Havacı Adayı",         description: "5 uçuş tamamla",                        rarity: "common"    },
  { id: "flights_10",      emoji: "🎖️",  name: "Kabin Mürettebatı",    description: "10 uçuş tamamla",                       rarity: "common"    },
  { id: "flights_25",      emoji: "👨‍✈️", name: "Deneyimli Pilot",      description: "25 uçuş tamamla",                       rarity: "rare"      },
  { id: "flights_50",      emoji: "⭐",  name: "Kaptan",                description: "50 uçuş tamamla",                       rarity: "epic"      },
  { id: "flights_100",     emoji: "🏆",  name: "Efsane",                description: "100 uçuş tamamla",                      rarity: "legendary" },
  { id: "flights_200",     emoji: "🌠",  name: "Uçuş Efsanesi",        description: "200 uçuş tamamla",                      rarity: "legendary" },

  // ── Odak süresi ───────────────────────────────────────────────────────────
  { id: "focus_600",       emoji: "⏱️",  name: "Odaklanmış",           description: "10 saat odak süresi",                   rarity: "common"    },
  { id: "focus_1200",      emoji: "🎯",  name: "Odak Maratonu",        description: "20 saat odak süresi",                   rarity: "rare"      },
  { id: "focus_3000",      emoji: "🔬",  name: "Odak Ustası",          description: "50 saat odak süresi",                   rarity: "rare"      },
  { id: "focus_6000",      emoji: "⌛",  name: "Zaman Yöneticisi",     description: "100 saat odak süresi",                  rarity: "epic"      },
  { id: "focus_12000",     emoji: "🌌",  name: "200 Saat",              description: "200 saat odak süresi",                  rarity: "epic"      },
  { id: "focus_18000",     emoji: "💫",  name: "Zamansız",              description: "300 saat odak süresi",                  rarity: "legendary" },

  // ── Seri ──────────────────────────────────────────────────────────────────
  { id: "streak_3",        emoji: "🔥",  name: "Ateş",                  description: "3 günlük seri yap",                     rarity: "common"    },
  { id: "streak_7",        emoji: "🌟",  name: "Haftanın Pilotu",       description: "7 günlük seri yap",                     rarity: "rare"      },
  { id: "streak_14",       emoji: "🔥🔥", name: "İki Hafta",            description: "14 günlük seri yap",                    rarity: "rare"      },
  { id: "streak_21",       emoji: "💪",  name: "Üç Hafta",              description: "21 günlük seri yap",                    rarity: "epic"      },
  { id: "streak_30",       emoji: "💎",  name: "Aylık Kahraman",        description: "30 günlük seri yap",                    rarity: "epic"      },
  { id: "streak_60",       emoji: "🌙",  name: "2 Aylık Pilot",         description: "60 günlük seri yap",                    rarity: "legendary" },
  { id: "streak_100",      emoji: "👑",  name: "100 Gün Pilotu",        description: "100 günlük seri yap",                   rarity: "legendary" },

  // ── Ülke / kıta ───────────────────────────────────────────────────────────
  { id: "intl_first",      emoji: "🛂",  name: "Uluslararası",          description: "İlk uluslararası uçuş",                 rarity: "common"    },
  { id: "countries_5",     emoji: "🗺️",  name: "Haritacı",              description: "5 farklı ülke ziyaret et",              rarity: "rare"      },
  { id: "countries_10",    emoji: "🌍",  name: "Dünya Gezgini",         description: "10 farklı ülke ziyaret et",             rarity: "epic"      },
  { id: "countries_15",    emoji: "✈️🌍", name: "Keşif Yolcusu",        description: "15 farklı ülke ziyaret et",             rarity: "rare"      },
  { id: "countries_20",    emoji: "🌐",  name: "Küresel Vatandaş",      description: "20 farklı ülke ziyaret et",             rarity: "legendary" },
  { id: "countries_25",    emoji: "🗺️✨", name: "Uluslararası Pilot",   description: "25 farklı ülke ziyaret et",             rarity: "epic"      },
  { id: "continents_2",    emoji: "🗾",  name: "Kıta Hopper",           description: "2 farklı kıtayı ziyaret et",            rarity: "common"    },
  { id: "continents_4",    emoji: "🌎",  name: "Kıta Gezgini",          description: "4 farklı kıtayı ziyaret et",            rarity: "epic"      },
  { id: "continents_6",    emoji: "🚀",  name: "Dünya Turu",            description: "6 farklı kıtayı ziyaret et",            rarity: "legendary" },

  // ── Tek uçuş özellikleri (süre) ───────────────────────────────────────────
  { id: "speed_sprint",    emoji: "⚡",  name: "Hız Koşusu",            description: "30 dakikalık uçuş tamamla",             rarity: "common"    },
  { id: "long_6h",         emoji: "🌅",  name: "Uzun Mesafe",           description: "6 saatlik uçuş tamamla",                rarity: "rare"      },
  { id: "long_8h",         emoji: "🌃",  name: "Geceye Uzanan",         description: "8 saatlik uçuş tamamla",                rarity: "epic"      },
  { id: "long_12h",        emoji: "🌙",  name: "Geceyi Geçiren",        description: "12 saatlik uçuş tamamla",               rarity: "epic"      },
  { id: "ultra_long",      emoji: "🌌",  name: "Sonsuzluğa Yolculuk",  description: "10+ saatlik uçuş tamamla",              rarity: "legendary" },

  // ── Zaman bazlı ───────────────────────────────────────────────────────────
  { id: "night_owl",       emoji: "🦉",  name: "Gece Pilotu",           description: "Gece 23:00–04:00 arası uçuş tamamla",  rarity: "rare"      },
  { id: "early_bird",      emoji: "🐦",  name: "Sabah Kuşu",            description: "Sabah 05:00–08:00 arası uçuş tamamla", rarity: "rare"      },
  { id: "weekend_warrior", emoji: "🏖️",  name: "Hafta Sonu Savaşçısı", description: "Cumartesi veya Pazar uçuş tamamla",     rarity: "common"    },

  // ── Özel ──────────────────────────────────────────────────────────────────
  { id: "notes_keeper",    emoji: "📝",  name: "Kabin Günlüğü",         description: "5 uçuşu notla tamamla",                 rarity: "rare"      },
  { id: "comeback",        emoji: "💫",  name: "Geri Döndüm",           description: "Seri sıfırlandıktan sonra yeniden başla", rarity: "rare"    },
  { id: "globetrotter",    emoji: "🌍✈", name: "Gezgin Ruh",            description: "Aynı haftada 5 farklı ülkeye uç",       rarity: "epic"      },
];

// ─── Kontrol fonksiyonu ───────────────────────────────────────────────────────

export function checkNewAchievements(
  profile: UserProfile,
  history: CompletedFlight[],
  stamps: Stamp[],
  earned: string[]
): Achievement[] {
  const earnedSet = new Set(earned);
  const newOnes: Achievement[] = [];

  // ── Temel hesaplamalar ─────────────────────────────────────────────────────
  const uniqueCountries = Array.from(new Set(stamps.map((s) => s.countryCode)));
  const continents      = getContinents(uniqueCountries);
  const maxDuration     = history.length > 0
    ? Math.max(...history.map((h) => h.durationMinutes))
    : 0;
  const hasIntl    = stamps.length > 0;
  const notedCount = history.filter((h) => h.notes && h.notes.trim().length > 0).length;

  // ── Zaman bazlı hesaplamalar ───────────────────────────────────────────────
  let hasNightFlight   = false;
  let hasEarlyFlight   = false;
  let hasWeekendFlight = false;

  for (const h of history) {
    const d    = new Date(h.completedAt);
    const hour = d.getHours();
    const day  = d.getDay(); // 0=Pazar, 6=Cumartesi
    if (hour >= 23 || hour < 4)  hasNightFlight   = true;
    if (hour >= 5  && hour < 8)  hasEarlyFlight   = true;
    if (day === 0  || day === 6) hasWeekendFlight = true;
  }

  // ── Globetrotter: aynı haftada 5 farklı ülke ─────────────────────────────
  let hasGlobetrotter = false;
  if (uniqueCountries.length >= 5) {
    // Pazar başlangıçlı ISO hafta gruplama
    const byWeek = new Map<string, Set<string>>();
    for (const s of stamps) {
      const d   = new Date(s.timestamp);
      const mon = new Date(d);
      mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Pazartesi'ye snap
      const wk  = mon.toISOString().slice(0, 10);
      if (!byWeek.has(wk)) byWeek.set(wk, new Set());
      byWeek.get(wk)!.add(s.countryCode);
    }
    for (const countries of byWeek.values()) {
      if (countries.size >= 5) { hasGlobetrotter = true; break; }
    }
  }

  // ── Comeback: en az bir seri kopuğu sonrası yeni seri ─────────────────────
  // Toplam uçuş 10'dan fazla AMA longestStreak hiç > currentStreak + 5 ise
  // (yani eskiden daha uzun seri vardı, şimdi daha kısaysa kopuk var)
  const hasComeback =
    profile.totalFlights >= 5 &&
    profile.currentStreak >= 1 &&
    profile.longestStreak > profile.currentStreak;

  // ── Tüm kontroller ────────────────────────────────────────────────────────
  const checks: [string, boolean][] = [
    // Uçuş sayısı
    ["first_flight",     profile.totalFlights >= 1],
    ["flights_5",        profile.totalFlights >= 5],
    ["flights_10",       profile.totalFlights >= 10],
    ["flights_25",       profile.totalFlights >= 25],
    ["flights_50",       profile.totalFlights >= 50],
    ["flights_100",      profile.totalFlights >= 100],
    ["flights_200",      profile.totalFlights >= 200],
    // Odak süresi
    ["focus_600",        profile.totalFocusMinutes >= 600],
    ["focus_1200",       profile.totalFocusMinutes >= 1200],
    ["focus_3000",       profile.totalFocusMinutes >= 3000],
    ["focus_6000",       profile.totalFocusMinutes >= 6000],
    ["focus_12000",      profile.totalFocusMinutes >= 12000],
    ["focus_18000",      profile.totalFocusMinutes >= 18000],
    // Seri
    ["streak_3",         profile.longestStreak >= 3],
    ["streak_7",         profile.longestStreak >= 7],
    ["streak_14",        profile.longestStreak >= 14],
    ["streak_21",        profile.longestStreak >= 21],
    ["streak_30",        profile.longestStreak >= 30],
    ["streak_60",        profile.longestStreak >= 60],
    ["streak_100",       profile.longestStreak >= 100],
    // Ülke / kıta
    ["intl_first",       hasIntl],
    ["countries_5",      uniqueCountries.length >= 5],
    ["countries_10",     uniqueCountries.length >= 10],
    ["countries_15",     uniqueCountries.length >= 15],
    ["countries_20",     uniqueCountries.length >= 20],
    ["countries_25",     uniqueCountries.length >= 25],
    ["continents_2",     continents.size >= 2],
    ["continents_4",     continents.size >= 4],
    ["continents_6",     continents.size >= 6],
    // Süre (tek oturum)
    ["speed_sprint",     history.some((h) => h.durationMinutes <= 30)],
    ["long_6h",          maxDuration >= 360],
    ["long_8h",          maxDuration >= 480],
    ["long_12h",         maxDuration >= 720],
    ["ultra_long",       maxDuration >= 600],
    // Zaman bazlı
    ["night_owl",        hasNightFlight],
    ["early_bird",       hasEarlyFlight],
    ["weekend_warrior",  hasWeekendFlight],
    // Özel
    ["notes_keeper",     notedCount >= 5],
    ["comeback",         hasComeback],
    ["globetrotter",     hasGlobetrotter],
  ];

  for (const [id, condition] of checks) {
    if (condition && !earnedSet.has(id)) {
      const achievement = ALL_ACHIEVEMENTS.find((a) => a.id === id);
      if (achievement) newOnes.push(achievement);
    }
  }

  return newOnes;
}
