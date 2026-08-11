"use client"

import type {ContractFileLinkProps} from "./types"

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
            <i className="bx bx-download"/>
            {label}
        </a>
    )
}
