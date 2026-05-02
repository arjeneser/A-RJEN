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
  MK:"Kuzey Makedonya",GB:"Birleşik Krallık",US:"ABD",UY:"Uruguay",UZ:"Özbekistan",
  VE:"Venezuela",YE:"Yemen",ZM:"Zambia",AZ:"Azerbaycan",AM:"Ermenistan",
  BA:"Bosna Hersek",BY:"Belarus",BJ:"Benin",EE:"Estonya",
};

// ── 5 renk paleti (hepsi amber/altın ailesi, birbirinden ayırt edilebilir) ──
const VISITED_PALETTE = [
  { fill: "#C8882A", stroke: "rgba(200,136,42,0.55)",  hover: "#E0A038" }, // sıcak amber
  { fill: "#A87E20", stroke: "rgba(168,126,32,0.55)",  hover: "#C09228" }, // koyu altın
  { fill: "#D4960E", stroke: "rgba(212,150,14,0.55)",  hover: "#EAA818" }, // parlak sarı-amber
  { fill: "#B86A18", stroke: "rgba(184,106,24,0.55)",  hover: "#D07E28" }, // turuncu-amber
  { fill: "#9A9028", stroke: "rgba(154,144,40,0.55)",  hover: "#B4A830" }, // zeytin-altın
];

// Deterministik renk indeksi: komşu ülkeler farklı renk alır (sayısal ID'ye göre)
function visitedColorIndex(numericId: string): number {
  const n = parseInt(numericId, 10);
  // Basit hash benzeri dağılım — komşular genellikle ardışık ID'ye sahip değil
  return ((n * 2654435761) >>> 0) % VISITED_PALETTE.length;
}

interface VisitedMapProps {
  visitedCountryCodes: string[];
}

export const VisitedMap = memo(function VisitedMap({ visitedCountryCodes }: VisitedMapProps) {
  const visited    = new Set(visitedCountryCodes.map((c) => c.toUpperCase()));
  const containerRef = useRef<HTMLDivElement>(null);
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
              const id   = String(geo.id ?? "").padStart(3, "0");
              const a2   = N2A[id];
              const isTR      = a2 === "TR";
              const isVisited = a2 ? visited.has(a2) : false;

              let fill: string;
              let stroke: string;
              let hoverFill: string;

              if (isTR) {
                fill      = "#C8102E";
                stroke    = "rgba(255,120,120,0.5)";
                hoverFill = "#E8182E";
              } else if (isVisited) {
                const palette = VISITED_PALETTE[visitedColorIndex(id)];
                fill      = palette.fill;
                stroke    = palette.stroke;
                hoverFill = palette.hover;
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
                    setTooltip({
                      name,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                    });
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

      {/* ── Hover tooltip ─────────────────────────────────────────────── */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
          style={{
            left:       tooltip.x + 12,
            top:        tooltip.y - 28,
            background: "rgba(8,13,28,0.92)",
            border:     "1px solid rgba(200,136,42,0.35)",
            color:      "#D4A050",
            backdropFilter: "blur(6px)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
          }}
        >
          {tooltip.name}
        </div>
      )}

      {/* ── Legend ────────────────────────────────────────────────────── */}
      <div
        className="absolute bottom-2.5 left-3 flex items-center gap-4 px-3 py-1.5 rounded-xl"
        style={{ background: "rgba(8,13,28,0.88)", backdropFilter: "blur(8px)" }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#C8102E" }} />
          <span className="text-[10px] text-slate-400">Türkiye</span>
        </div>
        <div className="flex items-center gap-4 items-center">
          {VISITED_PALETTE.slice(0, 3).map((p, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: p.fill }} />
              {i === 0 && <span className="text-[10px] text-slate-400">Ziyaret edildi</span>}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#1A2540" }} />
          <span className="text-[10px] text-slate-400">Keşfedilmedi</span>
        </div>
      </div>

      {/* ── Badge ─────────────────────────────────────────────────────── */}
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
