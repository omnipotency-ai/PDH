import { useState, useEffect, useCallback, useRef } from "react";

// ─── DESIGN TOKENS ────────────────────────────────────────────────
const tokens = {
  light: {
    // Surfaces
    "surface-base": "#F8FAFC",
    "surface-card": "#FFFFFF",
    "surface-raised": "#F1F5F9",
    "surface-overlay": "rgba(15, 23, 42, 0.4)",

    // Text
    "text-primary": "#0F172A",
    "text-secondary": "#475569",
    "text-tertiary": "#94A3B8",
    "text-inverse": "#F8FAFC",

    // Borders
    "border-default": "#E2E8F0",
    "border-strong": "#CBD5E1",

    // Semantic status
    "status-danger": "#DC2626",
    "status-danger-soft": "#FEE2E2",
    "status-caution": "#EA580C",
    "status-caution-soft": "#FFF7ED",
    "status-safe": "#16A34A",
    "status-safe-soft": "#F0FDF4",
    "status-untested": "#94A3B8",
    "status-untested-soft": "#F1F5F9",

    // Category colors
    "cat-output": "#0D9488",      // teal
    "cat-output-soft": "#CCFBF1",
    "cat-wellness": "#7C3AED",    // violet
    "cat-wellness-soft": "#EDE9FE",
    "cat-ai": "#4338CA",          // indigo
    "cat-ai-soft": "#E0E7FF",
    "cat-experiment": "#1E3A5F",  // navy
    "cat-experiment-soft": "#DBEAFE",
    "cat-food": "#0284C7",        // sky
    "cat-food-soft": "#E0F2FE",
    "cat-activity": "#059669",    // emerald
    "cat-activity-soft": "#D1FAE5",
    "cat-habit": "#CA8A04",       // yellow/amber
    "cat-habit-soft": "#FEF9C3",
  },
  dark: {
    // Surfaces
    "surface-base": "#0B1120",
    "surface-card": "#111827",
    "surface-raised": "#1E293B",
    "surface-overlay": "rgba(0, 0, 0, 0.6)",

    // Text
    "text-primary": "#F1F5F9",
    "text-secondary": "#94A3B8",
    "text-tertiary": "#64748B",
    "text-inverse": "#0F172A",

    // Borders
    "border-default": "#1E293B",
    "border-strong": "#334155",

    // Semantic status — vivid against dark
    "status-danger": "#F87171",
    "status-danger-soft": "rgba(248,113,113,0.15)",
    "status-caution": "#FB923C",
    "status-caution-soft": "rgba(251,146,60,0.15)",
    "status-safe": "#4ADE80",
    "status-safe-soft": "rgba(74,222,128,0.12)",
    "status-untested": "#64748B",
    "status-untested-soft": "rgba(100,116,139,0.2)",

    // Category colors — vivid against dark
    "cat-output": "#2DD4BF",
    "cat-output-soft": "rgba(45,212,191,0.15)",
    "cat-wellness": "#A78BFA",
    "cat-wellness-soft": "rgba(167,139,250,0.15)",
    "cat-ai": "#818CF8",
    "cat-ai-soft": "rgba(129,140,248,0.15)",
    "cat-experiment": "#60A5FA",
    "cat-experiment-soft": "rgba(96,165,250,0.12)",
    "cat-food": "#38BDF8",
    "cat-food-soft": "rgba(56,189,248,0.12)",
    "cat-activity": "#34D399",
    "cat-activity-soft": "rgba(52,211,153,0.12)",
    "cat-habit": "#FACC15",
    "cat-habit-soft": "rgba(250,204,21,0.12)",
  },
};

const t = (theme, token) => tokens[theme]?.[token] ?? "#FF00FF";

// ─── ICON COMPONENTS (simple SVG) ──────────────────────────────────
const icons = {
  sun: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
  ),
  moon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
  ),
  plus: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  ),
  x: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  ),
  home: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  book: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  chart: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  brain: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A5.5 5.5 0 0 0 4 7.5c0 1.5.5 2.8 1.3 3.8L12 21l6.7-9.7c.8-1 1.3-2.3 1.3-3.8A5.5 5.5 0 0 0 14.5 2c-1.5 0-2.8.6-3.8 1.5"/></svg>,
};

// Food/Drink icon
const FoodIcon = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
  </svg>
);
const OutputIcon = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
  </svg>
);
const ActivityIcon = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const WellnessIcon = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const MedsIcon = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
  </svg>
);
const HabitIcon = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

