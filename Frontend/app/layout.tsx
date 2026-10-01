import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "../styles/globals.css";
import { Toaster } from "sonner";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Sales AI Coach",
  description: "B2B SaaS for Sales Coaching and Roleplay",
  icons: {
    icon: "/m-logo.png",
  },
};

import { ThemeProvider } from "../components/ThemeProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Potongan baris di dalam Frontend/app/layout.tsx
return (
  <html lang="id" suppressHydrationWarning>
    {/* Biarkan class dikontrol penuh oleh ThemeProvider, jangan hardcode warna spesifik di body */}
    <body suppressHydrationWarning className={`${dmSans.variable} font-sans antialiased`}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
      >
        {children}
        <Toaster position="bottom-right" offset={{ top: 180 }} mobileOffset={{ top: 180 }} richColors />
      </ThemeProvider>
    </body>
  </html>
);
}
