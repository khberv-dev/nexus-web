import type { StageType, PaymentStatus } from "@prisma/client"

export type ClientOrder = {
  id: string
  status: string
  /** Сумма договора, копейки */
  price: number | null
  briefData: unknown
  briefStep: number
  briefHelpRequested: boolean
  createdAt: Date
  updatedAt: Date
  specialist: { name: string | null; email: string; avatarUrl?: string | null } | null
  stages: { type: StageType; status: string; modRound: number; clientRound: number }[]
  payments: { amount: number; status: PaymentStatus }[]
}

export type ClientPayment = {
  id: string
  amount: number
  status: PaymentStatus
  createdAt: Date
  order: { id: string; briefData: unknown }
}

export type ClientInvoice = {
  id: string
  number: string
  orderId: string
  amount: number
  status: string
  purpose: string
  s3Key: string | null
  createdAt: Date
  paidAt: Date | null
}

export type ClientContract = {
  id: string
  number: string
  orderId: string
  status: string
  s3Key: string | null
  createdAt: Date
  signedAt: Date | null
}

export type ClientAct = {
  id: string
  stageType: string
  orderId: string
  generatedAt: string
  signedAt: string | null
}

export interface ClientCabinetProps {
  name: string
  email: string
  formData: Record<string, string>
  orders: ClientOrder[]
  payments: ClientPayment[]
  invoices: ClientInvoice[]
  contracts: ClientContract[]
  acts: ClientAct[]
  frameworkContract?: { status: string; number: string | null; hasFile: boolean }
}
