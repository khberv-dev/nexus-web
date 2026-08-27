import type {NextConfig} from "next";
import {withSentryConfig} from "@sentry/nextjs";

// For virtual-hosted-style buckets (e.g. nexus.s3.cloud.ru),
// derive a wildcard origin from S3_ENDPOINT so CSP covers all bucket subdomains.
function s3WildcardOrigin(endpoint: string | undefined): string {
    if (!endpoint) return ""
    try {
        const url = new URL(endpoint)
        return `${url.protocol}//*.${url.host}`
    } catch {
        return ""
    }
}

const s3Wildcard = s3WildcardOrigin(process.env.S3_ENDPOINT || process.env.S3_PUBLIC_ENDPOINT)

const nextConfig: NextConfig = {
    output: "standalone",
    poweredByHeader: false,
    allowedDevOrigins: ["nexus-demo.pointer.uz"],
    /** Иначе Edge middleware не видит значение из .env (редирект на /login при DEV_AUTH_BYPASS). */
    env: {
        DEV_AUTH_BYPASS: process.env.DEV_AUTH_BYPASS ?? "",
        DEV_MOCK_ROLE: process.env.DEV_MOCK_ROLE ?? "",
    },
    generateBuildId: async () => `build-${Date.now()}`,
    experimental: {
        serverActions: {
            allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "localhost:3000").split(","),
        },
    },
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    {
                        key: "Content-Security-Policy",
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://planerka.app",
                            "style-src 'self' 'unsafe-inline' https://planerka.app",
                            "font-src 'self' data: https://cdn.prod.website-files.com https://planerka.app",
                            `connect-src 'self' ${process.env.ZITADEL_ISSUER ?? ""} ${process.env.S3_ENDPOINT ?? ""} ${process.env.S3_PUBLIC_ENDPOINT ?? ""} ${s3Wildcard} https://planerka.app /monitoring`,
                            `img-src 'self' data: blob: ${process.env.S3_ENDPOINT ?? ""} ${process.env.S3_PUBLIC_ENDPOINT ?? ""} ${s3Wildcard} https://purecatamphetamine.github.io https://planerka.app`,
                            `media-src 'self' blob: ${process.env.S3_ENDPOINT ?? ""} ${process.env.S3_PUBLIC_ENDPOINT ?? ""} ${s3Wildcard}`,
                            "frame-src 'self' https://planerka.app",
                            "frame-ancestors 'none'",
                        ].join("; "),
                    },
                ],
            },
        ];
    },
};

export default withSentryConfig(nextConfig, {
    org: "tota-st",
    project: "nexus",
    silent: !process.env.CI,
    tunnelRoute: "/monitoring",
    widenClientFileUpload: true,
    webpack: {treeshake: {removeDebugLogging: true}},
    authToken: process.env.SENTRY_AUTH_TOKEN,
    telemetry: false,
});
