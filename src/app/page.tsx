import { ClaimStatusBadge } from "@/components/claims/ClaimStatusBadge";
import { PreviewBadge } from "@/components/claims/PreviewBadge";
import { Logo } from "@/components/layout/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/claims/format";

const FEATURES = [
  {
    title: "Guided claim form",
    body: "Clear questions, instant checks and helpful messages, so your claim is complete the first time.",
  },
  {
    title: "Document checks",
    body: "Attach a receipt, invoice or report as a PDF. We check the file before it's ever sent.",
  },
  {
    title: "Transparent tracking",
    body: "Follow each step of the review, from received to decision, with a clear timeline.",
  },
] as const;

const STEPS = [
  { title: "Tell us what happened", body: "Policy number, incident date, category and amount." },
  { title: "Attach your proof", body: "Upload one supporting PDF up to 10 MB." },
  { title: "Track the review", body: "Watch your claim move through verification to a decision." },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <ButtonLink href="/dashboard" variant="secondary" size="sm">
            Open portal
          </ButtonLink>
        </div>
      </header>

      <main id="main" className="flex-1">
        <section className="bg-gradient-to-b from-brand-50 to-slate-50">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
                Insurance claim portal
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                File your claim with confidence.
              </h1>
              <p className="mt-4 max-w-xl text-lg text-slate-600">
                ClaimPilot guides you through every detail, checks your documents up front and keeps
                you informed until a decision is made.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/claims/new" size="lg">
                  Start a claim
                </ButtonLink>
                <ButtonLink href="/dashboard" variant="secondary" size="lg">
                  Go to dashboard
                </ButtonLink>
              </div>
            </div>

            {/* Illustrative product preview — clearly labeled as sample data. */}
            <Card className="p-5 sm:p-6" aria-label="Example claim (preview data)">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm font-medium text-brand-700">PRV-1048</span>
                <PreviewBadge label="Sample" />
              </div>
              <p className="mt-3 text-lg font-semibold text-slate-900">Auto / Vehicle</p>
              <p className="text-sm text-slate-600">Rear-end collision · {formatCurrency(3840.5)}</p>
              <div className="mt-4 flex items-center gap-2">
                <ClaimStatusBadge status="in_review" />
                <span className="text-xs text-slate-500">Updated 2 days ago</span>
              </div>
              <ol className="mt-5 space-y-3 border-t border-slate-200 pt-5 text-sm">
                {["Claim received", "Document checks passed", "Assigned for review"].map((step, i) => (
                  <li key={step} className="flex items-center gap-3">
                    <span
                      className={
                        i === 2
                          ? "size-2.5 rounded-full bg-brand-600 ring-4 ring-brand-100"
                          : "size-2.5 rounded-full bg-slate-300"
                      }
                      aria-hidden="true"
                    />
                    <span className={i === 2 ? "font-medium text-slate-900" : "text-slate-600"}>{step}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </section>

        <section aria-labelledby="features-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="features-heading" className="text-2xl font-semibold tracking-tight text-slate-900">
            Designed to make claims less stressful
          </h2>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <Card className="h-full p-6">
                  <h3 className="font-semibold text-slate-900">{feature.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{feature.body}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="steps-heading" className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 id="steps-heading" className="text-2xl font-semibold tracking-tight text-slate-900">
              How it works
            </h2>
            <ol className="mt-8 grid gap-8 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-900">{step.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-10">
              <ButtonLink href="/claims/new">Start a claim</ButtonLink>
            </div>
          </div>
        </section>
      </main>

    </div>
  );
}
