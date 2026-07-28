export function isStagePaymentsDisabled(): boolean {
  return String(process.env.SKIP_STAGE_PAYMENTS ?? "").toLowerCase() === "true"
}

export function isStagePaymentsDisabledPublic(): boolean {
  return String(process.env.NEXT_PUBLIC_SKIP_STAGE_PAYMENTS ?? "").toLowerCase() === "true"
}

