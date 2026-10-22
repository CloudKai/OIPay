import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";

import "@/app/globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";
import ServiceWorkerRegistration from "@/components/pwa/service-worker-registration";

export const metadata: Metadata = {
  applicationName: "SplitTogether",
  title: {
    default: "SplitTogether",
    template: "%s | SplitTogether"
  },
  description: "Clear shared expenses, fair splits, and simple settlements.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SplitTogether"
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#f3f7f6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const showProductionTelemetry = process.env.NODE_ENV === "production";

  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <AuthProvider>
          {children}
          <Toaster richColors position="top-right" closeButton />
          <ServiceWorkerRegistration />
          {showProductionTelemetry ? (
            <>
              <Analytics />
              <SpeedInsights />
            </>
          ) : null}
        </AuthProvider>
      </body>
    </html>
  );
}
