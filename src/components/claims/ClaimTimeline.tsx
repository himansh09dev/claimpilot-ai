import { formatDateTime } from "@/lib/claims/format";
import type { ClaimTimelineEvent } from "@/lib/claims/types";

export function ClaimTimeline({ events }: { events: readonly ClaimTimelineEvent[] }) {
  return (
    <ol className="space-y-5">
      {events.map((event, index) => {
        const isLatest = index === events.length - 1;
        return (
          <li key={`${event.at}-${event.title}`} className="relative flex gap-3">
            {!isLatest && (
              <span className="absolute top-5 left-[5px] h-[calc(100%+0.25rem)] w-px bg-slate-200" aria-hidden="true" />
            )}
            <span
              className={
                isLatest
                  ? "mt-1.5 size-3 shrink-0 rounded-full bg-brand-600 ring-4 ring-brand-100"
                  : "mt-1.5 size-3 shrink-0 rounded-full bg-slate-300"
              }
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {event.title}
                {isLatest && <span className="sr-only"> (latest update)</span>}
              </p>
              <p className="text-xs text-slate-500">
                <time dateTime={event.at}>{formatDateTime(event.at)} UTC</time>
              </p>
              {event.detail && <p className="mt-1 text-sm text-slate-600">{event.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
