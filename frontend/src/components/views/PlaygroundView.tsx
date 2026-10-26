import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  Info,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react'
import { ActionBadge } from '../ActionBadge'
import { RiskMeter } from '../RiskMeter'
import type { Scenario, ScanResult } from '../../types'

export const SAMPLE_SCENARIOS: Scenario[] = [
  {
    id: 'public-info',
    label: 'Public Salary Bands',
    category: 'Public Info',
    text: "Engineer salary bands are available on the company's public careers page.",
    expected: 'Allow — Public market benchmark, zero personal PII',
  },
  {
    id: 'compensation',
    label: 'Confidential Compensation',
    category: 'PII & Comp',
    text: "Anita's salary is being raised to ₹18 lakh.",
    expected: 'Redact — Personal compensation tied to named employee',
  },
  {
    id: 'credential',
    label: 'Administrative Credential',
    category: 'Exfiltration',
    text: 'The admin password is Mx7!qR2z.',
    expected: 'Block — High-entropy credential exfiltration (fails closed)',
  },
  {
    id: 'public-guidance',
    label: 'Password Governance',
    category: 'Governance',
    text: 'Passwords must contain at least 12 characters.',
    expected: 'Allow — Standard security guidance, no real secret',
  },
  {
    id: 'email',
    label: 'Customer Contact Email',
    category: 'Contact PII',
    text: 'Send the customer report to priya@example.com.',
    expected: 'Redact — Individual email address sent to external destination',
  },
  {
    id: 'ambiguous',
    label: 'Contextual Compensation',
    category: 'Contextual',
    text: "Anita's compensation was revised upward during the latest review.",
    expected: 'Redact — Contextual salary discussion without explicit currency',
  },
]

interface PlaygroundViewProps {
  result: ScanResult | null
  isLoading: boolean
  error: string | null
  role: string
  destination: string
  prompt: string
  selectedScenario: string
  onRoleChange: (v: string) => void
  onDestinationChange: (v: string) => void
  onPromptChange: (v: string) => void
  onScenarioChange: (id: string) => void
  onScan: () => void
  onClear: () => void
}

