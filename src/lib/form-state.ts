export type FormState =
  { error?: string; success?: string; values?: Record<string, string> } | undefined;

/** FormData alanını güvenle metne çevirir (dosya veya boş gelirse ""). */
export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
