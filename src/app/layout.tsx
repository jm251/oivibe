import type { Metadata } from "next";
import "@/app/globals.css";

import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "OI VIBE",
  description: "Live NSE F&O intelligence dashboard"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}