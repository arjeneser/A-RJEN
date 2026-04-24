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
  // Uçuş sayısı
  { id: "first_flight",   emoji: "✈️",  name: "İlk Kalkış",        description: "İlk uçuşunu tamamla",          rarity: "common"    },
  { id: "flights_5",      emoji: "🛫",  name: "Havacı Adayı",      description: "5 uçuş tamamla",              rarity: "common"    },
  { id: "flights_25",     emoji: "👨‍✈️", name: "Deneyimli Pilot",   description: "25 uçuş tamamla",             rarity: "rare"      },
  { id: "flights_50",     emoji: "⭐",  name: "Kaptan",             description: "50 uçuş tamamla",             rarity: "epic"      },
  { id: "flights_100",    emoji: "🏆",  name: "Efsane",             description: "100 uçuş tamamla",            rarity: "legendary" },

  // Odak süresi
  { id: "focus_600",      emoji: "⏱️",  name: "Odaklanmış",        description: "10 saat odak süresi",         rarity: "common"    },
  { id: "focus_3000",     emoji: "🎯",  name: "Odak Ustası",       description: "50 saat odak süresi",         rarity: "rare"      },
  { id: "focus_6000",     emoji: "⌛",  name: "Zaman Yöneticisi",  description: "100 saat odak süresi",        rarity: "epic"      },
  { id: "focus_18000",    emoji: "💫",  name: "Zamansız",           description: "300 saat odak süresi",        rarity: "legendary" },

  // Seri
  { id: "streak_3",       emoji: "🔥",  name: "Ateş",               description: "3 günlük seri",               rarity: "common"    },
  { id: "streak_7",       emoji: "🌟",  name: "Haftanın Pilotu",   description: "7 günlük seri",               rarity: "rare"      },
  { id: "streak_30",      emoji: "💎",  name: "Aylık Kahraman",    description: "30 günlük seri",              rarity: "legendary" },

  // Ülke / kıta
  { id: "intl_first",     emoji: "🛂",  name: "Uluslararası",       description: "İlk uluslararası uçuş",       rarity: "common"    },
  { id: "countries_5",    emoji: "🗺️",  name: "Haritacı",           description: "5 farklı ülke ziyaret et",    rarity: "rare"      },
  { id: "countries_10",   emoji: "🌍",  name: "Dünya Gezgini",      description: "10 farklı ülke ziyaret et",   rarity: "epic"      },
  { id: "countries_20",   emoji: "🌐",  name: "Küresel Vatandaş",  description: "20 farklı ülke ziyaret et",   rarity: "legendary" },
  { id: "continents_2",   emoji: "🗾",  name: "Kıta Hopper",        description: "2 farklı kıtayı ziyaret et",  rarity: "common"    },
  { id: "continents_4",   emoji: "🌎",  name: "Kıta Gezgini",       description: "4 farklı kıtayı ziyaret et",  rarity: "epic"      },
  { id: "continents_6",   emoji: "🚀",  name: "Dünya Turu",         description: "6 farklı kıtayı ziyaret et",  rarity: "legendary" },

  // Tek uçuş özellikleri
  { id: "long_12h",       emoji: "🌙",  name: "Geceyi Geçiren",    description: "12 saatlik uçuşu tamamla",    rarity: "epic"      },
  { id: "long_6h",        emoji: "🌅",  name: "Uzun Mesafe",        description: "6 saatlik uçuşu tamamla",    rarity: "rare"      },
];

// ─── Kontrol fonksiyonu ───────────────────────────────────────────────────────

export function checkNewAchievements(
  profile: UserProfile,
  history: CompletedFlight[],
  stamps: Stamp[],
  earned: string[]   // zaten kazanılan achievement id'leri
): Achievement[] {
  const earnedSet = new Set(earned);
  const newOnes: Achievement[] = [];

  const uniqueCountries = Array.from(new Set(stamps.map((s) => s.countryCode)));
  const continents      = getContinents(uniqueCountries);
  const maxDuration     = history.length > 0
    ? Math.max(...history.map((h) => h.durationMinutes))
    : 0;
  const hasIntl = stamps.length > 0; // damga sadece uluslararasına basılıyor

  const checks: [string, boolean][] = [
    ["first_flight",  profile.totalFlights >= 1],
    ["flights_5",     profile.totalFlights >= 5],
    ["flights_25",    profile.totalFlights >= 25],
    ["flights_50",    profile.totalFlights >= 50],
    ["flights_100",   profile.totalFlights >= 100],
    ["focus_600",     profile.totalFocusMinutes >= 600],
    ["focus_3000",    profile.totalFocusMinutes >= 3000],
    ["focus_6000",    profile.totalFocusMinutes >= 6000],
    ["focus_18000",   profile.totalFocusMinutes >= 18000],
    ["streak_3",      profile.longestStreak >= 3],
    ["streak_7",      profile.longestStreak >= 7],
    ["streak_30",     profile.longestStreak >= 30],
    ["intl_first",    hasIntl],
    ["countries_5",   uniqueCountries.length >= 5],
    ["countries_10",  uniqueCountries.length >= 10],
    ["countries_20",  uniqueCountries.length >= 20],
    ["continents_2",  continents.size >= 2],
    ["continents_4",  continents.size >= 4],
    ["continents_6",  continents.size >= 6],
    ["long_6h",       maxDuration >= 360],
    ["long_12h",      maxDuration >= 720],
  ];

  for (const [id, condition] of checks) {
    if (condition && !earnedSet.has(id)) {
      const achievement = ALL_ACHIEVEMENTS.find((a) => a.id === id);
      if (achievement) newOnes.push(achievement);
    }
  }

  return newOnes;
}
