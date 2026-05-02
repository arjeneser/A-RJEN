"use client";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — no official types; runtime is fine
import { ComposableMap, Geographies, Geography, Sphere, Graticule } from "react-simple-maps";
import { memo, useState, useRef, useCallback } from "react";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ISO numeric (3-digit string) → ISO alpha-2
const N2A: Record<string, string> = {
  "004":"AF","008":"AL","012":"DZ","024":"AO","032":"AR","036":"AU","040":"AT",
  "050":"BD","056":"BE","064":"BT","068":"BO","076":"BR","100":"BG","104":"MM",
  "116":"KH","120":"CM","124":"CA","144":"LK","152":"CL","156":"CN","170":"CO",
  "180":"CD","191":"HR","192":"CU","196":"CY","203":"CZ","208":"DK","218":"EC",
  "818":"EG","231":"ET","246":"FI","250":"FR","266":"GA","276":"DE","288":"GH",
  "300":"GR","320":"GT","332":"HT","340":"HN","348":"HU","356":"IN","360":"ID",
  "364":"IR","368":"IQ","372":"IE","376":"IL","380":"IT","388":"JM","392":"JP",
  "398":"KZ","400":"JO","404":"KE","408":"KP","410":"KR","414":"KW","418":"LA",
  "422":"LB","428":"LV","434":"LY","440":"LT","458":"MY","466":"ML","478":"MR",
  "484":"MX","498":"MD","499":"ME","504":"MA","508":"MZ","524":"NP","528":"NL",
  "540":"NC","554":"NZ","558":"NI","562":"NE","566":"NG","578":"NO","586":"PK",
  "591":"PA","598":"PG","600":"PY","604":"PE","608":"PH","616":"PL","620":"PT",
  "630":"PR","634":"QA","642":"RO","643":"RU","682":"SA","686":"SN","688":"RS",
  "694":"SL","703":"SK","704":"VN","705":"SI","706":"SO","710":"ZA","716":"ZW",
  "724":"ES","729":"SD","752":"SE","756":"CH","760":"SY","762":"TJ","764":"TH",
  "784":"AE","792":"TR","800":"UG","804":"UA","807":"MK","826":"GB","840":"US",
  "858":"UY","860":"UZ","862":"VE","887":"YE","894":"ZM","031":"AZ","051":"AM",
  "070":"BA","112":"BY","204":"BJ","233":"EE",
};

// ISO alpha-2 → Türkçe ülke adı
const COUNTRY_NAMES: Record<string, string> = {
  AF:"Afganistan",AL:"Arnavutluk",DZ:"Cezayir",AO:"Angola",AR:"Arjantin",
  AU:"Avustralya",AT:"Avusturya",BD:"Bangladeş",BE:"Belçika",BT:"Butan",
  BO:"Bolivya",BR:"Brezilya",BG:"Bulgaristan",MM:"Myanmar",KH:"Kamboçya",
  CM:"Kamerun",CA:"Kanada",LK:"Sri Lanka",CL:"Şili",CN:"Çin",CO:"Kolombiya",
  CD:"Kongo",HR:"Hırvatistan",CU:"Küba",CY:"Kıbrıs",CZ:"Çekya",DK:"Danimarka",
  EC:"Ekvador",EG:"Mısır",ET:"Etiyopya",FI:"Finlandiya",FR:"Fransa",GA:"Gabon",
  DE:"Almanya",GH:"Gana",GR:"Yunanistan",GT:"Guatemala",HT:"Haiti",HN:"Honduras",
  HU:"Macaristan",IN:"Hindistan",ID:"Endonezya",IR:"İran",IQ:"Irak",IE:"İrlanda",
  IL:"İsrail",IT:"İtalya",JM:"Jamaika",JP:"Japonya",KZ:"Kazakistan",JO:"Ürdün",
  KE:"Kenya",KP:"Kuzey Kore",KR:"Güney Kore",KW:"Kuveyt",LA:"Laos",LB:"Lübnan",
  LV:"Letonya",LY:"Libya",LT:"Litvanya",MY:"Malezya",ML:"Mali",MR:"Moritanya",
  MX:"Meksika",MD:"Moldova",ME:"Karadağ",MA:"Fas",MZ:"Mozambik",NP:"Nepal",
  NL:"Hollanda",NZ:"Yeni Zelanda",NI:"Nikaragua",NE:"Nijer",NG:"Nijerya",
  NO:"Norveç",PK:"Pakistan",PA:"Panama",PG:"Papua Yeni Gine",PY:"Paraguay",
  PE:"Peru",PH:"Filipinler",PL:"Polonya",PT:"Portekiz",QA:"Katar",RO:"Romanya",
  RU:"Rusya",SA:"Suudi Arabistan",SN:"Senegal",RS:"Sırbistan",SL:"Sierra Leone",
  SK:"Slovakya",VN:"Vietnam",SI:"Slovenya",SO:"Somali",ZA:"Güney Afrika",
  ZW:"Zimbabwe",ES:"İspanya",SD:"Sudan",SE:"İsveç",CH:"İsviçre",SY:"Suriye",
  TJ:"Tacikistan",TH:"Tayland",AE:"BAE",TR:"Türkiye",UG:"Uganda",UA:"Ukrayna",
  MK:"Kuzey Makedonya",GB:"İngiltere",US:"ABD",UY:"Uruguay",UZ:"Özbekistan",
  VE:"Venezuela",YE:"Yemen",ZM:"Zambia",AZ:"Azerbaycan",AM:"Ermenistan",
  BA:"Bosna Hersek",BY:"Belarus",BJ:"Benin",EE:"Estonya",
  GE:"Gürcistan",KG:"Kırgızistan",TM:"Türkmenistan",
  TN:"Tunus",OM:"Umman",BH:"Bahreyn",MT:"Malta",
};

