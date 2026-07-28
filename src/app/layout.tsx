import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_TITLE = "Агрегатор дизайна пространств для В2В сегмента";
const SITE_DESCRIPTION =
  "Первая в России платформа-агрегатор дизайнеров для В2В, со стандартизацией процессов, гарантией качества и сроков";


function tryParsePublicOrigin(value: string | undefined | null): URL | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

async function resolveMetadataBase(): Promise<URL> {
  const fromEnv =
    tryParsePublicOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    tryParsePublicOrigin(process.env.NEXTAUTH_URL);
  if (fromEnv) return fromEnv;

  const h = await headers();
  const host =
    h.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    h.get("host")?.trim() ||
    "";
  if (host) {
    const isLocal = host.startsWith("localhost") || host.startsWith("127.");
    const forwardedProto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const proto = forwardedProto || (isLocal ? "http" : "https");
    return new URL(`${proto}://${host}`);
  }

  return new URL("http://localhost:3000");
}

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await resolveMetadataBase();
  return {
    metadataBase,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    openGraph: {
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: [
        {
          url: "/ogg.jpg",
          width: 1200,
          height: 630,
          alt: "NEXUS — платформа для дизайна интерьеров",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: ["/ogg.jpg"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="stylesheet" href="/sneat/fonts/iconify-icons.css" />
        {/* PP Neue Montreal via CDN (used by Osmo template) */}
        <style>{`
          @font-face {
            font-family: 'PP Neue Montreal';
            src: url('https://cdn.prod.website-files.com/6819ed8312518f61b84824df/6819ed8312518f61b84825ba_PPNeueMontreal-Medium.woff2') format('woff2');
            font-weight: 500;
            font-style: normal;
            font-display: swap;
          }
        `}</style>
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
