import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/Tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

// Absolute origin for metadata URLs. Social cards must be absolute: a
// relative OG image is simply dropped by every crawler, so without this the
// /api/og route would render correctly and still never appear anywhere.
// NEXT_PUBLIC_SITE_URL is the override the custom domain will use in 5.2;
// until then Vercel's own production host is the stable answer, and
// VERCEL_URL covers preview deployments.
function siteOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function generateMetadata(): Promise<Metadata> {
  const sitePublic = process.env.SITE_PUBLIC === "true";
  return {
    metadataBase: new URL(siteOrigin()),
    title: "The Empty Seat",
    description:
      "Research-grade tracking of Waymo's operations, unit economics, and financials.",
    ...(sitePublic
      ? {}
      : {
          robots: {
            index: false,
            follow: false,
            noarchive: true,
          },
        }),
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
          <TooltipProvider>{children}</TooltipProvider>
        </body>
    </html>
  );
}
