/** Format phone as +7 (XXX) XXX-XX-XX */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^8/, "7")
  const d = digits.startsWith("7") ? digits.slice(1) : digits
  let result = "+7"
  if (d.length > 0) result += ` (${d.slice(0, 3)}`
  if (d.length >= 3) result += `) ${d.slice(3, 6)}`
  if (d.length >= 6) result += `-${d.slice(6, 8)}`
  if (d.length >= 8) result += `-${d.slice(8, 10)}`
  return result
}
