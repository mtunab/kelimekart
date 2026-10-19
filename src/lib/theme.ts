export const THEME_COOKIE = "kk-theme";
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  system: "Sistem",
  light: "Açık",
  dark: "Koyu",
};

export function parseTheme(value: string | undefined): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "system";
}

/**
 * "Sistem" seçiliyken sayfa çizilmeden önce çalışır; yanlış renkte yanıp sönmeyi önler.
 * Cihazın açık/koyu ayarı değişirse de takip eder.
 */
export const SYSTEM_THEME_SCRIPT = `(function(){try{var m=window.matchMedia('(prefers-color-scheme: dark)');var a=function(){document.documentElement.classList.toggle('dark',m.matches)};a();m.addEventListener('change',a)}catch(e){}})();`;
