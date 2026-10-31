/**
 * Builds a downloadable PDF security report (A4) with jsPDF.
 * Loaded on demand from the Export page so it doesn't weigh down the app.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  ConfigurationIssue,
  DependencyIssue,
  Finding,
  Scan,
  SecretFinding
} from '../types'
import { ledgerRows, openFindings, owaspLabel, scoreFor } from './reportStats'

export interface ReportData {
  scan: Scan
  findings: Finding[]
  dependencies: DependencyIssue[]
  secrets: SecretFinding[]
  configurations: ConfigurationIssue[]
}

// Palette (RGB) matching the app's light theme
const INK: [number, number, number] = [27, 36, 48]
const MUTED: [number, number, number] = [91, 102, 118]
const LINE: [number, number, number] = [213, 218, 225]
const BRAND: [number, number, number] = [20, 83, 116]
const SEVERITY: Record<string, [number, number, number]> = {
  Critical: [196, 43, 58],
  High: [217, 112, 43],
  Medium: [184, 144, 26],
  Low: [59, 126, 161]
}
const GRADE: Record<string, [number, number, number]> = {
  A: [47, 133, 90],
  B: [96, 150, 60],
  C: [184, 144, 26],
  D: [217, 112, 43],
  F: [196, 43, 58]
}
const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 }

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 16
const CONTENT_W = PAGE_W - MARGIN * 2

/**
 * jsPDF's built-in fonts only cover Windows-1252. Map common typographic
 * characters and drop anything else so text never renders as garbage.
 */
function clean(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[−‐-‒]/g, '-')
    .replace(/→/g, '->')
    .replace(/\t/g, '  ')
    .replace(/[^\n\x20-\x7E -ÿ–—•…]/g, '?')
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

