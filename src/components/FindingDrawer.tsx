import React, { useState, useEffect } from 'react'
import {
  X,
  ExternalLink,
  MessageSquare,
  Send,
  Loader2,
  FileCode2,
  TrendingUp
} from 'lucide-react'
import { Finding } from '../types'
import { SeverityBadge } from './SeverityBadge'
import { CodeDiff } from './CodeDiff'
import { chatAboutFinding } from '../api/client'

interface FindingDrawerProps {
  finding: Finding | null
  isOpen: boolean
  onClose: () => void
  onUpdateFinding: (
    findingId: string,
    patch: Partial<Pick<Finding, 'status' | 'notes'>>
  ) => Promise<Finding | void>
  onShowToast: (message: string) => void
}

interface ChatMessage {
  sender: 'user' | 'assistant'
  text: string
}

export const FindingDrawer: React.FC<FindingDrawerProps> = ({
  finding,
  isOpen,
  onClose,
  onUpdateFinding,
  onShowToast
}) => {
  const [currentStatus, setCurrentStatus] = useState<Finding['status']>('Open')
  const [notes, setNotes] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (finding) {
      setCurrentStatus(finding.status)
      setNotes(finding.notes || '')
      setChatMessages([
        {
          sender: 'assistant',
          text: `Ask questions about ${finding.title} or how to verify the patch.`
        }
      ])
    }
  }, [finding])

  if (!isOpen || !finding) return null

  const handleStatusChange = async (newStatus: Finding['status']) => {
    const previous = currentStatus
    setCurrentStatus(newStatus)
    try {
      setIsSaving(true)
      await onUpdateFinding(finding.id, { status: newStatus })
      onShowToast(newStatus === 'Fixed' ? 'Marked as fixed' : `Status updated to ${newStatus}`)
    } catch (err: any) {
      setCurrentStatus(previous)
      onShowToast(err?.message || 'Could not update the status')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveNotes = async () => {
    try {
      setIsSaving(true)
      await onUpdateFinding(finding.id, { notes })
      onShowToast('Notes saved')
    } catch (err: any) {
      onShowToast(err?.message || 'Could not save notes')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || chatLoading) return

    const userText = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { sender: 'user', text: userText }])
    setChatLoading(true)

    try {
      const response = await chatAboutFinding(finding.id, userText)
      setChatMessages(prev => [
        ...prev,
        { sender: 'assistant', text: response.reply }
      ])
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        { sender: 'assistant', text: err?.message || 'Unable to answer right now. Try asking again.' }
      ])
    } finally {
      setChatLoading(false)
    }
  }

  const snippetLines = finding.codeSnippet.split('\n')

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Surface */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-6">
        <div className="w-screen max-w-2xl bg-surface border-l border-line overlay-shadow flex flex-col rounded-l-lg overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-line flex items-start justify-between gap-4 bg-surface">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <SeverityBadge severity={finding.severity} />
                <span className="text-xs text-muted font-mono">{finding.cwe}</span>
                <span className="text-xs text-muted font-mono">{finding.owasp}</span>
              </div>
              <h2 className="text-lg font-heading font-semibold text-ink leading-snug">
                {finding.title}
              </h2>
              <div className="flex items-center gap-4 text-xs text-muted font-mono">
                <span className="inline-flex items-center gap-1">
                  <FileCode2 size={16} strokeWidth={1.5} />
                  {finding.filePath}:{finding.lineStart}–{finding.lineEnd}
                </span>
                <span className="inline-flex items-center gap-1 font-sans text-severity-fixed">
                  <TrendingUp size={16} strokeWidth={1.5} />
                  +{finding.pointsGainedIfFixed} pts
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-muted hover:text-ink rounded-md hover:bg-bg transition-colors"
              aria-label="Close drawer"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>

          {/* Drawer Body — Divided Sections (no cards) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Section 1: Explanation */}
            <div>
              <h3 className="text-sm font-semibold text-ink mb-1.5">Description</h3>
              <p className="text-sm text-ink leading-relaxed max-w-[65ch]">
                {finding.description}
              </p>
            </div>

            <hr className="border-t border-line" />

            {/* Section 2: Vulnerable code snippet */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-ink">Vulnerable code</h3>
                <span className="text-xs text-muted font-mono">
                  {finding.filePath}
                </span>
              </div>
              <div className="rounded-sm border border-line bg-bg p-3 overflow-x-auto font-mono text-xs">
                {snippetLines.map((line, idx) => (
                  <div key={idx} className="flex gap-3 leading-5">
                    <span className="text-muted/60 select-none w-8 text-right tabular-nums">
                      {finding.lineStart + idx}
                    </span>
                    <span className="text-ink whitespace-pre">{line || ' '}</span>
                  </div>
                ))}
              </div>
            </div>

            <hr className="border-t border-line" />

            {/* Section 3: AI suggested fix */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-ink">Suggested fix</h3>
                <span className="text-xs text-muted">
                  Suggested by AI — review before applying
                </span>
              </div>

              <CodeDiff
                before={finding.aiFix.before}
                after={finding.aiFix.after}
                onCopy={() => onShowToast('Copied fix')}
              />

              <p className="text-xs text-muted mt-2 leading-relaxed">
                {finding.aiFix.explanation}
              </p>
            </div>

            <hr className="border-t border-line" />

            {/* Section 4: Step-by-step remediation */}
            <div>
              <h3 className="text-sm font-semibold text-ink mb-2">Remediation steps</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-ink leading-relaxed">
                <li>Locate the target statement in <span className="font-mono text-xs">{finding.filePath}</span> at line {finding.lineStart}.</li>
                <li>Replace dynamically formatted parameter bindings with verified parameterized queries or safe APIs.</li>
                <li>Add input validation or type assertions before calling the data layer.</li>
                <li>Execute regression unit tests covering malicious payload injection variants.</li>
                <li>Deploy to staging environment and verify the vulnerability scanner reports resolved status.</li>
              </ol>
            </div>

            <hr className="border-t border-line" />

            {/* Section 5: Attack scenario */}
            <div>
              <h3 className="text-sm font-semibold text-ink mb-1.5">How an attacker could use this</h3>
              <p className="text-sm text-ink leading-relaxed max-w-[65ch]">
                {finding.attackScenario}
              </p>
            </div>

            <hr className="border-t border-line" />

            {/* Section 6: References */}
            <div>
              <h3 className="text-sm font-semibold text-ink mb-2">References</h3>
              <div className="space-y-1.5 text-xs">
                <div>
                  <a
                    href={`https://cwe.mitre.org/data/definitions/${finding.cwe.replace('CWE-', '')}.html`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-brand hover:underline"
                  >
                    Mitre {finding.cwe} definition
                    <ExternalLink size={16} strokeWidth={1.5} />
                  </a>
                </div>
                <div>
                  <a
                    href="https://owasp.org/Top10/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-brand hover:underline"
                  >
                    OWASP Top 10 — {finding.owasp}
                    <ExternalLink size={16} strokeWidth={1.5} />
                  </a>
                </div>
              </div>
            </div>

            <hr className="border-t border-line" />

            {/* Section 7: Status & Notes */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">Remediation status & notes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="finding-status-select" className="block text-xs text-muted mb-1 font-medium">Status</label>
                  <select
                    id="finding-status-select"
                    value={currentStatus}
                    onChange={e => handleStatusChange(e.target.value as Finding['status'])}
                    className="w-full bg-surface border border-line rounded-sm px-2.5 py-1.5 text-sm text-ink"
                  >
                    <option value="Open">Open</option>
                    <option value="In progress">In progress</option>
                    <option value="Fixed">Fixed</option>
                    <option value="Ignored">Ignored</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="finding-notes-textarea" className="block text-xs text-muted mb-1 font-medium">Internal notes</label>
                <textarea
                  id="finding-notes-textarea"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-surface border border-line rounded-sm p-2 text-sm text-ink"
                />
                <div className="mt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={isSaving}
                    className="px-3 py-1 text-xs font-medium bg-surface border border-line rounded-md text-ink hover:border-brand transition-colors"
                  >
                    {isSaving ? 'Saving...' : 'Save notes'}
                  </button>
                </div>
              </div>
            </div>

            <hr className="border-t border-line" />

            {/* Section 8: Ask about this issue (AI Chat) */}
            <div className="space-y-3 pb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink inline-flex items-center gap-1.5">
                  <MessageSquare size={16} strokeWidth={1.5} />
                  Ask about this issue
                </h3>
                <span className="text-xs text-muted">
                  Suggested by AI — review before applying
                </span>
              </div>

              <div className="border border-line rounded-sm p-3 bg-bg/40 space-y-2.5 max-h-56 overflow-y-auto text-xs">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded-sm max-w-[90%] leading-relaxed whitespace-pre-wrap break-words ${
                      msg.sender === 'user'
                        ? 'ml-auto bg-brand text-white'
                        : 'bg-surface border border-line text-ink'
                    }`}
                  >
                    {msg.text}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                    <span>Analyzing codebase context...</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  aria-label="Ask the AI about this finding"
                  className="flex-1 bg-surface border border-line rounded-sm px-2.5 py-1.5 text-xs text-ink"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || chatLoading}
                  className="px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-md hover:bg-brand-hover disabled:opacity-50 transition-colors inline-flex items-center gap-1"
                >
                  <Send size={16} strokeWidth={1.5} />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
