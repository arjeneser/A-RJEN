# ✈ AIRJEN Web

**Gamified focus timer — your study sessions are now virtual flights.**

Built with Next.js 15 · TypeScript · Tailwind CSS · Framer Motion · Zustand

---

## Quick Start

```bash
cd airjen-web

# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Open http://localhost:3000
```

## Project Structure

```
airjen-web/
├── app/
│   ├── layout.tsx            # Root layout, Leaflet CSS, Navbar
│   ├── page.tsx              # Home dashboard
│   ├── new-flight/page.tsx   # 5-step booking wizard
│   ├── focus/page.tsx        # Full-screen map timer
│   ├── success/page.tsx      # Landing celebration
│   ├── passport/page.tsx     # Profile, stamps, history
│   └── globals.css           # Design system CSS
├── components/
│   ├── layout/navbar.tsx
│   ├── flight-wizard/
│   │   ├── wizard-shell.tsx       # Step navigation shell
│   │   ├── step-departure.tsx
│   │   ├── step-duration.tsx
│   │   ├── step-destination.tsx
│   │   ├── step-seat.tsx          # 24-row × 6-col cabin map
│   │   └── step-boarding-pass.tsx # Boarding pass + QR
│   └── focus/
│       └── world-map.tsx          # Leaflet map + animated plane
├── data/
│   └── cities.ts             # 50+ cities, duration options, helpers
├── hooks/
│   └── use-timer.ts          # Timer logic with pause/resume
├── lib/
│   ├── utils.ts              # Formatting, ID generation
│   └── geo.ts                # Great-circle interpolation
├── store/
│   ├── flight-store.ts       # Booking + session state (Zustand+persist)
│   └── user-store.ts         # XP, levels, streaks, passport
└── types/index.ts            # All TypeScript interfaces
```

## Features

| Feature | Status |
|---|---|
| 5-step booking wizard | ✅ |
| Real 24-row cabin seat map | ✅ |
| Boarding pass with QR code | ✅ |
| Full-screen world map (Carto dark tiles) | ✅ |
| Great-circle plane animation | ✅ |
| Session persistence (browser refresh safe) | ✅ |
| Pause / Resume timer | ✅ |
| Confetti success screen | ✅ |
| XP + Level system (5 levels) | ✅ |
| Streak system | ✅ |
| Passport stamps | ✅ |
| Flight history | ✅ |
| Dark mode (default) | ✅ |
| Glassmorphism design | ✅ |
| Framer Motion animations | ✅ |
| Mobile responsive | ✅ |

## Session Persistence

When the user closes or refreshes the browser, the session is restored:

1. Zustand `persist` middleware saves the session object to `localStorage`
2. On mount, `use-timer.ts` reads `startTime` and `totalPausedMs`
3. Elapsed = `Date.now() - startTime - totalPausedMs`
4. If elapsed ≥ duration → immediate redirect to `/success`

## Upgrading Map Tiles

Current tiles: **Carto Dark Matter** (free, no API key required).

For Mapbox (higher quality, custom styling):

```ts
// In components/focus/world-map.tsx
L.tileLayer(
  `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}@2x?access_token=${TOKEN}`,
  { tileSize: 512, zoomOffset: -1 }
).addTo(map);
```

## Adding Cities

Edit `data/cities.ts`, add to the `CITIES` array:

```ts
{
  id: "myCity",
  name: "My City",
  country: "My Country",
  countryCode: "MC",
  lat: 0.0,
  lng: 0.0,
  description: "Optional tagline",
  isDepartureHub: true, // show in departure selector
}
```

Destinations are automatically filtered by Haversine distance. No extra config.

## Gamification Levels

| Level | Flights Required |
|---|---|
| Trainee ✈️ | 0 |
| Cadet 🎖️ | 10 |
| Pilot 👨‍✈️ | 25 |
| Captain ⭐ | 50 |
| Legend 🏆 | 100 |

XP = `durationMinutes / 5` per session.

## Stack

- **Next.js 15** — App Router, server components
- **TypeScript** — strict mode
- **Tailwind CSS** — utility-first styling
- **Framer Motion** — animations throughout
- **Zustand + persist** — state + localStorage
- **Leaflet / react-leaflet** — world map (dynamic import, SSR safe)
- **canvas-confetti** — success celebration
