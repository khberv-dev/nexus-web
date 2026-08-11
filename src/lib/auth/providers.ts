import type {OAuthConfig} from "next-auth/providers/oauth";

const projectId = process.env.ZITADEL_PROJECT_ID!;

export const zitadelProvider: OAuthConfig<Record<string, unknown>> = {
    id: "zitadel",
    name: "Zitadel",
    type: "oauth",
    version: "2.0",
    wellKnown: `${process.env.ZITADEL_ISSUER}/.well-known/openid-configuration`,
    authorization: {
        params: {
            scope: [
                "openid",
                "profile",
                "email",
                "offline_access",
                "urn:zitadel:iam:user:metadata",
                `urn:zitadel:iam:org:project:id:${projectId}:aud`,
            ].join(" "),
        },
    },
    checks: ["pkce", "state"],
    idToken: true,
    clientId: process.env.ZITADEL_CLIENT_ID!,
    clientSecret: "", // PKCE — empty string required by NextAuth
    profile(profile) {
        return {
            id: profile.sub as string,
            name: profile.name as string,
            email: profile.email as string,
            image: null,
        };
    },
};
