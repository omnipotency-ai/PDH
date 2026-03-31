import { useState, useRef } from "react";

// ─── DESIGN TOKENS ────────────────────────────────────────────────
const tokens = {
  light: {
    "surface-base": "#F8FAFC", "surface-card": "#FFFFFF", "surface-raised": "#F1F5F9",
    "surface-overlay": "rgba(15, 23, 42, 0.5)",
    "text-primary": "#0F172A", "text-secondary": "#475569", "text-tertiary": "#94A3B8", "text-inverse": "#F8FAFC",
    "border-default": "#E2E8F0", "border-strong": "#CBD5E1",
    "status-danger": "#DC2626", "status-danger-soft": "#FEE2E2",
    "status-caution": "#EA580C", "status-caution-soft": "#FFF7ED",
    "status-safe": "#16A34A", "status-safe-soft": "#F0FDF4",
    "status-untested": "#94A3B8", "status-untested-soft": "#F1F5F9",
    "cat-output": "#0D9488", "cat-output-soft": "#CCFBF1",
    "cat-wellness": "#7C3AED", "cat-wellness-soft": "#EDE9FE",
    "cat-ai": "#4338CA", "cat-ai-soft": "#E0E7FF",
    "cat-experiment": "#1E3A5F", "cat-experiment-soft": "#DBEAFE",
    "cat-food": "#0284C7", "cat-food-soft": "#E0F2FE",
    "cat-activity": "#059669", "cat-activity-soft": "#D1FAE5",
    "cat-habit": "#CA8A04", "cat-habit-soft": "#FEF9C3",
  },
  dark: {
    "surface-base": "#0B1120", "surface-card": "#111827", "surface-raised": "#1E293B",
    "surface-overlay": "rgba(0, 0, 0, 0.65)",
    "text-primary": "#F1F5F9", "text-secondary": "#94A3B8", "text-tertiary": "#64748B", "text-inverse": "#0F172A",
    "border-default": "#1E293B", "border-strong": "#334155",
    "status-danger": "#F87171", "status-danger-soft": "rgba(248,113,113,0.15)",
    "status-caution": "#FB923C", "status-caution-soft": "rgba(251,146,60,0.15)",
    "status-safe": "#4ADE80", "status-safe-soft": "rgba(74,222,128,0.12)",
    "status-untested": "#64748B", "status-untested-soft": "rgba(100,116,139,0.2)",
    "cat-output": "#2DD4BF", "cat-output-soft": "rgba(45,212,191,0.15)",
    "cat-wellness": "#A78BFA", "cat-wellness-soft": "rgba(167,139,250,0.15)",
    "cat-ai": "#818CF8", "cat-ai-soft": "rgba(129,140,248,0.15)",
    "cat-experiment": "#60A5FA", "cat-experiment-soft": "rgba(96,165,250,0.12)",
    "cat-food": "#38BDF8", "cat-food-soft": "rgba(56,189,248,0.12)",
    "cat-activity": "#34D399", "cat-activity-soft": "rgba(52,211,153,0.12)",
    "cat-habit": "#FACC15", "cat-habit-soft": "rgba(250,204,21,0.12)",
  },
};
const c = (theme, token) => tokens[theme]?.[token] ?? "#FF00FF";

// ─── BRISTOL SCALE ILLUSTRATIONS ──────────────────────────────────
const BRISTOL_DATA = [
  { type: 1, label: "Hard lumps", desc: "Separate hard lumps, like nuts", colorKey: "danger",
    shapes: (mid) => [
      { el: "circle", cx: mid-7, cy: mid-5, r: 4.5, fill: "#f87171", op: 0.75 },
      { el: "circle", cx: mid+5, cy: mid-3, r: 4, fill: "#f87171", op: 0.65 },
      { el: "circle", cx: mid-3, cy: mid+5, r: 5, fill: "#f87171", op: 0.85 },
      { el: "circle", cx: mid+7, cy: mid+4, r: 3.5, fill: "#f87171", op: 0.55 },
      { el: "circle", cx: mid, cy: mid-8, r: 3.5, fill: "#f87171", op: 0.65 },
    ]},
  { type: 2, label: "Lumpy sausage", desc: "Sausage-shaped but lumpy", colorKey: "caution",
    shapes: (mid) => [
      { el: "path", d: `M${mid-11},${mid} Q${mid-11},${mid-6} ${mid-6},${mid-6} Q${mid-2},${mid-8} ${mid+2},${mid-6} Q${mid+6},${mid-8} ${mid+11},${mid-5} Q${mid+13},${mid} ${mid+11},${mid+5} Q${mid+6},${mid+8} ${mid+2},${mid+6} Q${mid-2},${mid+8} ${mid-6},${mid+6} Q${mid-11},${mid+6} ${mid-11},${mid} Z`, fill: "#fb923c", op: 0.7 },
      { el: "circle", cx: mid-5, cy: mid-2, r: 2.2, fill: "#fdba74", op: 0.5 },
      { el: "circle", cx: mid+3, cy: mid+1, r: 2.8, fill: "#fdba74", op: 0.4 },
    ]},
  { type: 3, label: "Cracked sausage", desc: "Like a sausage with cracks", colorKey: "safe",
    shapes: (mid) => [
      { el: "rect", x: mid-12, y: mid-5, w: 24, h: 10, rx: 5, fill: "#34d399", op: 0.75 },
      { el: "line", x1: mid-4, y1: mid-4.5, x2: mid-3, y2: mid-1, stroke: "#6ee7b7", sw: 1.2, op: 0.65 },
      { el: "line", x1: mid+2, y1: mid-4.5, x2: mid+3, y2: mid-1, stroke: "#6ee7b7", sw: 1.2, op: 0.65 },
      { el: "line", x1: mid+7, y1: mid-3.5, x2: mid+6, y2: mid, stroke: "#6ee7b7", sw: 1.2, op: 0.55 },
    ]},
  { type: 4, label: "Smooth snake", desc: "Smooth, soft sausage (ideal)", colorKey: "safe",
    shapes: (mid) => [
      { el: "rect", x: mid-13, y: mid-5, w: 26, h: 10, rx: 5, fill: "#34d399", op: 0.8 },
      { el: "ellipse", cx: mid, cy: mid, rx: 11, ry: 3.8, fill: "#6ee7b7", op: 0.35 },
    ]},
  { type: 5, label: "Soft blobs", desc: "Soft blobs with clear edges", colorKey: "safe",
    shapes: (mid) => [
      { el: "ellipse", cx: mid-6, cy: mid-3, rx: 5.5, ry: 4.5, fill: "#84cc16", op: 0.65 },
      { el: "ellipse", cx: mid+5, cy: mid-1, rx: 5, ry: 4, fill: "#84cc16", op: 0.55 },
      { el: "ellipse", cx: mid-2, cy: mid+4, rx: 6, ry: 4.5, fill: "#a3e635", op: 0.7 },
    ]},
  { type: 6, label: "Mushy", desc: "Fluffy pieces with ragged edges", colorKey: "caution",
    shapes: (mid) => [
      { el: "ellipse", cx: mid, cy: mid, rx: 13, ry: 9, fill: "#fb923c", op: 0.4 },
      { el: "ellipse", cx: mid-3, cy: mid-2, rx: 7, ry: 5, fill: "#fb923c", op: 0.3 },
      { el: "ellipse", cx: mid+4, cy: mid+2, rx: 5.5, ry: 3.5, fill: "#fdba74", op: 0.3 },
      { el: "circle", cx: mid-6, cy: mid+1, r: 2.5, fill: "#fdba74", op: 0.3 },
    ]},
  { type: 7, label: "Liquid", desc: "Watery, no solid pieces", colorKey: "danger",
    shapes: (mid) => [
      { el: "ellipse", cx: mid, cy: mid+2, rx: 14, ry: 8, fill: "#f87171", op: 0.3 },
      { el: "ellipse", cx: mid-4, cy: mid, rx: 9, ry: 6, fill: "#f87171", op: 0.25 },
      { el: "ellipse", cx: mid+3, cy: mid+1, rx: 7, ry: 4.5, fill: "#fca5a5", op: 0.25 },
      { el: "circle", cx: mid+7, cy: mid-4, r: 2.2, fill: "#fca5a5", op: 0.4 },
      { el: "circle", cx: mid-8, cy: mid-3, r: 1.8, fill: "#fca5a5", op: 0.35 },
    ]},
];

