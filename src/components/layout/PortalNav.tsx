"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/claims", label: "My claims" },
  { href: "/claims/new", label: "New claim" },
] as const;

/** Picks the most specific matching item so "/claims/new" doesn't also highlight "/claims". */
function activeHref(pathname: string): string | undefined {
  return NAV_ITEMS.map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

export function PortalNav() {
  const pathname = usePathname();
  const current = activeHref(pathname);

  return (
    <nav aria-label="Portal">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === current;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
