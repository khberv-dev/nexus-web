"use client"

import type {ContractFileLinkProps} from "./types"
import {Icon} from "@/components/ui/icon"

export function ContractFileLink({contractId, s3Key, label}: ContractFileLinkProps) {
    if (!s3Key) return null
    return (
        <a
            href={`/api/contracts/${contractId}/download`}
            target="_blank"
            rel="noreferrer"
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "#34d399",
                fontSize: "0.85rem",
                textDecoration: "none",
            }}
        >
            <Icon name="download"/>
            {label}
        </a>
    )
}
