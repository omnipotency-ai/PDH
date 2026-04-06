import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { LEGACY_THEME_STORAGE_KEY, THEME_STORAGE_KEY } from "@/lib/storageKeys";

type Theme = "dark" | "light" | "system";

const VALID_THEMES: ReadonlySet<string> = new Set<Theme>(["dark", "light", "system"]);

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && VALID_THEMES.has(value);
}

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function resolveSystemTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(storageKey: string, defaultTheme: Theme): Theme {
  try {
    const stored = localStorage.getItem(storageKey);
    if (isTheme(stored)) return stored;

    const legacyStored = localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    if (isTheme(legacyStored)) {
      localStorage.setItem(storageKey, legacyStored);
      localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
      return legacyStored;
    }
  } catch {
    // Ignore storage failures and fall back to the default theme.
  }

  return defaultTheme;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = THEME_STORAGE_KEY,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    return readStoredTheme(storageKey, defaultTheme);
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const resolved = theme === "system" ? resolveSystemTheme() : theme;
    root.setAttribute("data-theme", resolved);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const root = window.document.documentElement;
      root.setAttribute("data-theme", resolveSystemTheme());
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(storageKey, theme);
        } catch {
          // Ignore storage failures and keep the in-memory theme state.
        }
      }
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
