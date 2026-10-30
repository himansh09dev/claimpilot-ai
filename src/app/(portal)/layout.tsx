import type { ReactNode } from "react";
import { PortalHeader } from "@/components/layout/PortalHeader";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PortalHeader />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 focus:outline-none sm:px-6">
        {children}
      </main>
    </div>
  );
}