function BristolIllustration({ type, size = 40 }) {
  const data = BRISTOL_DATA.find(b => b.type === type);
  if (!data) return null;
  const mid = size / 2;
  const shapes = data.shapes(mid);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {shapes.map((s, i) => {
        if (s.el === "circle") return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} opacity={s.op} />;
        if (s.el === "ellipse") return <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={s.fill} opacity={s.op} />;
        if (s.el === "rect") return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={s.fill} opacity={s.op} />;
        if (s.el === "line") return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.sw} opacity={s.op} strokeLinecap="round" />;
        if (s.el === "path") return <path key={i} d={s.d} fill={s.fill} opacity={s.op} />;
        return null;
      })}
    </svg>
  );
}

// ─── SMALL ICONS ──────────────────────────────────────────────────
const Icon = ({ name, size = 22, color = "currentColor" }) => {
  const s = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "home": return <svg {...s}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
    case "book": return <svg {...s}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
    case "chart": return <svg {...s}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
    case "sparkle": return <svg {...s}><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/></svg>;
    case "settings": return <svg {...s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case "sun": return <svg {...s} width={18} height={18}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
    case "moon": return <svg {...s} width={18} height={18}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
    case "plus": return <svg {...s} strokeWidth={2.5} width={28} height={28}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
    case "x": return <svg {...s} strokeWidth={2} width={20} height={20}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    case "mic": return <svg {...s} width={16} height={16}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>;
    case "clock": return <svg {...s} width={16} height={16}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case "send": return <svg {...s} width={18} height={18}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
    case "coffee": return <svg {...s} width={20} height={20}><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>;
    case "output": return <svg {...s} width={20} height={20}><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
    case "activity": return <svg {...s} width={20} height={20}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
    case "sleep": return <svg {...s} width={20} height={20}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
    case "pill": return <svg {...s} width={20} height={20}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
    case "star": return <svg {...s} width={20} height={20}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case "minus": return <svg {...s} width={16} height={16}><line x1="5" y1="12" x2="19" y2="12"/></svg>;
    case "check": return <svg {...s} width={16} height={16}><polyline points="20 6 9 17 4 12"/></svg>;
    case "alert": return <svg {...s} width={16} height={16}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    default: return null;
  }
};