// ─── MAIN APP ──────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState("dark");
  const [activeTab, setActiveTab] = useState("today");
  const [fabOpen, setFabOpen] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState(null);
  const [view, setView] = useState("app"); // "app" | "tokens" | "components"

  const toggleTheme = () => setTheme((p) => (p === "dark" ? "light" : "dark"));
  const c = (token) => t(theme, token);

  const fabItems = [
    { id: "food", label: "Food & Drink", icon: FoodIcon, color: c("cat-food"), bg: c("cat-food-soft"), angle: -135 },
    { id: "output", label: "Output", icon: OutputIcon, color: c("cat-output"), bg: c("cat-output-soft"), angle: -105 },
    { id: "activity", label: "Activity", icon: ActivityIcon, color: c("cat-activity"), bg: c("cat-activity-soft"), angle: -75 },
    { id: "wellness", label: "Wellness", icon: WellnessIcon, color: c("cat-wellness"), bg: c("cat-wellness-soft"), angle: -45 },
    { id: "meds", label: "Meds", icon: MedsIcon, color: c("status-safe"), bg: c("status-safe-soft"), angle: -15 },
    { id: "habit", label: "Habits", icon: HabitIcon, color: c("cat-habit"), bg: c("cat-habit-soft"), angle: 15 },
  ];

  const handleFabItemClick = (id) => {
    setFabOpen(false);
    setActiveDrawer(id);
  };

  return (
    <div
      style={{
        background: c("surface-base"),
        color: c("text-primary"),
        minHeight: "100vh",
        fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
        transition: "background 0.3s, color 0.3s",
        maxWidth: 430,
        margin: "0 auto",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ─── TOP BAR ─────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: `1px solid ${c("border-default")}`,
          background: c("surface-card"),
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div>
          <div style={{ fontSize: 13, color: c("text-tertiary"), letterSpacing: 0.5 }}>CACA TRACA</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {view === "app" ? (activeTab === "today" ? "Today" : activeTab === "library" ? "Library" : activeTab === "trends" ? "Trends" : "Coach") : view === "tokens" ? "Design Tokens" : "Components"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* View switcher */}
          <div style={{ display: "flex", gap: 2, background: c("surface-raised"), borderRadius: 8, padding: 2 }}>
            {[
              { id: "app", label: "App" },
              { id: "tokens", label: "Tokens" },
              { id: "components", label: "UI" },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: view === v.id ? c("surface-card") : "transparent",
                  color: view === v.id ? c("text-primary") : c("text-tertiary"),
                  boxShadow: view === v.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button
            onClick={toggleTheme}
            style={{
              background: c("surface-raised"),
              border: `1px solid ${c("border-default")}`,
              borderRadius: 8,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: c("text-secondary"),
            }}
          >
            {theme === "dark" ? icons.sun : icons.moon}
          </button>
        </div>
      </header>

      {/* ─── CONTENT AREA ─────────────────────────── */}
      <main style={{ padding: "16px 20px", paddingBottom: 120, minHeight: "calc(100vh - 140px)" }}>
        {view === "tokens" && <TokensView theme={theme} c={c} />}
        {view === "components" && <ComponentsView theme={theme} c={c} />}
        {view === "app" && activeTab === "today" && <TodayView theme={theme} c={c} />}
        {view === "app" && activeTab === "library" && <LibraryView theme={theme} c={c} />}
        {view === "app" && activeTab === "trends" && <TrendsView theme={theme} c={c} />}
        {view === "app" && activeTab === "coach" && <CoachView theme={theme} c={c} />}
      </main>

      {/* ─── FAB OVERLAY ─────────────────────────── */}
      {fabOpen && (
        <div
          onClick={() => setFabOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: c("surface-overlay"),
            zIndex: 90,
            maxWidth: 430,
            margin: "0 auto",
            transition: "opacity 0.2s",
          }}
        />
      )}

      {/* ─── FAB RADIAL ITEMS ────────────────────── */}
      {fabOpen &&
        fabItems.map((item, i) => {
          const radius = 110;
          const angleRad = (item.angle * Math.PI) / 180;
          const x = Math.cos(angleRad) * radius;
          const y = Math.sin(angleRad) * radius;
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              onClick={() => handleFabItemClick(item.id)}
              style={{
                position: "fixed",
                bottom: `calc(40px + ${-y}px)`,
                left: `calc(50% + ${x}px - 26px)`,
                maxWidth: 430,
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
                animation: `fabItemIn 0.25s ${i * 0.04}s both ease-out`,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: item.bg,
                  border: `2px solid ${item.color}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 4px 12px rgba(0,0,0,0.2)`,
                }}
              >
                <Icon color={item.color} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: c("text-inverse"), textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
                {item.label}
              </span>
            </div>
          );
        })}

      {/* ─── BOTTOM TAB BAR ──────────────────────── */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          background: c("surface-card"),
          borderTop: `1px solid ${c("border-default")}`,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-around",
          padding: "0 8px",
          paddingBottom: 8,
          zIndex: 100,
        }}
      >
        <TabItem icon={icons.home} label="Today" active={activeTab === "today" && view === "app"} color={c("cat-food")} textColor={c("text-tertiary")} onClick={() => { setActiveTab("today"); setView("app"); }} />
        <TabItem icon={icons.book} label="Library" active={activeTab === "library" && view === "app"} color={c("status-safe")} textColor={c("text-tertiary")} onClick={() => { setActiveTab("library"); setView("app"); }} />

        {/* CENTER FAB */}
        <div style={{ position: "relative", top: -18 }}>
          <button
            onClick={() => setFabOpen(!fabOpen)}
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              border: "none",
              background: fabOpen ? c("status-danger") : `linear-gradient(135deg, ${c("cat-food")}, ${c("cat-output")})`,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: `0 4px 16px rgba(0,0,0,0.25)`,
              transition: "transform 0.2s, background 0.2s",
              transform: fabOpen ? "rotate(45deg)" : "rotate(0deg)",
            }}
          >
            {icons.plus}
          </button>
        </div>

        <TabItem icon={icons.chart} label="Trends" active={activeTab === "trends" && view === "app"} color={c("cat-experiment")} textColor={c("text-tertiary")} onClick={() => { setActiveTab("trends"); setView("app"); }} />
        <TabItem icon={icons.brain} label="Coach" active={activeTab === "coach" && view === "app"} color={c("cat-ai")} textColor={c("text-tertiary")} onClick={() => { setActiveTab("coach"); setView("app"); }} />
      </nav>

      {/* ─── BOTTOM DRAWER ───────────────────────── */}
      {activeDrawer && (
        <BottomDrawer theme={theme} c={c} drawerId={activeDrawer} onClose={() => setActiveDrawer(null)} />
      )}

      <style>{`
        @keyframes fabItemIn {
          from { opacity: 0; transform: scale(0.3) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
      `}</style>
    </div>
  );
}

