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
  title: "IPC Hebron VBS",
  description: "Vacation Bible School registration and volunteer coordination",
  openGraph: {
    type: "website",
    siteName: "IPC Hebron VBS",
    images: [{ url: "/vbsthemelogo.webp", alt: "IPC Hebron VBS" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/vbsthemelogo.webp"],
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