export function buildPdfReport(data: ReportData): jsPDF {
  const { scan, findings, dependencies, secrets, configurations } = data
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const open = openFindings(findings)
  let y = MARGIN

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN - 8) {
      doc.addPage()
      y = MARGIN
    }
  }

  const heading = (text: string) => {
    ensureSpace(14)
    y += 4
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...INK)
    doc.text(text, MARGIN, y)
    y += 2
    doc.setDrawColor(...LINE).setLineWidth(0.3).line(MARGIN, y, PAGE_W - MARGIN, y)
    y += 5
  }

  const paragraph = (text: string, opts: { size?: number; color?: [number, number, number]; font?: 'helvetica' | 'courier'; indent?: number } = {}) => {
    const size = opts.size ?? 9.5
    const indent = opts.indent ?? 0
    doc.setFont(opts.font ?? 'helvetica', 'normal').setFontSize(size).setTextColor(...(opts.color ?? INK))
    const lines = doc.splitTextToSize(clean(text), CONTENT_W - indent) as string[]
    const lineH = size * 0.42
    for (const line of lines) {
      ensureSpace(lineH)
      doc.text(line, MARGIN + indent, y)
      y += lineH
    }
  }

  const tableDefaults = {
    margin: { left: MARGIN, right: MARGIN },
    styles: { font: 'helvetica', fontSize: 8.5, textColor: INK, cellPadding: 1.8, lineColor: LINE, lineWidth: 0.1, overflow: 'linebreak' as const },
    headStyles: { fillColor: [237, 240, 243] as [number, number, number], textColor: INK, fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: [250, 251, 252] as [number, number, number] },
    didParseCell: (hook: any) => {
      // Colour the severity column's text
      const sev = SEVERITY[String(hook.cell.raw)]
      if (hook.section === 'body' && sev) {
        hook.cell.styles.textColor = sev
        hook.cell.styles.fontStyle = 'bold'
      }
    }
  }

  const table = (head: string[], body: (string | number)[][], columnStyles: Record<number, any> = {}) => {
    autoTable(doc, {
      ...tableDefaults,
      startY: y,
      head: [head],
      body: body.map(r => r.map(c => clean(String(c)))),
      columnStyles
    })
    y = (doc as any).lastAutoTable.finalY + 4
  }

  // ── Title block ──────────────────────────────────────────────
  doc.setFillColor(...BRAND).rect(0, 0, PAGE_W, 4, 'F')
  y = MARGIN + 2
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...BRAND)
  doc.text('CODESENTINEL SECURITY REPORT', MARGIN, y)
  y += 8
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...INK)
  doc.text(clean(scan.repoName), MARGIN, y)
  y += 6
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTED)
  const meta = [
    `Branch: ${scan.branch}`,
    `Source: ${scan.source === 'github' ? 'GitHub' : 'Upload'}`,
    scan.languages.length ? `Languages: ${scan.languages.join(', ')}` : null,
    scan.linesOfCode ? `${scan.linesOfCode.toLocaleString()} lines` : null
  ].filter(Boolean).join('   |   ')
  doc.text(clean(meta), MARGIN, y)
  y += 4.5
  doc.text(`Scanned ${clean(fmtDate(scan.startedAt))}   |   Report generated ${clean(fmtDate(new Date().toISOString()))}`, MARGIN, y)
  y += 8

  // ── Score summary cards ─────────────────────────────────────
  const cardH = 24
  const gap = 4
  const cardW = (CONTENT_W - gap * 3) / 4
  const currentScore = scoreFor(open)
  const cards: { label: string; value: string; sub: string; color: [number, number, number] }[] = [
    { label: 'Security score', value: `${scan.score}`, sub: 'out of 100', color: GRADE[scan.grade] ?? INK },
    { label: 'Grade', value: scan.grade, sub: `Risk: ${scan.riskLevel}`, color: GRADE[scan.grade] ?? INK },
    { label: 'Open code issues', value: `${open.length}`, sub: `${open.filter(f => f.severity === 'Critical').length} critical`, color: INK },
    { label: 'Secrets / advisories', value: `${secrets.length} / ${dependencies.length}`, sub: `${configurations.length} config issues`, color: INK }
  ]
  cards.forEach((c, i) => {
    const x = MARGIN + i * (cardW + gap)
    doc.setDrawColor(...LINE).setFillColor(250, 251, 252).setLineWidth(0.3).roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'FD')
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED).text(c.label.toUpperCase(), x + 3.5, y + 5.5)
    doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...c.color).text(c.value, x + 3.5, y + 14.5)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED).text(clean(c.sub), x + 3.5, y + 20)
  })
  y += cardH + 6

  // ── Executive summary ───────────────────────────────────────
  heading('Summary')
  const critical = open.filter(f => f.severity === 'Critical').length
  const high = open.filter(f => f.severity === 'High').length
  const fixFirst = [...open]
    .sort((a, b) => b.pointsGainedIfFixed - a.pointsGainedIfFixed || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, 5)
  const projected = scoreFor(open.filter(f => !fixFirst.includes(f)))
  const summary =
    open.length === 0
      ? `No open code issues were found. The code scores ${scan.score}/100 (grade ${scan.grade}).`
      : `The code scores ${scan.score}/100 (grade ${scan.grade}, ${scan.riskLevel.toLowerCase()} risk) with ${open.length} open code ` +
        `${open.length === 1 ? 'issue' : 'issues'}, including ${critical} critical and ${high} high severity. ` +
        `Fixing the ${fixFirst.length} highest-impact ${fixFirst.length === 1 ? 'issue' : 'issues'} listed below would raise the score from ${currentScore} to ${projected}.`
  paragraph(summary)
  if (secrets.length) {
    y += 1.5
    paragraph(`${secrets.length} hardcoded ${secrets.length === 1 ? 'secret was' : 'secrets were'} found. Rotate ${secrets.length === 1 ? 'it' : 'them'} immediately: committed secrets remain in git history even after they are deleted.`, { color: SEVERITY.Critical })
  }

  // ── Debt ledger ─────────────────────────────────────────────
  heading('Debt ledger')
  const rows = ledgerRows(open)
  table(
    ['Severity', 'Open issues', 'Points lost', 'Share of issues'],
    [
      ...rows.map(r => [r.severity, r.issues, r.pointsLost ? `-${r.pointsLost}` : '0', `${r.shareOfIssues}%`]),
      ['Total', open.length, `-${Math.min(100, rows.reduce((s, r) => s + r.pointsLost, 0))}`, open.length ? '100%' : '0%']
    ],
    { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } }
  )

  // ── Fix first ───────────────────────────────────────────────
  if (fixFirst.length) {
    heading('Fix first')
    table(
      ['#', 'Severity', 'Issue', 'Location', 'If fixed'],
      fixFirst.map((f, i) => [i + 1, f.severity, f.title, `${f.filePath}:${f.lineStart}`, `+${f.pointsGainedIfFixed} pts`]),
      { 0: { cellWidth: 7 }, 1: { cellWidth: 20 }, 3: { cellWidth: 50, font: 'courier', fontSize: 7.5 }, 4: { cellWidth: 18, halign: 'right' } }
    )
  }

  // ── All code findings ───────────────────────────────────────
  heading(`Code findings (${findings.length})`)
  if (findings.length === 0) {
    paragraph('No code vulnerabilities were found.', { color: MUTED })
  } else {
    const sorted = [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    table(
      ['Severity', 'Issue', 'Location', 'CWE', 'OWASP', 'Status'],
      sorted.map(f => [f.severity, f.title, `${f.filePath}:${f.lineStart}`, f.cwe, owaspLabel(f), f.status]),
      { 0: { cellWidth: 18 }, 2: { cellWidth: 40, font: 'courier', fontSize: 7.5 }, 3: { cellWidth: 19, overflow: 'visible' }, 4: { cellWidth: 32 }, 5: { cellWidth: 18 } }
    )

    // Detail for each open finding
    const details = sorted.filter(f => f.status !== 'Fixed' && f.status !== 'Ignored')
    if (details.length) {
      heading('Finding details and fixes')
      details.forEach((f, i) => {
        ensureSpace(22)
        doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...INK)
        const title = doc.splitTextToSize(clean(`${i + 1}. ${f.title}`), CONTENT_W - 24) as string[]
        doc.text(title, MARGIN, y)
        doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...(SEVERITY[f.severity] ?? INK))
        doc.text(f.severity.toUpperCase(), PAGE_W - MARGIN, y, { align: 'right' })
        y += title.length * 4.3 + 0.5
        const where = f.lineEnd > f.lineStart ? `lines ${f.lineStart}-${f.lineEnd}` : `line ${f.lineStart}`
        paragraph(`${f.filePath}  ${where}   |   ${f.cwe || f.category}   |   ${owaspLabel(f)}   |   +${f.pointsGainedIfFixed} pts if fixed`, { size: 8, color: MUTED })
        y += 1.5
        if (f.description) {
          paragraph(f.description, { size: 9 })
          y += 1.5
        }
        if (f.aiFix.explanation) {
          // Keep the heading with at least two lines of its text
          ensureSpace(14)
          doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...BRAND)
          doc.text('How to fix', MARGIN, y)
          y += 4
          paragraph(f.aiFix.explanation, { size: 9 })
        }
        if (f.aiFix.after) {
          y += 1.5
          // Capped at 20 lines (~70mm) so the whole box always fits on one page
          const codeLines = (doc.setFont('courier', 'normal').setFontSize(7.5).splitTextToSize(clean(f.aiFix.after), CONTENT_W - 6) as string[]).slice(0, 20)
          const boxH = codeLines.length * 3.3 + 3
          ensureSpace(boxH + 2)
          doc.setFillColor(246, 248, 250).setDrawColor(...LINE).setLineWidth(0.2).rect(MARGIN, y - 1, CONTENT_W, boxH, 'FD')
          doc.setTextColor(...INK)
          y += 2.2
          for (const line of codeLines) {
            doc.text(line, MARGIN + 3, y)
            y += 3.3
          }
          y += 1
        }
        y += 4
      })
    }
  }

  // ── Secrets ─────────────────────────────────────────────────
  heading(`Hardcoded secrets (${secrets.length})`)
  if (secrets.length === 0) paragraph('No hardcoded secrets were found.', { color: MUTED })
  else
    table(
      ['Severity', 'Type', 'Location', 'Masked value'],
      secrets.map(s => [s.severity, s.type, `${s.filePath}:${s.line}`, s.maskedValue]),
      { 0: { cellWidth: 18 }, 2: { font: 'courier', fontSize: 7.5 }, 3: { font: 'courier', fontSize: 7.5 } }
    )

  // ── Dependencies ────────────────────────────────────────────
  heading(`Vulnerable dependencies (${dependencies.length})`)
  if (dependencies.length === 0) paragraph('No known vulnerabilities in declared dependencies.', { color: MUTED })
  else
    table(
      ['Severity', 'Package', 'Installed', 'Fixed in', 'Advisory', 'Summary'],
      [...dependencies]
        .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
        .map(d => [d.severity, d.package, d.currentVersion, d.fixedVersion, d.cve, d.description]),
      { 0: { cellWidth: 18 }, 1: { cellWidth: 22 }, 2: { cellWidth: 17 }, 3: { cellWidth: 17 }, 4: { cellWidth: 30, font: 'courier', fontSize: 7 }, 5: { fontSize: 7.5 } }
    )

  // ── Configuration ───────────────────────────────────────────
  heading(`Configuration issues (${configurations.length})`)
  if (configurations.length === 0) paragraph('No configuration issues were found.', { color: MUTED })
  else
    table(
      ['Severity', 'Issue', 'File', 'Rule'],
      configurations.map(c => [c.severity, c.issue, c.filePath, c.rule]),
      { 0: { cellWidth: 18 }, 2: { font: 'courier', fontSize: 7.5 }, 3: { cellWidth: 36, font: 'courier', fontSize: 7.5 } }
    )

  // ── Footer on every page ────────────────────────────────────
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...LINE).setLineWidth(0.2).line(MARGIN, PAGE_H - 11, PAGE_W - MARGIN, PAGE_H - 11)
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED)
    doc.text(clean(`CodeSentinel  |  ${scan.repoName} (${scan.branch})  |  Findings are AI-assisted; review before acting.`), MARGIN, PAGE_H - 7)
    doc.text(`Page ${p} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 7, { align: 'right' })
  }

  doc.setProperties({
    title: `CodeSentinel report - ${clean(scan.repoName)}`,
    subject: 'Security debt report',
    creator: 'CodeSentinel'
  })
  return doc
}
