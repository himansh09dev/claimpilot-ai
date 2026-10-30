import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SkipLink } from "@/components/layout/SkipLink";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ClaimPilot AI — Insurance claim portal",
    template: "%s · ClaimPilot AI",
  },
  description:
    "File and track insurance claims with guided checks. Portfolio demo — not a real insurer.",
};

export const viewport: Viewport = {
  themeColor: "#2554e8",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