// ── 4 renk paleti — birbirinden net farklı, koyu tema uyumlu ──────────────────
//   0 → yeşil-teal   1 → çelik mavi   2 → amber   3 → lavanta mor
const PALETTE = [
  { fill: "#4E9070", stroke: "rgba(78,144,112,0.6)",  hover: "#5EAA84" }, // yeşil
  { fill: "#3D78B0", stroke: "rgba(61,120,176,0.6)",  hover: "#4E90CC" }, // mavi
  { fill: "#C8882A", stroke: "rgba(200,136,42,0.6)",  hover: "#E0A038" }, // amber
  { fill: "#8864A8", stroke: "rgba(136,100,168,0.6)", hover: "#A07CC2" }, // mor
];

// ── Manuel renk ataması — komşu ülkeler farklı renk alır ─────────────────────
// 0=yeşil  1=mavi  2=amber  3=mor
const COLOR_MAP: Record<string, number> = {
  // Türkiye ve çevresi
  TR:2, GR:0, BG:1, RO:3, UA:2, RU:1, MD:0, BY:3,
  GE:0, AM:3, AZ:1, IR:3, IQ:0, SY:1,
  // Ortadoğu
  IL:2, JO:0, LB:3, SA:0, KW:3, QA:2, AE:1, OM:0, YE:3, BH:1,
  // Kuzey Afrika
  EG:1, LY:0, TN:2, DZ:3, MA:1, SD:0, ET:2, SO:3,
  // Orta Asya
  KZ:2, UZ:0, TM:3, TJ:1, KG:2, AF:0, PK:3,
  // Avrupa
  GB:0, IE:2, FR:3, ES:1, PT:2, IT:0, CH:3, AT:1, DE:2, NL:0, BE:3,
  DK:1, SE:2, NO:0, FI:3, EE:1, LV:2, LT:0,
  PL:1, CZ:2, SK:0, HU:3, HR:1, SI:2, RS:0, BA:3, ME:1, AL:2, MK:0,
  MT:1, CY:0, IS:3, LI:1, MC:2, LU:0,
  // Asya & Pasifik
  CN:1, JP:2, KR:0, KP:3, IN:1, BD:2, LK:0, MM:3, TH:1, VN:2,
  MY:0, ID:3, PH:1, AU:2, NZ:0,
  // Sahra Altı Afrika
  NG:1, GH:2, KE:0, TZ:3, ZA:1, MZ:2, ZM:0, ZW:3, UG:1, RW:2,
  CD:0, AO:3, CM:1, SN:2, ML:0, MR:3, BJ:1, GA:2,
  // Amerika
  US:3, CA:1, MX:2, BR:0, AR:3, CL:1, PE:2, CO:0, VE:3, UY:1,
  PY:2, BO:0, EC:3, CU:1, JM:2,
};

