export class ZitadelApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = "ZitadelApiError";
    }
}

export class ZitadelHttpClient {
    private baseUrl: string;
    private orgId: string;

    constructor() {
        this.baseUrl = process.env.ZITADEL_ISSUER!;
        this.orgId = process.env.ZITADEL_ORG_ID!;
    }

    private async getServiceToken(): Promise<string> {
        const keyFile = JSON.parse(process.env.ZITADEL_SERVICE_ACCOUNT_KEY!);
        const {SignJWT, importPKCS8} = await import("jose");
        const privateKey = await importPKCS8(keyFile.key, "RS256");
        const now = Math.floor(Date.now() / 1000);
        const jwt = await new SignJWT({iss: keyFile.userId, sub: keyFile.userId})
            .setProtectedHeader({alg: "RS256", kid: keyFile.keyId})
            .setAudience(`${this.baseUrl}`)
            .setIssuedAt(now)
            .setExpirationTime(now + 3600)
            .sign(privateKey);

        const res = await fetch(`${this.baseUrl}/oauth/v2/token`, {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: jwt,
                scope: "openid urn:zitadel:iam:org:project:id:zitadel:aud",
            }),
        });
        const data = await res.json();
        return data.access_token;
    }

    private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
        const token = await this.getServiceToken();
        const res = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                "x-zitadel-orgid": this.orgId,
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const err = await res.text();
            throw new ZitadelApiError(res.status, err);
        }
        return res.json() as Promise<T>;
    }

    async createUser(email: string): Promise<{ userId: string }> {
        return this.request("POST", "/v2/users", {
            human: {
                profile: {displayName: email},
                email: {email, isVerified: false, sendCode: {}},
            },
        });
    }

    async assignRole(userId: string, role: string): Promise<void> {
        await this.request("POST", `/v2/users/${userId}/grants`, {
            projectId: process.env.ZITADEL_PROJECT_ID,
            roleKeys: [role],
        });
    }

    async deactivateUser(userId: string): Promise<void> {
        await this.request("POST", `/v2/users/${userId}/deactivate`, {});
    }
}

export const zitadelClient = new ZitadelHttpClient();

/** Extract role from Zitadel JWT claims (nested structure) */
export function extractRoleFromToken(payload: Record<string, unknown>): string {
    const rolesKey = Object.keys(payload).find((k) =>
        k.match(/urn:zitadel:iam:org:project:.+:roles/)
    );
    const rolesMap = rolesKey ? (payload[rolesKey] as Record<string, unknown>) : {};
    for (const role of ["ADMIN", "SPECIALIST", "CLIENT"]) {
        if (role in rolesMap) return role;
    }
    throw new Error("No valid role found in token");
}

/** Extract org ID from Zitadel JWT (checks multiple claim locations) */
export function extractOrgIdFromToken(payload: Record<string, unknown>): string | null {
    if (payload["urn:zitadel:iam:org:id"]) return payload["urn:zitadel:iam:org:id"] as string;
    const orgKey = Object.keys(payload).find((k) => k.match(/urn:zitadel:iam:org:id:.+/));
    if (orgKey) return orgKey.split(":").pop() ?? null;
    if (payload["org_id"]) return payload["org_id"] as string;
    return null;
}
