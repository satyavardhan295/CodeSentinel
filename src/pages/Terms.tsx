import React from 'react'

const LAST_UPDATED = '31 October 2026'

const TERMS: { title: string; body: string[] }[] = [
  {
    title: '1. Acceptance of these terms',
    body: [
      'By using CodeSentinel you agree to these Terms & Conditions. If you do not agree, do not use the service.'
    ]
  },
  {
    title: '2. The service',
    body: [
      'CodeSentinel analyses source code you upload or connect from GitHub and reports security findings and a security score with an A–F grade.',
      'Findings are produced by automated tools, including an AI model. They can be incomplete or inaccurate, and a good score does not guarantee that your code is secure. Always review findings and suggested fixes before relying on them.'
    ]
  },
  {
    title: '3. Your code and your rights to it',
    body: [
      'Only scan code that you own or are authorised to analyse. You keep all rights to your code.',
      'You allow CodeSentinel to process your code only as needed to run the scans you request. Uploaded files and cloned repositories are deleted when a scan finishes; scan results are kept until you delete them from Scan history.'
    ]
  },
  {
    title: '4. Third-party services',
    body: [
      'To produce results, code is sent to Google Gemini for AI review (with detected credentials redacted first), and package names and versions are sent to the OSV vulnerability database. Repositories are fetched from GitHub. Your use of those services is also subject to their own terms.'
    ]
  },
  {
    title: '5. Your account',
    body: [
      'Keep your password private; you are responsible for activity under your account. You can change your password or permanently delete your account, together with all of its scans and its GitHub connection, at any time in Settings.'
    ]
  },
  {
    title: '6. GitHub connection',
    body: [
      'If you connect a GitHub personal access token, it is used only to list and read the repositories you choose to scan. You can disconnect at any time in Settings, which deletes the stored token. Revoking the token on GitHub also ends access.'
    ]
  },
  {
    title: '7. Acceptable use',
    body: [
      'Do not use CodeSentinel to analyse code you have no right to access, to attack or probe systems you do not own, or to interfere with the service or the third-party services it relies on.'
    ]
  },
  {
    title: '8. Plans and payments',
    body: [
      'CodeSentinel is currently free to use. Paid plans are shown for information only and cannot be purchased yet. Prices and features may change before they launch.'
    ]
  },
  {
    title: '9. No warranty',
    body: [
      'The service is provided "as is" and "as available", without warranties of any kind, including fitness for a particular purpose or that it will detect every vulnerability.'
    ]
  },
  {
    title: '10. Limitation of liability',
    body: [
      'To the extent permitted by law, CodeSentinel is not liable for any loss or damage arising from your use of the service or from acting, or not acting, on its findings.'
    ]
  },
  {
    title: '11. Changes to these terms',
    body: [
      'These terms may be updated from time to time. The date at the top of this page shows when they last changed. Continuing to use CodeSentinel after a change means you accept the updated terms.'
    ]
  }
]

export const Terms: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4 md:px-8 space-y-8">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold text-ink">
          Terms &amp; Conditions
        </h1>
        <p className="text-sm text-muted mt-1">Last updated {LAST_UPDATED}</p>
      </div>

      {TERMS.map(section => (
        <section key={section.title} className="space-y-2">
          <h2 className="text-sm font-semibold text-ink">{section.title}</h2>
          {section.body.map(paragraph => (
            <p key={paragraph} className="text-sm text-muted leading-relaxed">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </div>
  )
}
