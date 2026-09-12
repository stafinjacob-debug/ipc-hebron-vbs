import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getPublicAppBaseUrl()),
  title: {
    default: "IPC Hebron Forms",
    template: "%s | IPC Hebron Forms",
  },
  description: "IPC Hebron Houston forms and applications",
  icons: {
    icon: "/church-logo.png",
    apple: "/church-logo.png",
  },
  openGraph: {
    type: "website",
    siteName: "IPC Hebron Forms",
    images: [
      {
        url: "/hebron-forms-og.png",
        width: 1200,
        height: 630,
        alt: "IPC Hebron Houston",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/hebron-forms-og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