export function PlaygroundView({
  result,
  isLoading,
  error,
  role,
  destination,
  prompt,
  selectedScenario,
  onRoleChange,
  onDestinationChange,
  onPromptChange,
  onScenarioChange,
  onScan,
  onClear,
}: PlaygroundViewProps) {
  const [copied, setCopied] = useState(false)
  const currentScenario = SAMPLE_SCENARIOS.find((s) => s.id === selectedScenario)

  // Stale detection: UI role or destination changed after scanning, or prompt edited
  const isStale =
    result !== null &&
    (result.evaluated_role !== role ||
      result.evaluated_destination !== destination)

  const handleCopySanitized = () => {
    if (!result?.sanitized_output) return
    void navigator.clipboard.writeText(result.sanitized_output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Stale Context Alert */}
      {isStale && (
        <div className="flex items-center justify-between rounded-xl border border-[#ECCF96] bg-[#FEF9EE] px-4 py-3 text-xs text-[#8F5E0A] shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#8F5E0A]" />
            <span>
              Evaluation context modified: Viewing decision previously computed for{' '}
              <strong className="font-semibold text-[#121C1E]">{result.evaluated_role}</strong> via{' '}
              <strong className="font-semibold text-[#121C1E]">{result.evaluated_destination}</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={onScan}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#39AEA9] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#2F938F]"
          >
            <RefreshCw className="h-3 w-3" />
            Re-scan Parameters
          </button>
        </div>
      )}

      {/* Preset Scenarios Ribbon */}
      <div className="rounded-2xl border border-[#D8E2DC] bg-white p-4 shadow-xs">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#39AEA9]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#121C1E]">
              Demonstration Scenarios
            </span>
          </div>
          <span className="text-[11px] text-[#557B83]">Select vector to test boundary rules</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {SAMPLE_SCENARIOS.map((s) => {
            const isSelected = selectedScenario === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onScenarioChange(s.id)}
                className={`flex flex-col justify-between rounded-xl border p-2.5 text-left transition-all ${
                  isSelected
                    ? 'border-[#39AEA9] bg-[#182528] text-white shadow-xs'
                    : 'border-[#D8E2DC] bg-[#F6F8F6] text-[#121C1E] hover:border-[#A2D5AB] hover:bg-white'
                }`}
              >
                <div className="truncate text-xs font-semibold">{s.label}</div>
                <div
                  className={`mt-1 truncate font-mono text-[9px] uppercase tracking-wider ${
                    isSelected ? 'text-[#A2D5AB]' : 'text-[#557B83]'
                  }`}
                >
                  {s.category}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Workstation Grid: Input Console & Decision Centerpiece */}
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        {/* Left Column: Inbound Prompt Console */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#D8E2DC] bg-white p-6 shadow-xs">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#121C1E]">Inbound Prompt Inspection</h2>
                <p className="text-xs text-[#557B83]">Submit prompt payload for real-time redaction &amp; policy routing.</p>
              </div>
              <span className="rounded-md border border-[#D8E2DC] bg-[#F6F8F6] px-2.5 py-1 font-mono text-[11px] font-medium text-[#557B83]">
                {prompt.length.toLocaleString()} / 5,000 chars
              </span>
            </div>

            {/* Prompt Textarea */}
            <div className="space-y-2">
              <textarea
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                rows={6}
                maxLength={5000}
                className="w-full resize-none rounded-xl border border-[#D8E2DC] bg-[#F6F8F6]/60 p-3.5 font-mono text-xs leading-relaxed text-[#121C1E] outline-none transition focus:border-[#39AEA9] focus:bg-white focus:ring-2 focus:ring-[#39AEA9]/20"
                placeholder="Enter prompt or paste enterprise payload to inspect..."
              />
              {currentScenario && (
                <div className="flex items-start gap-2 rounded-lg border border-[#D8E2DC] bg-[#F6F8F6] p-2.5 text-[11px] text-[#557B83]">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#39AEA9]" />
                  <span>
                    <strong className="font-semibold text-[#121C1E]">Target Ground Truth: </strong>
                    {currentScenario.expected}
                  </span>
                </div>
              )}
            </div>

            {/* Context Authorization & Boundary Selection */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="flex items-center justify-between text-xs font-semibold text-[#121C1E]">
                  <span>Caller Identity (RBAC)</span>
                  <span className="font-mono text-[10px] text-[#557B83]">Role</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => onRoleChange(e.target.value)}
                  className="w-full rounded-xl border border-[#D8E2DC] bg-white px-3 py-2 text-xs font-medium text-[#121C1E] outline-none transition focus:border-[#39AEA9] focus:ring-2 focus:ring-[#39AEA9]/20"
                >
                  <option value="General Employee">General Employee (Least Privilege)</option>
                  <option value="HR Administrator">HR Administrator (Privileged HR)</option>
                  <option value="Security Administrator">Security Administrator (Oversight)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="flex items-center justify-between text-xs font-semibold text-[#121C1E]">
                  <span>Destination Boundary</span>
                  <span className="font-mono text-[10px] text-[#557B83]">Exposure Zone</span>
                </label>
                <select
                  value={destination}
                  onChange={(e) => onDestinationChange(e.target.value)}
                  className="w-full rounded-xl border border-[#D8E2DC] bg-white px-3 py-2 text-xs font-medium text-[#121C1E] outline-none transition focus:border-[#39AEA9] focus:ring-2 focus:ring-[#39AEA9]/20"
                >
                  <option value="Local AI model">Local AI Model (Airgapped Boundary)</option>
                  <option value="External AI service">External AI Service (Third-Party Cloud)</option>
                  <option value="Internal reporting system">Internal Reporting System (Enterprise Internal)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Button Bar */}
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#D8E2DC] pt-4">
            <button
              type="button"
              onClick={onScan}
              disabled={isLoading || prompt.trim().length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-[#182528] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#203337] focus:outline-none focus:ring-2 focus:ring-[#39AEA9] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4 text-[#39AEA9]" />
              {isLoading ? 'Executing Gateway Scan...' : 'Scan & Enforce Policy'}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D8E2DC] bg-white px-3.5 py-2.5 text-xs font-medium text-[#557B83] transition hover:bg-[#F6F8F6] hover:text-[#121C1E]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>

        {/* Right Column: Enforcement Decision (The Centerpiece) */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#D8E2DC] bg-white p-6 shadow-xs">
          <div>
            <div className="mb-4 flex items-center justify-between border-b border-[#D8E2DC] pb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-[#39AEA9]" />
                <h2 className="text-sm font-bold text-[#121C1E]">Enforcement Verdict</h2>
              </div>
              {result && (
                <span className="font-mono text-[10px] text-[#557B83]">{result.event_id}</span>
              )}
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-[#F3B9B2] bg-[#FDF2F1] p-3 text-xs text-[#A82525]">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldAlert className="h-4 w-4" />
                  Scan Interrupted
                </div>
                <div className="mt-1">{error}</div>
              </div>
            )}

            {result ? (
              <div className="space-y-4">
                {/* Decision Hero Banner */}
                <div
                  className={`rounded-xl border p-4 transition-all ${
                    result.action === 'allow'
                      ? 'border-[#A2D5AB] bg-[#EDF7F1] text-[#1D603F]'
                      : result.action === 'block'
                      ? 'border-[#F3B9B2] bg-[#FDF2F1] text-[#A82525]'
                      : 'border-[#ECCF96] bg-[#FEF9EE] text-[#8F5E0A]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                      Gateway Verdict
                    </span>
                    <ActionBadge action={result.action} size="md" />
                  </div>
                  <div className="mt-2 text-xs font-semibold leading-relaxed">
                    {result.decision_reason}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px] opacity-80 border-t border-current/15 pt-2">
                    <span>Rule: <strong className="font-mono">{result.policy_rule}</strong></span>
                    <span>•</span>
                    <span>Evaluated for: <strong>{result.evaluated_role ?? role}</strong></span>
                  </div>
                </div>

                {/* Multi-Factor Risk Score Gauge */}
                <div className="rounded-xl border border-[#D8E2DC] bg-[#F6F8F6]/70 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#121C1E]">Composite Risk Assessment</span>
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`font-mono text-lg font-bold ${
                          result.risk_score > 0.8
                            ? 'text-[#A82525]'
                            : result.risk_score >= 0.3
                            ? 'text-[#8F5E0A]'
                            : 'text-[#206E4E]'
                        }`}
                      >
                        {result.risk_score.toFixed(2)}
                      </span>
                      <span className="font-mono text-[10px] text-[#557B83]">/ 1.00</span>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-[#D8E2DC] pt-2">
                    <RiskMeter
                      value={result.score_breakdown.entity_risk}
                      label="Entity Risk"
                      weight="40%"
                    />
                    <RiskMeter
                      value={result.score_breakdown.context_risk}
                      label="Context Risk"
                      weight="40%"
                    />
                    <RiskMeter
                      value={result.score_breakdown.exposure_risk}
                      label="Exposure Risk"
                      weight="20%"
                    />
                  </div>

                  <div className="border-t border-[#D8E2DC] pt-2 text-[10px] text-[#557B83] leading-relaxed">
                    Weighted linear risk model: <code>0.4×Entity + 0.4×Context + 0.2×Exposure</code>.
                    Exfiltration policies explicitly override scores to fail closed.
                  </div>
                </div>

                {/* Classification Metadata */}
                <div className="rounded-xl border border-[#D8E2DC] bg-white p-3 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#557B83]">Context Classification:</span>
                    <span className="font-semibold text-[#121C1E] capitalize">
                      {result.context_classification.label.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#557B83]">Detection Pipeline:</span>
                    <span className="font-mono text-[#557B83]">{result.detection_method}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#D8E2DC] p-8 text-center text-xs text-[#557B83]">
                <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-[#A2D5AB]" />
                Select a scenario or enter a prompt, then click &quot;Scan &amp; Enforce Policy&quot; to inspect real-time risk scores and boundary routing.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Detected Entities & Downstream Simulation */}
      {result && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Detected Sensitive Entities */}
          <div className="rounded-2xl border border-[#D8E2DC] bg-white p-6 shadow-xs">
            <div className="mb-4 flex items-center justify-between border-b border-[#D8E2DC] pb-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#39AEA9]" />
                <h3 className="text-sm font-bold text-[#121C1E]">Detected Sensitive Spans</h3>
              </div>
              <span className="rounded-full bg-[#EDF7F1] border border-[#A2D5AB] px-2 py-0.5 font-mono text-[10px] font-bold text-[#1D603F]">
                {result.detected_entities.length} Detected
              </span>
            </div>

            {result.detected_entities.length > 0 ? (
              <div className="space-y-2.5">
                {result.detected_entities.map((entity, i) => (
                  <div
                    key={`${entity.type}-${i}`}
                    className="rounded-xl border border-[#D8E2DC] bg-[#F6F8F6]/80 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#121C1E]">
                        {entity.type}
                      </span>
                      <span className="font-mono text-[10px] text-[#557B83]">
                        Confidence {(entity.confidence * 100).toFixed(0)}% • Offsets [{entity.start}:{entity.end}]
                      </span>
                    </div>
                    <div className="mt-1.5 rounded-lg border border-[#D8E2DC] bg-white px-2.5 py-1.5 font-mono text-xs font-semibold text-[#121C1E] break-all">
                      {entity.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#D8E2DC] p-6 text-center text-xs text-[#557B83]">
                No isolated sensitive tokens found. Decision was evaluated via macro contextual signals and destination boundary rules.
              </div>
            )}
          </div>

          {/* Sanitized Downstream Simulation Payload */}
          <div className="rounded-2xl border border-[#D8E2DC] bg-white p-6 shadow-xs">
            <div className="mb-4 flex items-center justify-between border-b border-[#D8E2DC] pb-3">
              <div className="flex items-center gap-2">
                <ShieldOff className="h-4 w-4 text-[#39AEA9]" />
                <h3 className="text-sm font-bold text-[#121C1E]">Downstream Gateway Dispatch</h3>
              </div>
              <span className="rounded-md border border-[#D8E2DC] bg-[#F6F8F6] px-2 py-0.5 font-mono text-[10px] text-[#557B83]">
                Sandbox Simulation
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#557B83]">
                    Sanitized Payload Sent to Model
                  </span>
                  {result.sanitized_output && (
                    <button
                      type="button"
                      onClick={handleCopySanitized}
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-[#39AEA9] hover:underline"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? 'Copied' : 'Copy Payload'}
                    </button>
                  )}
                </div>
                <div className="mt-1.5 rounded-xl border border-[#D8E2DC] bg-[#F6F8F6] p-3 font-mono text-xs leading-relaxed text-[#121C1E] break-words">
                  {result.sanitized_output || '— (No payload forwarded)'}
                </div>
              </div>

              <div className="rounded-xl border border-[#D8E2DC] bg-[#F6F8F6]/60 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#121C1E]">
                  <Lock className="h-3.5 w-3.5 text-[#39AEA9]" />
                  <span>Downstream Model Invocation State</span>
                </div>
                {result.downstream.invoked ? (
                  <div className="space-y-1.5 text-xs text-[#557B83]">
                    <div>
                      <span className="font-medium text-[#121C1E]">Payload Received: </span>
                      <span className="font-mono text-[#121C1E]">{result.downstream.received_payload ?? '(empty)'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-[#121C1E]">Model Response: </span>
                      <span className="italic text-[#121C1E]">{result.downstream.response}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-semibold text-[#206E4E] text-[11px] pt-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#39AEA9]" />
                      <span>Boundary invariant preserved: Raw prompt was withheld from downstream execution.</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-[#FDF2F1] border border-[#F3B9B2] p-2.5 text-xs text-[#A82525] font-medium">
                    ✕ Downstream model execution suppressed by fail-closed policy. Zero payload transmitted.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