// ─── MAIN APP ──────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState("dark");
  const [activeTab, setActiveTab] = useState("today");
  const [fabOpen, setFabOpen] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState(null);
  const [view, setView] = useState("app");
  const g = (token) => c(theme, token);

  const fabItems = [
    { id: "food", label: "Food & Drink", icon: "coffee", color: g("cat-food"), bg: g("cat-food-soft"), angle: -150 },
    { id: "output", label: "Output", icon: "output", color: g("cat-output"), bg: g("cat-output-soft"), angle: -120 },
    { id: "activity", label: "Activity", icon: "activity", color: g("cat-activity"), bg: g("cat-activity-soft"), angle: -90 },
    { id: "wellness", label: "Wellness", icon: "sleep", color: g("cat-wellness"), bg: g("cat-wellness-soft"), angle: -60 },
    { id: "meds", label: "Meds", icon: "pill", color: g("status-safe"), bg: g("status-safe-soft"), angle: -30 },
    { id: "habit", label: "Habits", icon: "star", color: g("cat-habit"), bg: g("cat-habit-soft"), angle: 0 },
  ];

  return (
    <div style={{ background: g("surface-base"), color: g("text-primary"), minHeight: "100vh", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', transition: "background 0.3s, color 0.3s", maxWidth: 430, margin: "0 auto", position: "relative", overflow: "hidden" }}>
      {/* ─── TOP BAR ───────────────────────────── */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: `1px solid ${g("border-default")}`, background: g("surface-card"), position: "sticky", top: 0, zIndex: 50 }}>
        <div>
          <div style={{ fontSize: 11, color: g("text-tertiary"), letterSpacing: 1, fontWeight: 600, textTransform: "uppercase" }}>CACA TRACA</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 1 }}>
            {view === "app" ? (activeTab === "today" ? "Today" : activeTab === "library" ? "Library" : activeTab === "trends" ? "Trends" : "AI Coach") : view === "tokens" ? "Design Tokens" : "Components"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 2, background: g("surface-raised"), borderRadius: 8, padding: 2 }}>
            {[{ id: "app", label: "App" }, { id: "tokens", label: "Tokens" }, { id: "components", label: "UI" }].map((v) => (
              <button key={v.id} onClick={() => setView(v.id)} style={{ padding: "5px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", background: view === v.id ? g("surface-card") : "transparent", color: view === v.id ? g("text-primary") : g("text-tertiary"), boxShadow: view === v.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                {v.label}
              </button>
            ))}
          </div>
          <IconBtn icon="settings" color={g("text-secondary")} bg={g("surface-raised")} border={g("border-default")} />
          <IconBtn icon={theme === "dark" ? "sun" : "moon"} color={g("text-secondary")} bg={g("surface-raised")} border={g("border-default")} onClick={() => setTheme(p => p === "dark" ? "light" : "dark")} />
        </div>
      </header>

      {/* ─── CONTENT ────────────────────────────── */}
      <main style={{ padding: "16px 20px", paddingBottom: 120, minHeight: "calc(100vh - 140px)" }}>
        {view === "tokens" && <TokensView g={g} />}
        {view === "components" && <ComponentsView g={g} theme={theme} />}
        {view === "app" && activeTab === "today" && <TodayView g={g} />}
        {view === "app" && activeTab === "library" && <LibraryView g={g} />}
        {view === "app" && activeTab === "trends" && <TrendsView g={g} />}
        {view === "app" && activeTab === "coach" && <CoachView g={g} />}
      </main>

      {/* ─── FAB OVERLAY ────────────────────────── */}
      {fabOpen && <div onClick={() => setFabOpen(false)} style={{ position: "fixed", inset: 0, background: g("surface-overlay"), zIndex: 90, maxWidth: 430, margin: "0 auto" }} />}

      {/* ─── FAB RADIAL ─────────────────────────── */}
      {fabOpen && fabItems.map((item, i) => {
        const radius = 105;
        const rad = (item.angle * Math.PI) / 180;
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;
        return (
          <div key={item.id} onClick={() => { setFabOpen(false); setActiveDrawer(item.id); }} style={{ position: "fixed", bottom: `calc(44px + ${-y}px)`, left: `calc(50% + ${x}px - 26px)`, zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", animation: `fabIn 0.22s ${i * 0.03}s both ease-out` }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: item.bg, border: `2px solid ${item.color}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0,0,0,0.25)" }}>
              <Icon name={item.icon} size={22} color={item.color} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{item.label}</span>
          </div>
        );
      })}

      {/* ─── TAB BAR ────────────────────────────── */}
      <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: g("surface-card"), borderTop: `1px solid ${g("border-default")}`, display: "flex", alignItems: "flex-end", justifyContent: "space-around", padding: "0 4px", paddingBottom: 8, zIndex: 100 }}>
        <Tab icon="home" label="Today" active={activeTab === "today" && view === "app"} color={g("cat-food")} muted={g("text-tertiary")} onClick={() => { setActiveTab("today"); setView("app"); }} />
        <Tab icon="book" label="Library" active={activeTab === "library" && view === "app"} color={g("status-safe")} muted={g("text-tertiary")} onClick={() => { setActiveTab("library"); setView("app"); }} />
        <div style={{ position: "relative", top: -16 }}>
          <button onClick={() => setFabOpen(!fabOpen)} style={{ width: 56, height: 56, borderRadius: 18, border: "none", background: fabOpen ? g("status-danger") : `linear-gradient(135deg, ${g("cat-food")}, ${g("cat-output")})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.3)", transition: "transform 0.2s", transform: fabOpen ? "rotate(45deg)" : "rotate(0)" }}>
            <Icon name="plus" size={28} color="#fff" />
          </button>
          <div style={{ textAlign: "center", marginTop: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: g("text-tertiary") }}>Track</span>
          </div>
        </div>
        <Tab icon="chart" label="Trends" active={activeTab === "trends" && view === "app"} color={g("cat-experiment")} muted={g("text-tertiary")} onClick={() => { setActiveTab("trends"); setView("app"); }} />
        <Tab icon="sparkle" label="AI" active={activeTab === "coach" && view === "app"} color={g("cat-ai")} muted={g("text-tertiary")} onClick={() => { setActiveTab("coach"); setView("app"); }} />
      </nav>

      {/* ─── DRAWER ─────────────────────────────── */}
      {activeDrawer && (
        activeDrawer === "output"
          ? <OutputDrawer g={g} theme={theme} onClose={() => setActiveDrawer(null)} />
          : <GenericDrawer g={g} drawerId={activeDrawer} onClose={() => setActiveDrawer(null)} />
      )}

      <style>{`
        @keyframes fabIn { from { opacity:0; transform: scale(0.3) translateY(20px); } to { opacity:1; transform: scale(1) translateY(0); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
        input:focus { outline: none; }
      `}</style>
    </div>
  );
}

function IconBtn({ icon, color, bg, border, onClick }) {
  return (
    <button onClick={onClick} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color }}>
      <Icon name={icon} size={16} color={color} />
    </button>
  );
}

function Tab({ icon, label, active, color, muted, onClick }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "10px 10px", cursor: "pointer", color: active ? color : muted, minWidth: 52 }}>
      <div style={{ opacity: active ? 1 : 0.55 }}><Icon name={icon} size={22} color={active ? color : muted} /></div>
      <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{label}</span>
    </button>
  );
}

// ─── OUTPUT DRAWER (DEEP SLICE) ───────────────────────────────────
function OutputDrawer({ g, theme, onClose }) {
  const [bristol, setBristol] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [urgency, setUrgency] = useState(null);
  const [effort, setEffort] = useState(null);
  const [volume, setVolume] = useState(null);
  const [accident, setAccident] = useState(false);
  const [episodes, setEpisodes] = useState(1);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const bristolColor = (type) => {
    if (type <= 2) return g("status-caution");
    if (type <= 5) return g("status-safe");
    if (type === 6) return g("status-caution");
    return g("status-danger");
  };

  const bristolBg = (type) => {
    if (type <= 2) return g("status-caution-soft");
    if (type <= 5) return g("status-safe-soft");
    if (type === 6) return g("status-caution-soft");
    return g("status-danger-soft");
  };

  if (saved) {
    return (
      <>
        <div onClick={onClose} style={{ position: "fixed", inset: 0, background: g("surface-overlay"), zIndex: 110, maxWidth: 430, margin: "0 auto" }} />
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: g("surface-card"), borderTopLeftRadius: 20, borderTopRightRadius: 20, zIndex: 120, animation: "slideUp 0.25s ease-out", padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: g("cat-output") }}>Output logged</div>
          <div style={{ fontSize: 14, color: g("text-secondary"), marginTop: 6, lineHeight: 1.5 }}>Bristol {bristol} · {BRISTOL_DATA[bristol-1]?.label}</div>
          <div style={{ fontSize: 13, color: g("text-tertiary"), marginTop: 12 }}>Your coach will check in if anything looks unusual.</div>
          <button onClick={onClose} style={{ marginTop: 20, padding: "12px 32px", borderRadius: 12, border: "none", background: g("cat-output"), color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Done</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: g("surface-overlay"), zIndex: 110, maxWidth: 430, margin: "0 auto", animation: "fadeIn 0.15s ease-out" }} />
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: g("surface-card"), borderTopLeftRadius: 20, borderTopRightRadius: 20, zIndex: 120, animation: "slideUp 0.25s ease-out", maxHeight: "92vh", overflow: "auto" }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: g("border-strong") }} />
        </div>

        {/* Header */}
        <div style={{ padding: "4px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: g("cat-output") }}>Log Output</h3>
            <div style={{ fontSize: 12, color: g("text-tertiary"), marginTop: 2 }}>Tap a Bristol type to start</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: g("text-tertiary"), cursor: "pointer", padding: 4 }}>
            <Icon name="x" size={20} color={g("text-tertiary")} />
          </button>
        </div>

        {/* Bristol Scale Cards — Primary Selection */}
        <div style={{ padding: "0 16px 12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {BRISTOL_DATA.slice(0, 4).map(b => (
              <BristolCard key={b.type} b={b} selected={bristol === b.type} onClick={() => setBristol(b.type)} g={g} bristolColor={bristolColor} bristolBg={bristolBg} />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
            {BRISTOL_DATA.slice(4).map(b => (
              <BristolCard key={b.type} b={b} selected={bristol === b.type} onClick={() => setBristol(b.type)} g={g} bristolColor={bristolColor} bristolBg={bristolBg} />
            ))}
          </div>
        </div>

        {/* Spectrum bar */}
        {bristol && (
          <div style={{ padding: "0 20px 16px" }}>
            <div style={{ position: "relative", height: 6, borderRadius: 3, background: `linear-gradient(to right, ${g("status-caution")}, ${g("status-safe")}, ${g("status-safe")}, ${g("status-caution")}, ${g("status-danger")})`, overflow: "visible" }}>
              <div style={{ position: "absolute", left: `${((bristol - 1) / 6) * 100}%`, top: -5, width: 16, height: 16, borderRadius: 8, background: bristolColor(bristol), border: `2px solid ${g("surface-card")}`, boxShadow: "0 2px 6px rgba(0,0,0,0.3)", transition: "left 0.2s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontSize: 10, color: g("text-tertiary") }}>Hard</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: bristolColor(bristol) }}>{BRISTOL_DATA[bristol - 1].desc}</span>
              <span style={{ fontSize: 10, color: g("text-tertiary") }}>Liquid</span>
            </div>
          </div>
        )}

        {/* Progressive disclosure: details only after Bristol selected */}
        {bristol && (
          <div style={{ padding: "0 20px" }}>
            {/* Quick save row */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button onClick={() => setSaved(true)} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: g("cat-output"), color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: `0 4px 12px ${g("cat-output")}40` }}>
                Save · Bristol {bristol}
              </button>
              <button onClick={() => setExpanded(!expanded)} style={{ padding: "14px 16px", borderRadius: 14, border: `1.5px solid ${g("border-default")}`, background: "transparent", color: g("text-secondary"), fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                {expanded ? "Less" : "+ Details"}
              </button>
            </div>

            {/* Expanded detail fields */}
            {expanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>
                {/* Urgency */}
                <FieldSection label="Urgency" g={g}>
                  <ChipRow items={[
                    { id: "none", label: "None", color: g("status-safe") },
                    { id: "mild", label: "Mild", color: g("status-safe") },
                    { id: "moderate", label: "Moderate", color: g("status-caution") },
                    { id: "urgent", label: "Urgent", color: g("status-caution") },
                    { id: "accident", label: "Emergency", color: g("status-danger") },
                  ]} selected={urgency} onSelect={setUrgency} g={g} />
                </FieldSection>

                {/* Effort */}
                <FieldSection label="Effort" g={g}>
                  <ChipRow items={[
                    { id: "none", label: "Easy", color: g("status-safe") },
                    { id: "some", label: "Some strain", color: g("status-caution") },
                    { id: "hard", label: "Hard to pass", color: g("status-caution") },
                    { id: "release", label: "Urgent release", color: g("status-danger") },
                  ]} selected={effort} onSelect={setEffort} g={g} />
                </FieldSection>

                {/* Volume + Accident + Episodes row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <FieldSection label="Amount" g={g}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {[{ id: "small", label: "Small", sym: "•" }, { id: "moderate", label: "Medium", sym: "••" }, { id: "large", label: "Large", sym: "•••" }].map(v => (
                        <button key={v.id} onClick={() => setVolume(v.id)} style={{ padding: "8px", borderRadius: 8, border: `1.5px solid ${volume === v.id ? g("cat-output") : g("border-default")}`, background: volume === v.id ? g("cat-output-soft") : "transparent", color: volume === v.id ? g("cat-output") : g("text-secondary"), fontWeight: 600, fontSize: 12, cursor: "pointer", textAlign: "center" }}>
                          {v.sym} {v.label}
                        </button>
                      ))}
                    </div>
                  </FieldSection>

                  <FieldSection label="Accident" g={g}>
                    <button onClick={() => setAccident(!accident)} style={{ width: "100%", padding: "12px", borderRadius: 10, border: `2px solid ${accident ? g("status-danger") : g("border-default")}`, background: accident ? g("status-danger-soft") : "transparent", color: accident ? g("status-danger") : g("text-tertiary"), fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44 }}>
                      <Icon name="alert" size={16} color={accident ? g("status-danger") : g("text-tertiary")} />
                      {accident ? "Yes" : "No"}
                    </button>
                  </FieldSection>

                  <FieldSection label="Episodes" g={g}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44 }}>
                      <button onClick={() => setEpisodes(Math.max(1, episodes - 1))} style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${g("border-default")}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: g("text-secondary") }}>
                        <Icon name="minus" size={14} color={g("text-secondary")} />
                      </button>
                      <span style={{ fontSize: 20, fontWeight: 800, color: g("cat-output"), minWidth: 24, textAlign: "center" }}>{episodes}</span>
                      <button onClick={() => setEpisodes(Math.min(20, episodes + 1))} style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${g("border-default")}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: g("text-secondary") }}>
                        <Icon name="plus" size={14} color={g("text-secondary")} />
                      </button>
                    </div>
                  </FieldSection>
                </div>

                {/* Notes */}
                <FieldSection label="Notes (optional)" g={g}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="How did it feel? Any observations?" maxLength={400} style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${g("border-default")}`, background: g("surface-raised"), color: g("text-primary"), fontSize: 14 }} />
                    <button style={{ width: 44, height: 44, borderRadius: 12, border: `1.5px solid ${g("border-default")}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="mic" size={16} color={g("text-tertiary")} />
                    </button>
                  </div>
                </FieldSection>

                {/* Time */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="clock" size={14} color={g("text-tertiary")} />
                  <span style={{ fontSize: 13, color: g("text-secondary") }}>Just now</span>
                  <button style={{ background: "none", border: "none", color: g("cat-output"), fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Change time</button>
                </div>

                {/* Save with details */}
                <button onClick={() => setSaved(true)} style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", background: g("cat-output"), color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer", boxShadow: `0 4px 16px ${g("cat-output")}40`, marginBottom: 8 }}>
                  Save output
                </button>
              </div>
            )}
          </div>
        )}

        {!bristol && <div style={{ height: 20 }} />}
      </div>
    </>
  );
}

function BristolCard({ b, selected, onClick, g, bristolColor, bristolBg }) {
  return (
    <button onClick={onClick} style={{ padding: "10px 6px 8px", borderRadius: 14, border: `2px solid ${selected ? bristolColor(b.type) : g("border-default")}`, background: selected ? bristolBg(b.type) : g("surface-card"), textAlign: "center", cursor: "pointer", transition: "all 0.15s", transform: selected ? "scale(1.04)" : "scale(1)" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
        <BristolIllustration type={b.type} size={36} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: selected ? bristolColor(b.type) : g("text-primary") }}>{b.type}</div>
      <div style={{ fontSize: 9, color: selected ? bristolColor(b.type) : g("text-tertiary"), fontWeight: 500, marginTop: 1 }}>{b.label}</div>
    </button>
  );
}

function FieldSection({ label, g, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: g("text-tertiary"), textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function ChipRow({ items, selected, onSelect, g }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {items.map(item => (
        <button key={item.id} onClick={() => onSelect(selected === item.id ? null : item.id)} style={{ padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${selected === item.id ? item.color : g("border-default")}`, background: selected === item.id ? `${item.color}18` : "transparent", color: selected === item.id ? item.color : g("text-secondary"), fontWeight: 600, fontSize: 12, cursor: "pointer", minHeight: 38 }}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ─── GENERIC DRAWER ───────────────────────────────────────────────
function GenericDrawer({ g, drawerId, onClose }) {
  const cfg = {
    food: { title: "Food & Drink", color: g("cat-food"), presets: ["White toast", "Scrambled eggs", "Banana", "Plain rice", "Chicken broth", "Water", "Peppermint tea", "Yogurt"], placeholder: "What did you eat or drink?" },
    activity: { title: "Activity", color: g("cat-activity"), presets: ["Walking 15min", "Yoga", "Gentle stretching", "Cycling", "Swimming", "Housework"], placeholder: "What activity?" },
    wellness: { title: "Wellness & Sleep", color: g("cat-wellness"), presets: ["Slept well", "Interrupted sleep", "Nap 30min", "Feeling stressed", "Relaxed", "Anxious"], placeholder: "How are you feeling?" },
    meds: { title: "Medication", color: g("status-safe"), presets: ["Loperamide", "Paracetamol", "Codeine", "Omeprazole", "Multivitamin", "Iron"], placeholder: "Which medication?" },
    habit: { title: "Habits & Stimulants", color: g("cat-habit"), presets: ["Coffee", "Tea", "Decaf", "Alcohol", "Energy drink", "Cigarette"], placeholder: "Log a habit..." },
  }[drawerId] || { title: "Log", color: g("cat-food"), presets: [], placeholder: "..." };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: g("surface-overlay"), zIndex: 110, maxWidth: 430, margin: "0 auto", animation: "fadeIn 0.15s ease-out" }} />
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: g("surface-card"), borderTopLeftRadius: 20, borderTopRightRadius: 20, zIndex: 120, animation: "slideUp 0.25s ease-out", maxHeight: "70vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: g("border-strong") }} />
        </div>
        <div style={{ padding: "4px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: cfg.color }}>{cfg.title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: g("text-tertiary"), cursor: "pointer" }}>
            <Icon name="x" size={20} color={g("text-tertiary")} />
          </button>
        </div>

        <div style={{ padding: "0 20px 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: g("text-tertiary"), textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Quick add</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {cfg.presets.map(p => (
              <button key={p} style={{ padding: "9px 14px", borderRadius: 12, border: `1.5px solid ${cfg.color}30`, background: `${cfg.color}10`, color: cfg.color, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{p}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: "12px 20px 20px" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder={cfg.placeholder} style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: `1.5px solid ${g("border-default")}`, background: g("surface-raised"), color: g("text-primary"), fontSize: 15 }} />
            <button style={{ padding: "12px 20px", borderRadius: 12, border: "none", background: cfg.color, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Save</button>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 12, justifyContent: "center" }}>
            <MiniAction icon="mic" label="Voice" color={g("text-tertiary")} />
            <MiniAction icon="clock" label="Backdate" color={g("text-tertiary")} />
          </div>
        </div>
      </div>
    </>
  );
}

function MiniAction({ icon, label, color }) {
  return (
    <button style={{ background: "none", border: "none", color, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
      <Icon name={icon} size={14} color={color} />{label}
    </button>
  );
}

// ─── TODAY VIEW ───────────────────────────────────────────────────
function TodayView({ g }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Recovery header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: g("surface-raised"), borderRadius: 14, border: `1px solid ${g("border-default")}` }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: g("cat-output-soft"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🩺</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Week 5 · Stage 2</div>
          <div style={{ fontSize: 12, color: g("text-secondary") }}>Low-Residue Expansion</div>
        </div>
        <div style={{ padding: "5px 10px", borderRadius: 8, background: g("status-safe-soft"), color: g("status-safe"), fontSize: 11, fontWeight: 700 }}>Stable</div>
      </div>

      {/* Main question */}
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>What can I eat today?</h2>
        <p style={{ fontSize: 13, color: g("text-secondary"), marginTop: 2 }}>3 gentle options based on your tolerance history</p>
      </div>

      {/* Food suggestions */}
      {[
        { food: "Scrambled eggs on white toast", reason: "Tolerated 4 times · Your go-to anchor", confidence: "High", emoji: "🍳", status: "safe" },
        { food: "Banana with yogurt", reason: "Gentle, binding · Good for your tendency", confidence: "High", emoji: "🍌", status: "safe" },
        { food: "Chicken noodle soup", reason: "Soft protein + hydration · Stage 2", confidence: "Medium", emoji: "🍜", status: "safe" },
      ].map((s, i) => (
        <div key={i} style={{ padding: 14, borderRadius: 14, background: g("surface-card"), border: `1.5px solid ${g("border-default")}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: g("cat-food-soft"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{s.emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{s.food}</div>
            <div style={{ fontSize: 12, color: g("text-secondary"), marginTop: 2 }}>{s.reason}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <span style={{ padding: "2px 8px", borderRadius: 6, background: g("status-safe-soft"), color: g("status-safe"), fontSize: 10, fontWeight: 700 }}>{s.confidence}</span>
            </div>
          </div>
          <button style={{ padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${g("cat-food")}`, background: "transparent", color: g("cat-food"), fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>Log</button>
        </div>
      ))}

      {/* Experiment suggestion */}
      <div style={{ padding: 14, borderRadius: 14, background: g("cat-experiment-soft"), border: `1.5px solid ${g("cat-experiment")}30` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: g("surface-card"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, border: `1px solid ${g("border-default")}` }}>🥕</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: g("cat-experiment") }}>Ready to test?</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Cooked carrots</div>
            <div style={{ fontSize: 11, color: g("text-secondary"), marginTop: 2 }}>Stage 2 · Low gas · Soft texture</div>
          </div>
          <button style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${g("cat-experiment")}`, background: "transparent", color: g("cat-experiment"), fontWeight: 700, fontSize: 11, cursor: "pointer" }}>Start</button>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatCard label="Tendency" value="Slightly loose" sub="Past 48h" color={g("status-caution")} g={g} />
        <StatCard label="Last output" value="Bristol 5 · 2h ago" sub="Moderate amount" color={g("cat-output")} g={g} />
      </div>

      {/* Streak */}
      <div style={{ padding: 14, borderRadius: 14, background: g("surface-card"), border: `1px solid ${g("border-default")}`, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${g("status-caution-soft")}, ${g("cat-habit-soft")})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🔥</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>5-day check-in rhythm</div>
          <div style={{ fontSize: 12, color: g("text-secondary") }}>Building a great picture of your recovery</div>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {[1,2,3,4,5,6,7].map(d => <div key={d} style={{ width: 6, height: 16, borderRadius: 3, background: d <= 5 ? g("cat-output") : g("border-default") }} />)}
        </div>
      </div>

      {/* AI nudge */}
      <div style={{ padding: 14, borderRadius: 14, background: g("cat-ai-soft"), border: `1px solid ${g("cat-ai")}20` }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ fontSize: 20, marginTop: 2 }}>💡</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: g("cat-ai") }}>Coach says</div>
            <div style={{ fontSize: 13, color: g("text-secondary"), marginTop: 2, lineHeight: 1.5 }}>Your outputs have been a bit loose today. Stick with known anchors for dinner — scrambled eggs or plain rice are your safest bets.</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: g("cat-ai"), color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Got it</button>
              <button style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${g("cat-ai")}30`, background: "transparent", color: g("cat-ai"), fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Ask more</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, g }) {
  return (
    <div style={{ padding: 14, borderRadius: 14, background: g("surface-card"), border: `1px solid ${g("border-default")}` }}>
      <div style={{ fontSize: 10, color: g("text-tertiary"), fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: g("text-secondary"), marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ─── LIBRARY VIEW ─────────────────────────────────────────────────
function LibraryView({ g }) {
  const [activeStage, setActiveStage] = useState("All");
  const foods = [
    { name: "White toast", stage: 1, status: "safe", tries: 8, emoji: "🍞", cat: "Gentle Starches" },
    { name: "Scrambled eggs", stage: 1, status: "safe", tries: 6, emoji: "🍳", cat: "Soft Proteins" },
    { name: "Banana", stage: 2, status: "safe", tries: 5, emoji: "🍌", cat: "Soft Fruits" },
    { name: "Cooked carrots", stage: 2, status: "untested", tries: 0, emoji: "🥕", cat: "Cooked Vegetables" },
    { name: "Plain yogurt", stage: 1, status: "safe", tries: 4, emoji: "🥛", cat: "Dairy" },
    { name: "Chicken broth", stage: 0, status: "safe", tries: 12, emoji: "🍵", cat: "Hydration" },
    { name: "Blueberries", stage: 3, status: "caution", tries: 1, emoji: "🫐", cat: "Moderate Challenge" },
    { name: "Regular coffee", stage: 4, status: "danger", tries: 2, emoji: "☕", cat: "Higher Challenge" },
  ];
  const sc = (s) => s === "safe" ? g("status-safe") : s === "caution" ? g("status-caution") : s === "danger" ? g("status-danger") : g("status-untested");
  const sb = (s) => s === "safe" ? g("status-safe-soft") : s === "caution" ? g("status-caution-soft") : s === "danger" ? g("status-danger-soft") : g("status-untested-soft");
  const sl = (s) => s === "safe" ? "Tolerated" : s === "caution" ? "Watch" : s === "danger" ? "Trigger" : "Untested";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input placeholder="Search foods..." style={{ padding: "12px 16px", borderRadius: 12, border: `1.5px solid ${g("border-default")}`, background: g("surface-raised"), color: g("text-primary"), fontSize: 15, width: "100%" }} />
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        {["All", "Stage 0/1", "Stage 2", "Stage 3", "Stage 4"].map(s => (
          <button key={s} onClick={() => setActiveStage(s)} style={{ padding: "7px 14px", borderRadius: 20, border: `1.5px solid ${activeStage === s ? g("cat-food") : g("border-default")}`, background: activeStage === s ? g("cat-food-soft") : "transparent", color: activeStage === s ? g("cat-food") : g("text-secondary"), fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{s}</button>
        ))}
      </div>
      {foods.map((f, i) => (
        <div key={i} style={{ padding: 12, borderRadius: 14, background: g("surface-card"), border: `1px solid ${g("border-default")}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: g("surface-raised"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{f.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</div>
            <div style={{ fontSize: 11, color: g("text-secondary") }}>Stage {f.stage} · {f.cat} · {f.tries > 0 ? `${f.tries}x` : "Not tried"}</div>
          </div>
          <span style={{ padding: "4px 10px", borderRadius: 8, background: sb(f.status), color: sc(f.status), fontSize: 10, fontWeight: 700 }}>{sl(f.status)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── TRENDS VIEW ──────────────────────────────────────────────────
function TrendsView({ g }) {
  const data = [4,5,3,4,5,6,4,5,3,4,5,4,3,5];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ padding: 16, borderRadius: 14, background: g("surface-card"), border: `1px solid ${g("border-default")}` }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Am I trending looser or harder?</div>
        <div style={{ fontSize: 13, color: g("text-secondary"), marginBottom: 12 }}>Slightly loose this week — Bristol avg 4.3 vs 3.8 last week</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 70 }}>
          {data.map((v,i) => (
            <div key={i} style={{ flex: 1, height: `${(v/7)*100}%`, borderRadius: "3px 3px 0 0", background: v<=2 ? g("status-caution") : v<=5 ? g("status-safe") : g("status-danger"), opacity: i >= 7 ? 1 : 0.35, minHeight: 3 }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 10, color: g("text-tertiary") }}>Last week</span>
          <span style={{ fontSize: 10, color: g("text-tertiary") }}>This week</span>
        </div>
      </div>
      {[
        { q: "How did new foods go?", a: "Cooked carrots tolerated well (2 trials). Blueberries caused loose output once.", color: g("cat-experiment") },
        { q: "What's most tolerated?", a: "White toast, scrambled eggs, bananas, plain rice — your strongest anchors.", color: g("status-safe") },
        { q: "What about caffeine?", a: "Coffee triggered urgency both times. Tea was fine.", color: g("status-caution") },
      ].map((card, i) => (
        <div key={i} style={{ padding: 16, borderRadius: 14, background: g("surface-card"), border: `1px solid ${g("border-default")}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: card.color, marginBottom: 4 }}>{card.q}</div>
          <div style={{ fontSize: 13, color: g("text-secondary"), lineHeight: 1.5 }}>{card.a}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: g("cat-ai"), fontWeight: 600, cursor: "pointer" }}>View details →</div>
        </div>
      ))}
    </div>
  );
}

// ─── COACH VIEW ───────────────────────────────────────────────────
function CoachView({ g }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ textAlign: "center", padding: "12px 0" }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: g("cat-ai-soft"), border: `2px solid ${g("cat-ai")}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 26 }}>🧠</div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Your Recovery Coach</div>
        <div style={{ fontSize: 12, color: g("text-secondary") }}>Warm Coach · Persistent conversation</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
        {["What's safe for dinner?", "Review my week", "Help me test a food", "Make a meal plan"].map(p => (
          <button key={p} style={{ padding: "8px 12px", borderRadius: 12, border: `1.5px solid ${g("cat-ai")}30`, background: g("cat-ai-soft"), color: g("cat-ai"), fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{p}</button>
        ))}
      </div>

      {/* Proactive nudge */}
      <div style={{ padding: 12, borderRadius: 14, background: g("cat-ai-soft"), border: `1px solid ${g("cat-ai")}20`, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ fontSize: 16, marginTop: 2 }}>🔔</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: g("cat-ai") }}>Coach wants to check in</div>
          <div style={{ fontSize: 13, color: g("text-secondary"), marginTop: 2 }}>I noticed your last two outputs were Bristol 5-6. Want to talk about what might help firm things up?</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: g("cat-ai"), color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Let's talk</button>
            <button style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${g("cat-ai")}30`, background: "transparent", color: g("cat-ai"), fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Later</button>
          </div>
        </div>
      </div>

      {/* Chat messages */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ alignSelf: "flex-end", padding: "10px 14px", borderRadius: "14px 14px 4px 14px", background: g("cat-ai"), color: "#fff", fontSize: 14, maxWidth: "80%" }}>
          What should I have for dinner tonight?
        </div>
        <div style={{ alignSelf: "flex-start", padding: "12px 14px", borderRadius: "14px 14px 14px 4px", background: g("surface-card"), border: `1px solid ${g("border-default")}`, fontSize: 13, maxWidth: "88%", lineHeight: 1.6 }}>
          <div style={{ marginBottom: 8 }}>Given your tendency has been a bit loose today, I'd stick with your proven anchors:</div>
          {["🍳 Scrambled eggs on white toast — your safest bet", "🍚 Plain rice with shredded chicken", "🍜 Turkey rice soup — warm and soothing"].map((item, i) => (
            <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>{item}</div>
          ))}
          <div style={{ fontSize: 12, color: g("text-secondary"), marginTop: 8 }}>All Stage 2 safe · Based on your tolerance data</div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ padding: "4px 10px", borderRadius: 8, background: g("cat-food-soft"), color: g("cat-food"), fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Log a meal</span>
            <span style={{ padding: "4px 10px", borderRadius: 8, background: g("cat-ai-soft"), color: g("cat-ai"), fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Full meal plan</span>
            <span style={{ padding: "4px 10px", borderRadius: 8, background: g("cat-habit-soft"), color: g("cat-habit"), fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Shopping list</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <input placeholder="Ask your coach..." style={{ flex: 1, padding: "12px 16px", borderRadius: 14, border: `1.5px solid ${g("border-default")}`, background: g("surface-raised"), color: g("text-primary"), fontSize: 14 }} />
        <button style={{ width: 44, height: 44, borderRadius: 14, border: "none", background: g("cat-ai"), color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="send" size={18} color="#fff" />
        </button>
      </div>
    </div>
  );
}

// ─── TOKENS VIEW ──────────────────────────────────────────────────
function TokensView({ g }) {
  const sections = [
    { title: "Status Colors", items: [
      { token: "status-danger", label: "Danger / Trigger", desc: "Risky foods, safety alerts" },
      { token: "status-caution", label: "Caution / Watch", desc: "Watch foods, uncertain outcomes" },
      { token: "status-safe", label: "Safe / Tolerated", desc: "Confirmed safe foods" },
      { token: "status-untested", label: "Untested", desc: "No data yet, greyed out" },
    ]},
    { title: "Category Colors", items: [
      { token: "cat-food", label: "Food & Drink", desc: "Sky — meal logging" },
      { token: "cat-output", label: "Bowel Movements", desc: "Teal — Bristol scale, outputs" },
      { token: "cat-activity", label: "Activity", desc: "Emerald — exercise, movement" },
      { token: "cat-wellness", label: "Wellness & Sleep", desc: "Violet — rest, mental state" },
      { token: "cat-ai", label: "AI Coach", desc: "Indigo — insights, intelligence" },
      { token: "cat-experiment", label: "Experiments", desc: "Navy — testing new foods" },
      { token: "cat-habit", label: "Habits & Stimulants", desc: "Yellow/amber — coffee, misc" },
    ]},
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ fontSize: 14, color: g("text-secondary"), lineHeight: 1.6 }}>Semantic color system — every color has a purpose. Toggle dark/light to see both palettes.</div>
      {sections.map(section => (
        <div key={section.title}>
          <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: g("text-tertiary"), marginBottom: 10 }}>{section.title}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {section.items.map(item => (
              <div key={item.token} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, background: g("surface-card"), border: `1px solid ${g("border-default")}` }}>
                <div style={{ display: "flex", gap: 4 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: g(item.token) }} />
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: g(`${item.token}-soft`), border: `1px solid ${g("border-default")}` }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: g("text-secondary") }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── COMPONENTS VIEW ──────────────────────────────────────────────
function ComponentsView({ g, theme }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Bristol Scale */}
      <div>
        <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: g("text-tertiary"), marginBottom: 10 }}>Bristol Scale Cards</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {BRISTOL_DATA.slice(0,4).map(b => {
            const col = b.type <= 2 ? g("status-caution") : g("status-safe");
            return (
              <div key={b.type} style={{ padding: "10px 6px 8px", borderRadius: 14, border: `2px solid ${col}30`, background: g("surface-card"), textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}><BristolIllustration type={b.type} size={36} /></div>
                <div style={{ fontSize: 16, fontWeight: 800, color: col }}>{b.type}</div>
                <div style={{ fontSize: 9, color: g("text-tertiary") }}>{b.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
          {BRISTOL_DATA.slice(4).map(b => {
            const col = b.type === 5 ? g("status-safe") : b.type === 6 ? g("status-caution") : g("status-danger");
            return (
              <div key={b.type} style={{ padding: "10px 6px 8px", borderRadius: 14, border: `2px solid ${col}30`, background: g("surface-card"), textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}><BristolIllustration type={b.type} size={36} /></div>
                <div style={{ fontSize: 16, fontWeight: 800, color: col }}>{b.type}</div>
                <div style={{ fontSize: 9, color: g("text-tertiary") }}>{b.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Buttons */}
      <div>
        <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: g("text-tertiary"), marginBottom: 10 }}>Buttons</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: g("cat-food"), color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Primary</button>
          <button style={{ padding: "10px 20px", borderRadius: 12, border: `1.5px solid ${g("cat-food")}`, background: "transparent", color: g("cat-food"), fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Outline</button>
          <button style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: g("surface-raised"), color: g("text-secondary"), fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Ghost</button>
          <button style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: g("status-danger"), color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Danger</button>
        </div>
      </div>

      {/* Zone Chips */}
      <div>
        <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: g("text-tertiary"), marginBottom: 10 }}>Zone Chips</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { label: "Stage 0 — Clear", color: g("status-untested"), bg: g("status-untested-soft") },
            { label: "Stage 1 — Gentle", color: g("status-safe"), bg: g("status-safe-soft") },
            { label: "Stage 2 — Expanding", color: g("cat-food"), bg: g("cat-food-soft") },
            { label: "Stage 3 — Testing", color: g("cat-experiment"), bg: g("cat-experiment-soft") },
            { label: "Stage 4 — Personal", color: g("cat-ai"), bg: g("cat-ai-soft") },
          ].map(chip => (
            <span key={chip.label} style={{ padding: "5px 11px", borderRadius: 20, background: chip.bg, color: chip.color, fontSize: 11, fontWeight: 700, border: `1px solid ${chip.color}25` }}>{chip.label}</span>
          ))}
        </div>
      </div>

      {/* Confidence + Reason */}
      <div>
        <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: g("text-tertiary"), marginBottom: 10 }}>Badges & Pills</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ padding: "4px 10px", borderRadius: 8, background: g("status-safe-soft"), color: g("status-safe"), fontSize: 11, fontWeight: 700 }}>High confidence</span>
          <span style={{ padding: "4px 10px", borderRadius: 8, background: g("status-caution-soft"), color: g("status-caution"), fontSize: 11, fontWeight: 700 }}>Medium</span>
          <span style={{ padding: "4px 10px", borderRadius: 8, background: g("status-untested-soft"), color: g("status-untested"), fontSize: 11, fontWeight: 700 }}>Low</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["Based on recent outputs", "New food", "Contains caffeine", "Binding", "High fiber"].map(r => (
            <span key={r} style={{ padding: "4px 10px", borderRadius: 10, background: g("surface-raised"), border: `1px solid ${g("border-default")}`, color: g("text-secondary"), fontSize: 11 }}>{r}</span>
          ))}
        </div>
      </div>

      {/* Safety banner */}
      <div>
        <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: g("text-tertiary"), marginBottom: 10 }}>Safety Banner</h3>
        <div style={{ padding: 14, borderRadius: 14, background: g("status-danger-soft"), border: `2px solid ${g("status-danger")}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 24 }}>⚠️</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: g("status-danger") }}>Contact your aftercare team</div>
            <div style={{ fontSize: 12, color: g("text-secondary"), marginTop: 2 }}>The symptoms you described may need medical attention.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
