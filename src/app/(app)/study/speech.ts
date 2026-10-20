import { speechLang } from "@/lib/languages";

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Tarayıcının ücretsiz telaffuz motoruyla okur. Dile uygun ses varsa onu seçer. */
export function speak(text: string, langCode: string) {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const lang = speechLang(langCode);
  utterance.lang = lang;
  const base = lang.split("-")[0]!.toLowerCase();
  const voice =
    synth.getVoices().find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
    synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(base));
  if (voice) utterance.voice = voice;
  utterance.rate = 0.95;
  synth.speak(utterance);
}
