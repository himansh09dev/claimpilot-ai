import { Badge } from "@/components/ui/Badge";
import { isClaimsApiConfigured } from "@/lib/claims/claims-service";
import { Logo } from "./Logo";
import { PortalNav } from "./PortalNav";

export function PortalHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between gap-4">
          <Logo href="/dashboard" />
          {isClaimsApiConfigured() ? (
            <Badge tone="success">Claims API connected</Badge>
          ) : (
            <Badge tone="warning">Claims API not configured</Badge>
          )}
        </div>
        <PortalNav />
      </div>
    </header>
  );
}
