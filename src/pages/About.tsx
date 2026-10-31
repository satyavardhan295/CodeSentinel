import React from 'react'
import { Link } from 'react-router-dom'

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="text-sm font-semibold text-ink">{title}</h2>
    <div className="text-sm text-muted leading-relaxed space-y-2">{children}</div>
  </section>
)

export const About: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4 md:px-8 space-y-8">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold text-ink">About us</h1>
        <p className="text-sm text-muted mt-1">
          CodeSentinel is a credit report for your codebase&apos;s security.
        </p>
      </div>

      <Section title="What we do">
        <p>
          Every codebase carries security debt: vulnerable code paths, leaked credentials,
          outdated dependencies and risky configuration. CodeSentinel finds that debt, turns it
          into a single security score, and tells you what to fix first for the biggest
          improvement in that score.
        </p>
      </Section>

      <Section title="How a scan works">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <span className="text-ink font-medium">AI code review.</span> Google Gemini reviews your
            source files for vulnerabilities and suggests a fix for each one.
          </li>
          <li>
            <span className="text-ink font-medium">Secret detection.</span> Hardcoded keys,
            tokens and passwords are found and masked in the results.
          </li>
          <li>
            <span className="text-ink font-medium">Dependency checks.</span> Package versions are
            matched against known vulnerabilities in the open OSV database.
          </li>
          <li>
            <span className="text-ink font-medium">Configuration checks.</span> Rules flag settings
            such as disabled TLS verification, debug mode and overly open CORS.
          </li>
        </ul>
        <p>
          The results roll up into a score from 0 to 100, an A–F grade and a risk level, and
          every finding shows how many points fixing it would win back.
        </p>
      </Section>

      <Section title="How we treat your code">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Uploaded files and cloned repositories are deleted as soon as a scan finishes.</li>
          <li>
            Anything that looks like a credential is redacted before code is sent for AI review,
            and <code className="font-mono">.env</code> files are never sent at all.
          </li>
          <li>
            A connected GitHub token is used only to read the repositories you scan and is never
            shown again after you save it.
          </li>
        </ul>
      </Section>

      <p className="text-xs text-muted">
        Ready to see where you stand?{' '}
        <Link to="/" className="text-brand hover:underline">
          Start a scan
        </Link>
        .
      </p>
    </div>
  )
}
