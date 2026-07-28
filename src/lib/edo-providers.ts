/** Операторы ЭДО — храним в formData.edoProviders как id через запятую: diadoc,taxcom,sbis,onec_edi */
export const EDO_PROVIDER_OPTIONS = [
  { id: "diadoc", label: "Контур.Диадок" },
  { id: "taxcom", label: "Такском" },
  { id: "sbis", label: "СБИС" },
  { id: "onec_edi", label: "1С-ЭДО" },
] as const

export function parseEdoProviders(raw: string | undefined): Set<string> {
  return new Set((raw ?? "").split(",").map(s => s.trim()).filter(Boolean))
}

export function formatEdoProvidersLabel(raw: string | undefined): string {
  const set = parseEdoProviders(raw)
  return EDO_PROVIDER_OPTIONS.filter(o => set.has(o.id)).map(o => o.label).join(", ") || ""
}
