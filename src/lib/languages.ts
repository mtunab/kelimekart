/** Deck language options. The code also selects the speech (SpeechSynthesis) voice. */
export const LANGUAGES = [
  { code: "en", label: "English", speech: "en-US" },
  { code: "tr", label: "Turkish", speech: "tr-TR" },
  { code: "de", label: "German", speech: "de-DE" },
  { code: "fr", label: "French", speech: "fr-FR" },
  { code: "es", label: "Spanish", speech: "es-ES" },
  { code: "it", label: "Italian", speech: "it-IT" },
  { code: "pt", label: "Portuguese", speech: "pt-PT" },
  { code: "nl", label: "Dutch", speech: "nl-NL" },
  { code: "ru", label: "Russian", speech: "ru-RU" },
  { code: "ar", label: "Arabic", speech: "ar-SA" },
  { code: "ja", label: "Japanese", speech: "ja-JP" },
  { code: "ko", label: "Korean", speech: "ko-KR" },
  { code: "zh", label: "Chinese", speech: "zh-CN" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as [LanguageCode, ...LanguageCode[]];

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

export function speechLang(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.speech ?? code;
}
