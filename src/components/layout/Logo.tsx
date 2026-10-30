import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-md font-semibold text-slate-900">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white" aria-hidden="true">
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4.5 6v5.25c0 4.5 3.2 8.4 7.5 9.75 4.3-1.35 7.5-5.25 7.5-9.75V6L12 3Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
        </svg>
      </span>
      <span>
        ClaimPilot <span className="text-brand-600">AI</span>
      </span>
    </Link>
  );
}
