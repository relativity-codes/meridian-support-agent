import type { Metadata } from "next";

import { AppProviders } from "@/components/providers/AppProviders";
import { MERIDIAN_METADATA_DESCRIPTION, MERIDIAN_METADATA_TITLE } from "@/lib/meridian";

import "./globals.css";

export const metadata: Metadata = {
  title: MERIDIAN_METADATA_TITLE,
  description: MERIDIAN_METADATA_DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