// ─── TAB ITEM ─────────────────────────────────────────────────────
function TabItem({ icon, label, active, color, textColor, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "10px 12px",
        cursor: "pointer",
        color: active ? color : textColor,
        transition: "color 0.15s",
        minWidth: 56,
      }}
    >
      <div style={{ opacity: active ? 1 : 0.6 }}>{icon}</div>
      <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{label}</span>
    </button>
  );
}

// ─── BOTTOM DRAWER ────────────────────────────────────────────────
function BottomDrawer({ theme, c, drawerId, onClose }) {
  const drawerConfig = {
    food: {
      title: "Food & Drink",
      color: c("cat-food"),
      presets: ["White toast", "Scrambled eggs", "Banana", "Plain rice", "Chicken broth", "Water", "Peppermint tea", "Yogurt"],
      placeholder: "What did you eat or drink?",
    },
    output: {
      title: "Log Output",
      color: c("cat-output"),
      presets: ["Bristol 1", "Bristol 2", "Bristol 3", "Bristol 4", "Bristol 5", "Bristol 6", "Bristol 7"],
      placeholder: "Describe your output...",
    },
    activity: {
      title: "Activity",
      color: c("cat-activity"),
      presets: ["Walking", "Yoga", "Gentle stretching", "Cycling", "Swimming", "Housework"],
      placeholder: "What activity did you do?",
    },
    wellness: {
      title: "Wellness & Sleep",
      color: c("cat-wellness"),
      presets: ["Slept well", "Interrupted sleep", "Nap", "Stressed", "Relaxed", "Anxious"],
      placeholder: "How are you feeling?",
    },
    meds: {
      title: "Medication",
      color: c("status-safe"),
      presets: ["Loperamide", "Paracetamol", "Codeine", "Omeprazole", "Multivitamin", "Iron supplement"],
      placeholder: "Which medication?",
    },
    habit: {
      title: "Other Habits",
      color: c("cat-habit"),
      presets: ["Coffee", "Tea", "Alcohol", "Cigarette", "Energy drink", "Soda"],
      placeholder: "Log a habit or stimulant...",
    },
  };

  const cfg = drawerConfig[drawerId] || drawerConfig.food;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: c("surface-overlay"),
          zIndex: 110,
          maxWidth: 430,
          margin: "0 auto",
          animation: "fadeIn 0.15s ease-out",
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          background: c("surface-card"),
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          zIndex: 120,
          animation: "slideUp 0.25s ease-out",
          maxHeight: "70vh",
          overflow: "auto",
        }}
      >
        {/* Drawer handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: c("border-strong") }} />
        </div>

        {/* Drawer header */}
        <div style={{ padding: "8px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: cfg.color }}>{cfg.title}</h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: c("text-tertiary"), cursor: "pointer", padding: 4 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Quick presets */}
        <div style={{ padding: "0 20px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: c("text-tertiary"), marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>Quick add</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {cfg.presets.map((p) => (
              <button
                key={p}
                style={{
                  padding: "8px 14px",
                  borderRadius: 20,
                  border: `1.5px solid ${cfg.color}40`,
                  background: `${cfg.color}10`,
                  color: cfg.color,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.1s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = `${cfg.color}25`;
                  e.currentTarget.style.borderColor = cfg.color;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = `${cfg.color}10`;
                  e.currentTarget.style.borderColor = `${cfg.color}40`;
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Text input */}
        <div style={{ padding: "0 20px 20px" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder={cfg.placeholder}
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: 12,
                border: `1.5px solid ${c("border-default")}`,
                background: c("surface-raised"),
                color: c("text-primary"),
                fontSize: 15,
                outline: "none",
              }}
            />
            <button
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "none",
                background: cfg.color,
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Save
            </button>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 12, justifyContent: "center" }}>
            <button style={{ background: "none", border: "none", color: c("text-tertiary"), fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
              Voice
            </button>
            <button style={{ background: "none", border: "none", color: c("text-tertiary"), fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Backdate
            </button>
            <button style={{ background: "none", border: "none", color: c("text-tertiary"), fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Details
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── TODAY VIEW ───────────────────────────────────────────────────
function TodayView({ theme, c }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Recovery context */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: c("surface-raised"), borderRadius: 12, border: `1px solid ${c("border-default")}` }}>
        <div style={{ fontSize: 24 }}>🩺</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Week 5 after surgery</div>
          <div style={{ fontSize: 12, color: c("text-secondary") }}>Stage 2 — Low-Residue Expansion</div>
        </div>
        <div style={{ marginLeft: "auto", padding: "4px 10px", borderRadius: 8, background: c("status-safe-soft"), color: c("status-safe"), fontSize: 11, fontWeight: 700 }}>
          Stable
        </div>
      </div>

      {/* Main question */}
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>What can I eat today?</h2>
        <p style={{ fontSize: 14, color: c("text-secondary") }}>Based on your stage, recent outputs, and tolerance history</p>
      </div>

      {/* Suggestion cards */}
      {[
        { food: "Scrambled eggs on white toast", reason: "Tolerated 4 times", confidence: "High", status: "safe", emoji: "🍳" },
        { food: "Banana with yogurt", reason: "Gentle, binding", confidence: "High", status: "safe", emoji: "🍌" },
        { food: "Chicken noodle soup", reason: "Soft protein + hydration", confidence: "Medium", status: "safe", emoji: "🍜" },
      ].map((s, i) => (
        <div
          key={i}
          style={{
            padding: 16,
            borderRadius: 14,
            background: c("surface-card"),
            border: `1.5px solid ${c("border-default")}`,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div style={{ fontSize: 32, lineHeight: 1 }}>{s.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{s.food}</div>
            <div style={{ fontSize: 12, color: c("text-secondary"), marginTop: 2 }}>{s.reason}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: c("status-safe-soft"), color: c("status-safe") }}>
              {s.confidence}
            </span>
            <span style={{ fontSize: 11, color: c("cat-food"), fontWeight: 600, cursor: "pointer" }}>Log this →</span>
          </div>
        </div>
      ))}

      {/* Test suggestion */}
      <div style={{ padding: 16, borderRadius: 14, background: c("cat-experiment-soft"), border: `1.5px solid ${c("cat-experiment")}40` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 28 }}>🧪</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: c("cat-experiment") }}>Ready to test?</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Cooked carrots</div>
            <div style={{ fontSize: 12, color: c("text-secondary"), marginTop: 2 }}>Stage 2 food · Low gas risk · Soft texture</div>
          </div>
          <button style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${c("cat-experiment")}`, background: "transparent", color: c("cat-experiment"), fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            Start test
          </button>
        </div>
      </div>

      {/* Tendency + last output */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ padding: 14, borderRadius: 12, background: c("surface-card"), border: `1px solid ${c("border-default")}` }}>
          <div style={{ fontSize: 11, color: c("text-tertiary"), fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Tendency</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: c("status-caution") }}>Slightly loose</div>
          <div style={{ fontSize: 12, color: c("text-secondary"), marginTop: 2 }}>Past 48h trend</div>
        </div>
        <div style={{ padding: 14, borderRadius: 12, background: c("surface-card"), border: `1px solid ${c("border-default")}` }}>
          <div style={{ fontSize: 11, color: c("text-tertiary"), fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Last output</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: c("cat-output") }}>Bristol 5 · 2h ago</div>
          <div style={{ fontSize: 12, color: c("text-secondary"), marginTop: 2 }}>Moderate amount</div>
        </div>
      </div>

      {/* Streak */}
      <div style={{ padding: 14, borderRadius: 12, background: c("surface-card"), border: `1px solid ${c("border-default")}`, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 28 }}>🔥</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>5-day check-in rhythm</div>
          <div style={{ fontSize: 12, color: c("text-secondary") }}>You're building a great picture of your recovery</div>
        </div>
      </div>
    </div>
  );
}

// ─── LIBRARY VIEW ─────────────────────────────────────────────────
function LibraryView({ theme, c }) {
  const stages = ["All", "Stage 0/1", "Stage 2", "Stage 3", "Stage 4"];
  const [activeStage, setActiveStage] = useState("All");
  const foods = [
    { name: "White toast", stage: 1, status: "safe", tries: 8, emoji: "🍞" },
    { name: "Scrambled eggs", stage: 1, status: "safe", tries: 6, emoji: "🍳" },
    { name: "Banana", stage: 2, status: "safe", tries: 5, emoji: "🍌" },
    { name: "Cooked carrots", stage: 2, status: "untested", tries: 0, emoji: "🥕" },
    { name: "Plain yogurt", stage: 1, status: "safe", tries: 4, emoji: "🥛" },
    { name: "Chicken broth", stage: 0, status: "safe", tries: 12, emoji: "🍵" },
    { name: "Blueberries", stage: 3, status: "caution", tries: 1, emoji: "🫐" },
    { name: "Brown rice", stage: 3, status: "untested", tries: 0, emoji: "🍚" },
    { name: "Regular coffee", stage: 4, status: "danger", tries: 2, emoji: "☕" },
  ];

  const statusColor = (s) =>
    s === "safe" ? c("status-safe") : s === "caution" ? c("status-caution") : s === "danger" ? c("status-danger") : c("status-untested");
  const statusBg = (s) =>
    s === "safe" ? c("status-safe-soft") : s === "caution" ? c("status-caution-soft") : s === "danger" ? c("status-danger-soft") : c("status-untested-soft");
  const statusLabel = (s) =>
    s === "safe" ? "Tolerated" : s === "caution" ? "Watch" : s === "danger" ? "Trigger" : "Untested";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Search */}
      <input
        placeholder="Search foods..."
        style={{
          padding: "12px 16px",
          borderRadius: 12,
          border: `1.5px solid ${c("border-default")}`,
          background: c("surface-raised"),
          color: c("text-primary"),
          fontSize: 15,
          outline: "none",
          width: "100%",
        }}
      />

      {/* Stage filters */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
        {stages.map((s) => (
          <button
            key={s}
            onClick={() => setActiveStage(s)}
            style={{
              padding: "7px 14px",
              borderRadius: 20,
              border: `1.5px solid ${activeStage === s ? c("cat-food") : c("border-default")}`,
              background: activeStage === s ? c("cat-food-soft") : "transparent",
              color: activeStage === s ? c("cat-food") : c("text-secondary"),
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Food list */}
      {foods.map((f, i) => (
        <div
          key={i}
          style={{
            padding: 14,
            borderRadius: 12,
            background: c("surface-card"),
            border: `1px solid ${c("border-default")}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 28 }}>{f.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</div>
            <div style={{ fontSize: 12, color: c("text-secondary") }}>
              Stage {f.stage} · {f.tries > 0 ? `Tried ${f.tries}x` : "Not tried yet"}
            </div>
          </div>
          <span style={{
            padding: "4px 10px",
            borderRadius: 8,
            background: statusBg(f.status),
            color: statusColor(f.status),
            fontSize: 11,
            fontWeight: 700,
          }}>
            {statusLabel(f.status)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── TRENDS VIEW ──────────────────────────────────────────────────
function TrendsView({ theme, c }) {
  const bristolData = [4, 5, 3, 4, 5, 6, 4, 5, 3, 4, 5, 4, 3, 5];
  const maxB = 7;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Trend question card */}
      <div style={{ padding: 16, borderRadius: 14, background: c("surface-card"), border: `1px solid ${c("border-default")}` }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Am I trending looser or harder?</div>
        <div style={{ fontSize: 14, color: c("text-secondary"), marginBottom: 12 }}>Slightly loose this week — average Bristol 4.3 vs last week's 3.8</div>

        {/* Simple bar chart */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
          {bristolData.map((v, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${(v / maxB) * 100}%`,
                borderRadius: "4px 4px 0 0",
                background: v <= 2 ? c("status-caution") : v <= 5 ? c("status-safe") : c("status-danger"),
                opacity: i >= bristolData.length - 7 ? 1 : 0.4,
                minHeight: 4,
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 10, color: c("text-tertiary") }}>Last week</span>
          <span style={{ fontSize: 10, color: c("text-tertiary") }}>This week</span>
        </div>
      </div>

      {/* More insight cards */}
      {[
        { q: "How did new foods go?", a: "Cooked carrots went well (2 trials, no issues). Blueberries caused loose output once.", color: c("cat-experiment") },
        { q: "What's most tolerated?", a: "White toast, scrambled eggs, bananas, and plain rice are your strongest anchors.", color: c("status-safe") },
        { q: "What about caffeine?", a: "Coffee triggered urgency both times. Tea was fine.", color: c("status-caution") },
      ].map((card, i) => (
        <div key={i} style={{ padding: 16, borderRadius: 14, background: c("surface-card"), border: `1px solid ${c("border-default")}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: card.color, marginBottom: 4 }}>{card.q}</div>
          <div style={{ fontSize: 14, color: c("text-secondary"), lineHeight: 1.5 }}>{card.a}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: c("cat-ai"), fontWeight: 600, cursor: "pointer" }}>View details →</div>
        </div>
      ))}
    </div>
  );
}

// ─── COACH VIEW ───────────────────────────────────────────────────
function CoachView({ theme, c }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Coach identity */}
      <div style={{ textAlign: "center", padding: "16px 0" }}>
        <div style={{ width: 56, height: 56, borderRadius: 18, background: c("cat-ai-soft"), border: `2px solid ${c("cat-ai")}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 28 }}>
          🧠
        </div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Recovery Coach</div>
        <div style={{ fontSize: 13, color: c("text-secondary") }}>Warm Coach mode · Remembers your journey</div>
      </div>

      {/* Quick prompts */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {["Gentle breakfast ideas", "Review my week", "Help test a food", "Create a meal plan"].map((p) => (
          <button
            key={p}
            style={{
              padding: "8px 14px",
              borderRadius: 20,
              border: `1.5px solid ${c("cat-ai")}40`,
              background: c("cat-ai-soft"),
              color: c("cat-ai"),
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Sample conversation */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
        <div style={{ alignSelf: "flex-end", padding: "10px 14px", borderRadius: "14px 14px 4px 14px", background: c("cat-ai"), color: "#fff", fontSize: 14, maxWidth: "80%" }}>
          What can I have for lunch that's gentle?
        </div>
        <div style={{ alignSelf: "flex-start", padding: "12px 14px", borderRadius: "14px 14px 14px 4px", background: c("surface-card"), border: `1px solid ${c("border-default")}`, fontSize: 14, maxWidth: "85%", lineHeight: 1.5 }}>
          <div style={{ marginBottom: 8 }}>Based on your stage and what's been working well, here are three gentle options:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {["Chicken noodle soup — soft protein + hydration", "Scrambled eggs on white toast — your best anchor", "Rice congee with shredded chicken — warm and soothing"].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <span style={{ color: c("status-safe"), fontWeight: 700, fontSize: 12, marginTop: 2 }}>•</span>
                <span style={{ fontSize: 13 }}>{item}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: c("text-secondary") }}>
            All of these are Stage 2 compatible and you've tolerated the key ingredients before.
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <span style={{ padding: "3px 8px", borderRadius: 6, background: c("cat-food-soft"), color: c("cat-food"), fontSize: 10, fontWeight: 600 }}>Log a meal</span>
            <span style={{ padding: "3px 8px", borderRadius: 6, background: c("cat-ai-soft"), color: c("cat-ai"), fontSize: 10, fontWeight: 600 }}>Make a meal plan</span>
          </div>
        </div>
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8, marginTop: 8, position: "sticky", bottom: 80 }}>
        <input
          placeholder="Ask your coach..."
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: 14,
            border: `1.5px solid ${c("border-default")}`,
            background: c("surface-raised"),
            color: c("text-primary"),
            fontSize: 14,
            outline: "none",
          }}
        />
        <button style={{ width: 44, height: 44, borderRadius: 14, border: "none", background: c("cat-ai"), color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
}

// ─── TOKENS VIEW ──────────────────────────────────────────────────
function TokensView({ theme, c }) {
  const sections = [
    {
      title: "Status Colors",
      items: [
        { token: "status-danger", label: "Danger / Risky", desc: "Trigger foods, safety alerts" },
        { token: "status-caution", label: "Caution / Watch", desc: "Watch foods, uncertain" },
        { token: "status-safe", label: "Safe / Tolerated", desc: "Confirmed tolerated" },
        { token: "status-untested", label: "Untested", desc: "No data yet" },
      ],
    },
    {
      title: "Category Colors",
      items: [
        { token: "cat-food", label: "Food & Drink", desc: "Sky blue — logging meals" },
        { token: "cat-output", label: "Output / BMs", desc: "Teal — Bristol scale, outputs" },
        { token: "cat-activity", label: "Activity", desc: "Emerald — exercise, movement" },
        { token: "cat-wellness", label: "Wellness & Sleep", desc: "Violet — rest, mental state" },
        { token: "cat-ai", label: "AI Coach", desc: "Indigo — insights, intelligence" },
        { token: "cat-experiment", label: "Experiments", desc: "Navy — testing new foods" },
        { token: "cat-habit", label: "Other Habits", desc: "Yellow/amber — stimulants, misc" },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ fontSize: 14, color: c("text-secondary"), lineHeight: 1.6 }}>
        Semantic color system for Caca Traca. Every color has a purpose — no decorative use. Toggle dark/light mode to see both palettes.
      </div>

      {sections.map((section) => (
        <div key={section.title}>
          <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: c("text-tertiary"), marginBottom: 12 }}>
            {section.title}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {section.items.map((item) => (
              <div
                key={item.token}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: c("surface-card"),
                  border: `1px solid ${c("border-default")}`,
                }}
              >
                {/* Color swatch */}
                <div style={{ display: "flex", gap: 4 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: c(item.token), border: `1px solid ${c("border-default")}` }} />
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: c(`${item.token}-soft`), border: `1px solid ${c("border-default")}` }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: c("text-secondary") }}>{item.desc}</div>
                </div>
                <code style={{ fontSize: 10, color: c("text-tertiary"), fontFamily: "monospace" }}>{item.token}</code>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Typography */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: c("text-tertiary"), marginBottom: 12 }}>
          Typography
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, borderRadius: 14, background: c("surface-card"), border: `1px solid ${c("border-default")}` }}>
          <div style={{ fontSize: 28, fontWeight: 700, lineHeight: "34px" }}>H1 — Page titles (28/34)</div>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: "28px" }}>H2 — Section headers (22/28)</div>
          <div style={{ fontSize: 18, fontWeight: 500, lineHeight: "24px" }}>H3 — Card titles (18/24)</div>
          <div style={{ fontSize: 16, lineHeight: "24px" }}>Body — Regular text for reading (16/24)</div>
          <div style={{ fontSize: 13, lineHeight: "18px", color: c("text-secondary") }}>Caption — Supporting details and metadata (13/18)</div>
        </div>
      </div>

      {/* Spacing */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: c("text-tertiary"), marginBottom: 12 }}>
          8pt Spacing System
        </h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[4, 8, 12, 16, 20, 24, 32].map((s) => (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: s, height: 32, background: c("cat-ai"), borderRadius: 2, minWidth: 4 }} />
              <span style={{ fontSize: 10, color: c("text-tertiary") }}>{s}px</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTS VIEW ──────────────────────────────────────────────
function ComponentsView({ theme, c }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Buttons */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: c("text-tertiary"), marginBottom: 12 }}>Buttons</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: c("cat-food"), color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Primary</button>
          <button style={{ padding: "10px 20px", borderRadius: 12, border: `1.5px solid ${c("cat-food")}`, background: "transparent", color: c("cat-food"), fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Outline</button>
          <button style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: c("surface-raised"), color: c("text-secondary"), fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Ghost</button>
          <button style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: c("status-danger"), color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Danger</button>
        </div>
      </div>

      {/* Chips */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: c("text-tertiary"), marginBottom: 12 }}>Zone Chips</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "Zone 0 — Clear", color: c("status-untested"), bg: c("status-untested-soft") },
            { label: "Zone 1 — Gentle", color: c("status-safe"), bg: c("status-safe-soft") },
            { label: "Zone 2 — Expanding", color: c("cat-food"), bg: c("cat-food-soft") },
            { label: "Zone 3 — Testing", color: c("cat-experiment"), bg: c("cat-experiment-soft") },
            { label: "Zone 4 — Personal", color: c("cat-ai"), bg: c("cat-ai-soft") },
          ].map((chip) => (
            <span key={chip.label} style={{ padding: "6px 12px", borderRadius: 20, background: chip.bg, color: chip.color, fontSize: 12, fontWeight: 700, border: `1px solid ${chip.color}30` }}>
              {chip.label}
            </span>
          ))}
        </div>
      </div>

      {/* Confidence badges */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: c("text-tertiary"), marginBottom: 12 }}>Confidence Badges</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ padding: "5px 12px", borderRadius: 8, background: c("status-safe-soft"), color: c("status-safe"), fontSize: 12, fontWeight: 700 }}>High confidence</span>
          <span style={{ padding: "5px 12px", borderRadius: 8, background: c("status-caution-soft"), color: c("status-caution"), fontSize: 12, fontWeight: 700 }}>Medium</span>
          <span style={{ padding: "5px 12px", borderRadius: 8, background: c("status-untested-soft"), color: c("status-untested"), fontSize: 12, fontWeight: 700 }}>Low</span>
        </div>
      </div>

      {/* Reason pills */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: c("text-tertiary"), marginBottom: 12 }}>Reason Pills</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["Based on recent outputs", "New food", "Contains caffeine", "Binding effect", "High fiber"].map((r) => (
            <span key={r} style={{ padding: "4px 10px", borderRadius: 12, background: c("surface-raised"), border: `1px solid ${c("border-default")}`, color: c("text-secondary"), fontSize: 11, fontWeight: 500 }}>
              {r}
            </span>
          ))}
        </div>
      </div>

      {/* Bristol Cards */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: c("text-tertiary"), marginBottom: 12 }}>Bristol Scale Cards</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[
            { n: 1, label: "Hard lumps", color: c("status-caution") },
            { n: 2, label: "Lumpy", color: c("status-caution") },
            { n: 3, label: "Cracked", color: c("status-safe") },
            { n: 4, label: "Smooth", color: c("status-safe") },
            { n: 5, label: "Soft blobs", color: c("status-safe") },
            { n: 6, label: "Mushy", color: c("status-caution") },
            { n: 7, label: "Watery", color: c("status-danger") },
          ].map((b) => (
            <div
              key={b.n}
              style={{
                padding: "12px 8px",
                borderRadius: 12,
                border: `2px solid ${b.color}40`,
                background: c("surface-card"),
                textAlign: "center",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: b.color }}>{b.n}</div>
              <div style={{ fontSize: 10, color: c("text-secondary"), marginTop: 2 }}>{b.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggestion card */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: c("text-tertiary"), marginBottom: 12 }}>Suggestion Card</h3>
        <div style={{ padding: 16, borderRadius: 14, background: c("surface-card"), border: `1.5px solid ${c("border-default")}`, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 36, lineHeight: 1 }}>🍳</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Scrambled eggs on white toast</div>
            <div style={{ fontSize: 13, color: c("text-secondary"), marginTop: 3 }}>Tolerated 4 times · Soft protein · Stage 1</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <span style={{ padding: "3px 8px", borderRadius: 6, background: c("status-safe-soft"), color: c("status-safe"), fontSize: 10, fontWeight: 700 }}>High confidence</span>
              <span style={{ padding: "3px 8px", borderRadius: 6, background: c("surface-raised"), color: c("text-tertiary"), fontSize: 10 }}>Based on recent outputs</span>
            </div>
          </div>
          <button style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${c("cat-food")}`, background: "transparent", color: c("cat-food"), fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            Log this
          </button>
        </div>
      </div>

      {/* Safety banner */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: c("text-tertiary"), marginBottom: 12 }}>Safety Banner (rare)</h3>
        <div style={{ padding: 14, borderRadius: 12, background: c("status-danger-soft"), border: `2px solid ${c("status-danger")}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 24 }}>⚠️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: c("status-danger") }}>Contact your aftercare team</div>
            <div style={{ fontSize: 13, color: c("text-secondary"), marginTop: 2 }}>The symptoms you described may need medical attention.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