function getColorIndex(a2: string): number {
  if (a2 in COLOR_MAP) return COLOR_MAP[a2];
  // Bilinmeyen ülkeler için basit hash
  let h = 0;
  for (let i = 0; i < a2.length; i++) h = (h * 31 + a2.charCodeAt(i)) & 0xffff;
  return h % 4;
}

interface VisitedMapProps {
  visitedCountryCodes: string[];
}

export const VisitedMap = memo(function VisitedMap({ visitedCountryCodes }: VisitedMapProps) {
  const visited       = new Set(visitedCountryCodes.map((c) => c.toUpperCase()));
  const containerRef  = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ name: string; x: number; y: number } | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip((prev) =>
      prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : prev
    );
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl overflow-hidden relative select-none"
      style={{ background: "#080D1C" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTooltip(null)}
    >
      <ComposableMap
        projectionConfig={{ scale: 155, center: [10, 5] }}
        style={{ width: "100%", height: "auto" }}
      >
        <Sphere id="rsm-sphere" fill="#0C1428" stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />
        <Graticule stroke="rgba(255,255,255,0.03)" strokeWidth={0.4} />

        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo: any) => {
              const id        = String(geo.id ?? "").padStart(3, "0");
              const a2        = N2A[id];
              const isTR      = a2 === "TR";
              const isVisited = a2 ? visited.has(a2) : false;

              let fill: string, stroke: string, hoverFill: string;

              if (isTR) {
                fill      = "#C8102E";
                stroke    = "rgba(255,120,120,0.5)";
                hoverFill = "#E8182E";
              } else if (isVisited && a2) {
                const p   = PALETTE[getColorIndex(a2)];
                fill      = p.fill;
                stroke    = p.stroke;
                hoverFill = p.hover;
              } else {
                fill      = "#1A2540";
                stroke    = "rgba(255,255,255,0.06)";
                hoverFill = "#263050";
              }

              const name = a2 ? (COUNTRY_NAMES[a2] ?? a2) : "";

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={0.4}
                  onMouseEnter={(e: React.MouseEvent) => {
                    if (!a2 || (!isVisited && !isTR)) return;
                    if (!containerRef.current) return;
                    const rect = containerRef.current.getBoundingClientRect();
                    setTooltip({ name, x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    default: { outline: "none" },
                    hover:   { outline: "none", fill: hoverFill },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {/* ── Hover tooltip ───────────────────────────────────────────────── */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
          style={{
            left:           tooltip.x + 12,
            top:            tooltip.y - 28,
            background:     "rgba(8,13,28,0.95)",
            border:         "1px solid rgba(255,255,255,0.12)",
            color:          "#F1F5F9",
            backdropFilter: "blur(6px)",
            boxShadow:      "0 2px 12px rgba(0,0,0,0.6)",
          }}
        >
          {tooltip.name}
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div
        className="absolute bottom-2.5 left-3 flex items-center gap-3 px-3 py-1.5 rounded-xl"
        style={{ background: "rgba(8,13,28,0.88)", backdropFilter: "blur(8px)" }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#C8102E" }} />
          <span className="text-[10px] text-slate-400">Türkiye</span>
        </div>
        <div className="flex items-center gap-1.5">
          {PALETTE.map((p, i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-sm" style={{ background: p.fill }} />
          ))}
          <span className="text-[10px] text-slate-400">Ziyaret edildi</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#1A2540" }} />
          <span className="text-[10px] text-slate-400">Keşfedilmedi</span>
        </div>
      </div>

      {/* ── Badge ───────────────────────────────────────────────────────── */}
      <div
        className="absolute top-2.5 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold"
        style={{
          background: "rgba(200,136,42,0.15)",
          border:     "1px solid rgba(200,136,42,0.35)",
          color:      "#D4A050",
        }}
      >
        🌍 {visitedCountryCodes.length} ülke
      </div>
    </div>
  );
});
