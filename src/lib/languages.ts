/** Deste dil çiftleri için seçenekler. Kod, telaffuz (SpeechSynthesis) dilini de belirler. */
export const LANGUAGES = [
  { code: "en", label: "İngilizce", speech: "en-US" },
  { code: "tr", label: "Türkçe", speech: "tr-TR" },
  { code: "de", label: "Almanca", speech: "de-DE" },
  { code: "fr", label: "Fransızca", speech: "fr-FR" },
  { code: "es", label: "İspanyolca", speech: "es-ES" },
  { code: "it", label: "İtalyanca", speech: "it-IT" },
  { code: "pt", label: "Portekizce", speech: "pt-PT" },
  { code: "nl", label: "Felemenkçe", speech: "nl-NL" },
  { code: "ru", label: "Rusça", speech: "ru-RU" },
  { code: "ar", label: "Arapça", speech: "ar-SA" },
  { code: "ja", label: "Japonca", speech: "ja-JP" },
  { code: "ko", label: "Korece", speech: "ko-KR" },
  { code: "zh", label: "Çince", speech: "zh-CN" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as [LanguageCode, ...LanguageCode[]];

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

export function speechLang(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.speech ?? code;
}
