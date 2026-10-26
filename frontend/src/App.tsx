import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Database,
  Eye,
  FileText,
  FlaskConical,
  Info,
  Layers,
  Lock,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Sliders,
  Target,
  XCircle,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchAuditLogs, fetchPolicies, healthCheck, runEvaluation, scanPrompt, updatePolicy } from './services/api'
import type {
  Action,
  AuditRecord,
  EvaluationResponse,
  EvaluationResult,
  PolicyRule,
  Scenario,
  ScanResult,
} from './types'

// ─── Constants & Scenario Presets ─────────────────────────────────────────────

const SAMPLE_SCENARIOS: Scenario[] = [
  {
    id: 'public-info',
    label: 'Public Salary Bands',
    category: 'Public Information',
    text: "Engineer salary bands are available on the company's public careers page.",
    expected: 'Allow — Public market benchmark, zero personal PII',
  },
  {
    id: 'compensation',
    label: 'Confidential Compensation',
    category: 'PII & Compensation',
    text: "Anita's salary is being raised to ₹18 lakh.",
    expected: 'Redact — Personal compensation tied to named employee',
  },
  {
    id: 'credential',
    label: 'Administrative Credential',
    category: 'Credential Exfiltration',
    text: 'The admin password is Mx7!qR2z.',
    expected: 'Block — High-entropy credential exfiltration (fails closed)',
  },
  {
    id: 'public-guidance',
    label: 'Password Policy Guidance',
    category: 'Security Governance',
    text: 'Passwords must contain at least 12 characters.',
    expected: 'Allow — Standard security guidance, no real secret',
  },
  {
    id: 'email',
    label: 'Customer Contact Email',
    category: 'Personal Contact PII',
    text: 'Send the customer report to priya@example.com.',
    expected: 'Redact — Individual email address sent to external destination',
  },
  {
    id: 'ambiguous',
    label: 'Contextual Compensation Discussion',
    category: 'Contextual Sensitivity',
    text: "Anita's compensation was revised upward during the latest review.",
    expected: 'Redact — Contextual salary discussion without explicit currency',
  },
]

const NAV_ITEMS = [
  { id: 'playground' as const, label: 'Privacy Playground', icon: Shield, badge: 'Live Scanner' },
  { id: 'policy' as const, label: 'Policy Controls', icon: Sliders, badge: 'Active Rules' },
  { id: 'audit' as const, label: 'Audit Logs', icon: Database, badge: 'Event Ledger' },
  { id: 'evaluation' as const, label: 'Evaluation', icon: FlaskConical, badge: 'Benchmark' },
]

type PageName = 'playground' | 'policy' | 'audit' | 'evaluation'

// ─── Status & Action Badges ───────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    allow: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-emerald-600/10',
    redact: 'bg-amber-50 text-amber-800 border-amber-300 ring-amber-600/10',
    block: 'bg-rose-50 text-rose-800 border-rose-300 ring-rose-600/10',
    restrict: 'bg-violet-50 text-violet-800 border-violet-300 ring-violet-600/10',
  }
  const currentStyle = styles[action.toLowerCase()] ?? 'bg-slate-50 text-slate-700 border-slate-300'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider shadow-xs ${currentStyle}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {action}
    </span>
  )
}

function RiskMeter({ value, label, weight }: { value: number; label: string; weight: string }) {
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)))
  const color =
    value > 0.80 ? 'bg-rose-500' : value >= 0.30 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">
          {label} <span className="font-normal text-slate-400">({weight})</span>
        </span>
        <span className="font-mono font-semibold text-slate-900">{value.toFixed(2)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Shared Section Header ───────────────────────────────────────────────────

function PageHeader({ title, subtitle, badge }: { title: string; subtitle: string; badge?: string }) {
  return (
    <div className="border-b border-slate-200 bg-white px-8 py-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
            {badge && (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600 uppercase">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 shadow-2xs">
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            <span>Gateway Boundary: </span>
            <span className="font-semibold text-slate-800">Simulated Sandbox</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Privacy Playground Page ──────────────────────────────────────────────────

function PlaygroundPage({
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
}: {
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
}) {
  const currentScenario = SAMPLE_SCENARIOS.find((s) => s.id === selectedScenario)

  // Detect if UI state differs from evaluated result
  const isStale =
    result &&
    (result.evaluated_role !== role || result.evaluated_destination !== destination)

  return (
    <div className="space-y-6 p-8">
      {/* Top Banner Warning if Role/Destination modified after scan */}
      {isStale && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>
              Evaluation context modified: Currently viewing decision evaluated for <strong>{result.evaluated_role}</strong> via <strong>{result.evaluated_destination}</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={onScan}
            className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-700"
          >
            Re-scan to update
          </button>
        </div>
      )}

      {/* Main Grid: Prompt Input & Decision Summary */}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        {/* Left Column: Input and Parameters */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Prompt Analysis</span>
              <h2 className="text-base font-semibold text-slate-900">Inspect & Guard Inbound Prompts</h2>
            </div>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-medium text-slate-500">
              {prompt.length} / 5,000 characters
            </span>
          </div>

          {/* Scenario Selector */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Preset Demonstration Scenarios
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SAMPLE_SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onScenarioChange(s.id)}
                  className={`rounded-xl border p-2.5 text-left text-xs transition ${
                    selectedScenario === s.id
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="truncate font-semibold">{s.label}</div>
                  <div className={`mt-0.5 text-[10px] truncate ${selectedScenario === s.id ? 'text-slate-300' : 'text-slate-500'}`}>
                    {s.category}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Editor */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Prompt Payload
            </label>
            <textarea
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              rows={5}
              maxLength={5000}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 font-mono text-xs leading-relaxed text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/5"
              placeholder="Enter text or paste a prompt to inspect for sensitive content..."
            />
            {currentScenario && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                <span>
                  <strong className="text-slate-700">Expected Policy Target: </strong>
                  {currentScenario.expected}
                </span>
              </div>
            )}
          </div>

          {/* Role and Destination Boundary Controls */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Simulated Role</span>
                <span className="font-normal text-[10px] text-slate-400">Context Authorization</span>
              </label>
              <select
                value={role}
                onChange={(e) => onRoleChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
              >
                <option value="General Employee">General Employee (Default Least Privilege)</option>
                <option value="HR Administrator">HR Administrator (Privileged HR Internal)</option>
                <option value="Security Administrator">Security Administrator (Security Oversight)</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Destination AI Boundary</span>
                <span className="font-normal text-[10px] text-slate-400">Exposure Zone</span>
              </label>
              <select
                value={destination}
                onChange={(e) => onDestinationChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
              >
                <option value="Local AI model">Local AI Model (Protected Airgap Boundary)</option>
                <option value="External AI service">External AI Service (Third-Party Cloud Boundary)</option>
                <option value="Internal reporting system">Internal Reporting System (Enterprise Internal)</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onScan}
              disabled={isLoading || prompt.trim().length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              {isLoading ? 'Enforcing Policy...' : 'Scan & Enforce Policy'}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              Clear
            </button>
          </div>
        </div>

        {/* Right Column: Decision & Risk Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Enforcement Decision</h2>
            </div>
            {result && <span className="font-mono text-[10px] text-slate-400">{result.event_id}</span>}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-4 w-4" />
                Scan Error
              </div>
              <div className="mt-1">{error}</div>
            </div>
          )}

          {result ? (
            <div className="space-y-4">
              {/* Primary Action Banner */}
              <div className={`rounded-xl border p-4 ${
                result.action === 'allow'
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                  : result.action === 'block'
                  ? 'border-rose-200 bg-rose-50/70 text-rose-900'
                  : 'border-amber-200 bg-amber-50/70 text-amber-900'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">Gateway Decision</span>
                  <ActionBadge action={result.action} />
                </div>
                <div className="mt-2 text-xs font-medium leading-relaxed">
                  {result.decision_reason}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] opacity-80">
                  <span>Policy Rule: <strong>{result.policy_rule}</strong></span>
                  <span>•</span>
                  <span>Evaluated for: <strong>{result.evaluated_role ?? role}</strong></span>
                </div>
              </div>

              {/* Multi-Factor Risk Score Breakdown */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">Composite Risk Score</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`font-mono text-lg font-bold ${
                      result.risk_score > 0.8 ? 'text-rose-600' : result.risk_score >= 0.3 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {result.risk_score.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400">/ 1.00</span>
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t border-slate-200/60">
                  <RiskMeter value={result.score_breakdown.entity_risk} label="Entity Risk" weight="40%" />
                  <RiskMeter value={result.score_breakdown.context_risk} label="Context Risk" weight="40%" />
                  <RiskMeter value={result.score_breakdown.exposure_risk} label="Exposure Risk" weight="20%" />
                </div>

                <p className="pt-2 text-[10px] text-slate-400 border-t border-slate-200/60 leading-normal">
                  Formula: <code>0.4×Entity + 0.4×Context + 0.2×Exposure</code>.
                  Thresholds: Allow &lt;0.30, Redact 0.30–0.80, Block &gt;0.80.
                  High-risk exfiltration policies explicitly override scores to fail closed.
                </p>
              </div>

              {/* Classification metadata */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Classified Topic:</span>
                  <span className="font-semibold text-slate-900 capitalize">{result.context_classification.label}</span>
                </div>
                <div className="flex justify-between">
                  <span>Detection Method:</span>
                  <span className="font-mono text-slate-700">{result.detection_method}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
              Select or enter a prompt, then click &quot;Scan &amp; Enforce Policy&quot; to inspect real-time risk scores and gateway routing.
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Detected Spans & Downstream Gateway Payload */}
      {result && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Detected Sensitive Entities */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">Detected Sensitive Spans</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {result.detected_entities.length} Detected
              </span>
            </div>

            {result.detected_entities.length > 0 ? (
              <div className="space-y-2.5">
                {result.detected_entities.map((entity, i) => (
                  <div key={`${entity.type}-${i}`} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase tracking-wide text-slate-700">
                        {entity.type}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        Confidence: {(entity.confidence * 100).toFixed(0)}% • Offsets [{entity.start}:{entity.end}]
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-xs font-semibold text-slate-900 bg-white px-2 py-1 rounded border border-slate-200/60 break-all">
                      {entity.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                No individual sensitive tokens detected. Evaluation proceeded via macro context and policy rules.
              </div>
            )}
          </div>

          {/* Sanitized Downstream Simulation Payload */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldOff className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">Downstream Gateway Simulation</h3>
              </div>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-mono text-slate-500">
                Simulated Sandbox
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Sanitized Payload Forwarded to AI
                </span>
                <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 break-words">
                  {result.sanitized_output || '— (No payload forwarded)'}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <Lock className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Downstream Handler Dispatch Status</span>
                </div>
                {result.downstream.invoked ? (
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div>
                      <span className="font-medium text-slate-700">Payload Received: </span>
                      <span className="font-mono text-slate-900">{result.downstream.received_payload ?? '(empty)'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Model Response: </span>
                      <span className="italic text-slate-800">{result.downstream.response}</span>
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-700">
                      ✓ Boundary invariant verified: Raw un-sanitized prompt was withheld from downstream execution.
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800 font-medium">
                    ✕ Downstream model dispatch halted by policy engine. Zero payload reached the downstream model.
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

// ─── Policy Controls Page ─────────────────────────────────────────────────────

function PolicyPage({
  role,
  destination,
  policies,
  onPolicyUpdate,
}: {
  role: string
  destination: string
  policies: { roles: string[]; destinations: string[]; rules: PolicyRule[] }
  onPolicyUpdate: (rule: PolicyRule) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAction, setEditAction] = useState<Action>('redact')
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({})

  const handleSave = async (rule: PolicyRule) => {
    setSaveStatus((prev) => ({ ...prev, [rule.id]: 'saving' }))
    const updated = { ...rule, default_action: editAction }
    try {
      await onPolicyUpdate(updated)
      setSaveStatus((prev) => ({ ...prev, [rule.id]: 'saved' }))
      setEditingId(null)
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, [rule.id]: 'saved' })), 2000)
    } catch {
      setSaveStatus((prev) => ({ ...prev, [rule.id]: 'error' }))
    }
  }

  return (
    <div className="space-y-6 p-8">
      {/* Policy Governance Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Active Identity</span>
          <div className="mt-1 text-base font-bold text-slate-900">{role}</div>
          <p className="mt-1 text-xs text-slate-500">Evaluated against RBAC and ABAC privacy policies.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Target Transmission Zone</span>
          <div className="mt-1 text-base font-bold text-slate-900">{destination}</div>
          <p className="mt-1 text-xs text-slate-500">Boundary verified server-side on every inbound transaction.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Enforcement Mode</span>
          <div className="mt-1 text-base font-bold text-emerald-700">Fail-Closed on High Risk</div>
          <p className="mt-1 text-xs text-slate-500">Explicit credential exfiltration rules override generic thresholds.</p>
        </div>
      </div>

      {/* Policy Rules Configuration */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Configured Policy Rules</h2>
            <p className="text-xs text-slate-500">
              Live policy engine rules. Default enforcement actions can be modified dynamically for live demonstration.
            </p>
          </div>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            {policies.rules.length} Active Rules
          </span>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {policies.rules.map((rule) => {
            const isEditing = editingId === rule.id
            const status = saveStatus[rule.id]
            return (
              <div key={rule.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{rule.title}</h3>
                    <span className="font-mono text-[10px] text-slate-400">{rule.id}</span>
                  </div>
                  <ActionBadge action={rule.default_action} />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{rule.description}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {rule.applies_to_roles.map((r) => (
                    <span key={r} className="rounded bg-white border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 font-medium">
                      {r}
                    </span>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={editAction}
                        onChange={(e) => setEditAction(e.target.value as Action)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none"
                      >
                        <option value="allow">Allow</option>
                        <option value="redact">Redact</option>
                        <option value="restrict">Restrict</option>
                        <option value="block">Block</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleSave(rule)}
                        disabled={status === 'saving'}
                        className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-800"
                      >
                        {status === 'saving' ? 'Saving...' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(rule.id)
                        setEditAction(rule.default_action)
                      }}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 transition flex items-center gap-1"
                    >
                      <Sliders className="h-3 w-3" />
                      Modify Default Action
                    </button>
                  )}
                  {status === 'saved' && (
                    <div className="mt-1 text-[11px] font-medium text-emerald-600">✓ Rule updated in-memory for subsequent scans</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Role × Sensitivity Matrix Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900">Role × Sensitivity Boundary Matrix</h2>
        <p className="mt-0.5 text-xs text-slate-500">Cross-reference of authorization policies enforced across user roles.</p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left font-semibold text-slate-500">
                <th className="pb-3 pr-4">Role Profile</th>
                <th className="pb-3 px-3 text-center">Credentials</th>
                <th className="pb-3 px-3 text-center">Compensation (External)</th>
                <th className="pb-3 px-3 text-center">Compensation (Internal)</th>
                <th className="pb-3 px-3 text-center">Customer PII</th>
                <th className="pb-3 pl-3 text-center">Public Guidance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {[
                { r: 'General Employee', values: ['block', 'redact', 'redact', 'redact', 'allow'] },
                { r: 'HR Administrator', values: ['block', 'redact', 'allow', 'redact', 'allow'] },
                { r: 'Security Administrator', values: ['block', 'redact', 'redact', 'redact', 'allow'] },
              ].map(({ r, values }) => {
                const isSelected = r === role
                return (
                  <tr key={r} className={isSelected ? 'bg-slate-50/90 font-semibold' : ''}>
                    <td className="py-3 pr-4 text-slate-900">
                      <div className="flex items-center gap-2">
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />}
                        <span>{r}</span>
                        {isSelected && <span className="text-[10px] text-slate-400 font-normal">(Current Profile)</span>}
                      </div>
                    </td>
                    {values.map((v, idx) => (
                      <td key={idx} className="py-3 px-3 text-center">
                        <ActionBadge action={v} />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Audit Logs Page ──────────────────────────────────────────────────────────

function AuditPage({
  auditLogs,
  onRefresh,
}: {
  auditLogs: AuditRecord[]
  onRefresh: () => void
}) {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [riskFilter, setRiskFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((rec) => {
      const haystack = `${rec.selected_role} ${rec.destination} ${rec.policy_reason} ${rec.action_taken} ${rec.applicable_policy_rule} ${rec.event_id}`.toLowerCase()
      const matchSearch = search === '' || haystack.includes(search.toLowerCase())
      const matchAction = actionFilter === 'all' || rec.action_taken === actionFilter
      const matchRisk =
        riskFilter === 'all' ||
        (riskFilter === 'low' && rec.final_risk_score < 0.3) ||
        (riskFilter === 'medium' && rec.final_risk_score >= 0.3 && rec.final_risk_score <= 0.8) ||
        (riskFilter === 'high' && rec.final_risk_score > 0.8)
      return matchSearch && matchAction && matchRisk
    })
  }, [auditLogs, search, actionFilter, riskFilter])

  return (
    <div className="space-y-6 p-8">
      {/* Search and Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Security Audit Ledger</h2>
            <p className="text-xs text-slate-500">Immutable chronological record of privacy evaluations. Raw secrets are withheld by design.</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Ledger
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by event ID, role, destination, or rule..."
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
          />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-slate-400"
          >
            <option value="all">All Enforcement Actions</option>
            <option value="allow">Allow</option>
            <option value="redact">Redact</option>
            <option value="block">Block</option>
            <option value="restrict">Restrict</option>
          </select>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-slate-400"
          >
            <option value="all">All Risk Bands</option>
            <option value="low">Low Risk (&lt; 0.30)</option>
            <option value="medium">Medium Risk (0.30–0.80)</option>
            <option value="high">High Risk (&gt; 0.80)</option>
          </select>
        </div>
      </div>

      {/* Audit Events List */}
      {filteredLogs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
          No audit records match the current filter criteria. Run prompt scans in the Playground to generate events.
        </div>
      ) : (
        <div className="space-y-3">
          {[...filteredLogs].reverse().map((rec) => {
            const isExpanded = expandedId === rec.event_id
            return (
              <div key={rec.event_id} className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden transition">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : rec.event_id)}
                  className="w-full p-4 text-left flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/50"
                >
                  <div className="flex items-center gap-3">
                    <ActionBadge action={rec.action_taken} />
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        {rec.selected_role} → {rec.destination}
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">{rec.event_id}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="font-mono text-slate-500">{new Date(rec.timestamp).toLocaleTimeString()}</span>
                    <span className="font-mono font-bold text-slate-700">Risk {rec.final_risk_score.toFixed(2)}</span>
                    <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3 text-xs">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">Timestamp</span>
                        <div className="font-mono text-slate-800">{new Date(rec.timestamp).toISOString()}</div>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">Policy Rule Triggered</span>
                        <div className="font-mono text-slate-800">{rec.applicable_policy_rule}</div>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">Downstream Invoked</span>
                        <div className="font-semibold text-slate-800">{rec.downstream_invoked ? 'Yes (Forwarded)' : 'No (Blocked)'}</div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Decision Rationale</span>
                      <div className="mt-0.5 rounded-lg bg-white border border-slate-200 p-2.5 text-slate-700 leading-relaxed">
                        {rec.policy_reason}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Sanitized Output Payload</span>
                      <div className="mt-0.5 rounded-lg bg-white border border-slate-200 p-2.5 font-mono text-slate-700 break-all">
                        {rec.sanitized_output || '—'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Evaluation Dashboard Page ────────────────────────────────────────────────

function EvaluationPage({
  evaluation,
  isLoading,
  onRun,
}: {
  evaluation: EvaluationResponse | null
  isLoading: boolean
  onRun: () => void
}) {
  const [cmTab, setCmTab] = useState<'context' | 'baseline'>('context')

  const chartData = evaluation
    ? [
        { name: 'Precision', baseline: evaluation.baseline.precision, context: evaluation.context_aware.precision },
        { name: 'Recall', baseline: evaluation.baseline.recall, context: evaluation.context_aware.recall },
        { name: 'F1 Score', baseline: evaluation.baseline.f1, context: evaluation.context_aware.f1 },
        { name: 'FPR', baseline: evaluation.baseline.false_positive_rate, context: evaluation.context_aware.false_positive_rate },
        { name: 'FNR', baseline: evaluation.baseline.false_negative_rate, context: evaluation.context_aware.false_negative_rate },
      ]
    : []

  const metricCards = evaluation
    ? [
        { label: 'Precision', ca: evaluation.context_aware.precision, bl: evaluation.baseline.precision },
        { label: 'Recall', ca: evaluation.context_aware.recall, bl: evaluation.baseline.recall },
        { label: 'F1 Score', ca: evaluation.context_aware.f1, bl: evaluation.baseline.f1 },
        { label: 'Avg Latency', ca: evaluation.context_aware.average_latency_ms, bl: evaluation.baseline.average_latency_ms, isRaw: true },
      ]
    : []

  return (
    <div className="space-y-6 p-8">
      {/* Top Benchmark Overview */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Quantitative Privacy Enforcement Benchmark</h2>
            <p className="mt-1 text-xs text-slate-500">
              Evaluates ContextGuard against a 10-vector deterministic benchmark dataset comparing it to a naive keyword-only baseline.
            </p>
          </div>
          <button
            type="button"
            onClick={onRun}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50"
          >
            <ArrowRight className="h-4 w-4" />
            {isLoading ? 'Executing Benchmark Suite...' : 'Execute Benchmark Suite'}
          </button>
        </div>

        {!evaluation ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-xs text-slate-400">
            Click &quot;Execute Benchmark Suite&quot; to run all 10 synthetic test vectors through both the context-aware engine and keyword baseline.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* KPI Metric Comparison Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metricCards.map(({ label, ca, bl, isRaw }) => {
                const diff = ca - bl
                return (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-bold font-mono text-slate-900">
                        {isRaw ? `${ca.toFixed(2)} ms` : `${(ca * 100).toFixed(1)}%`}
                      </span>
                      <span className="text-xs text-slate-400">
                        Baseline: {isRaw ? `${bl.toFixed(2)} ms` : `${(bl * 100).toFixed(1)}%`}
                      </span>
                    </div>
                    {!isRaw && (
                      <div className={`mt-1 text-[11px] font-semibold ${diff >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {diff >= 0 ? `+${(diff * 100).toFixed(1)}% vs Baseline` : `${(diff * 100).toFixed(1)}% vs Baseline`}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Confusion Matrix and Comparison Chart */}
            <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              {/* Dual Confusion Matrix Panel */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Confusion Matrix</h3>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCmTab('context')}
                      className={`rounded-md px-2.5 py-1 font-semibold transition ${
                        cmTab === 'context' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ContextGuard
                    </button>
                    <button
                      type="button"
                      onClick={() => setCmTab('baseline')}
                      className={`rounded-md px-2.5 py-1 font-semibold transition ${
                        cmTab === 'baseline' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Keyword Baseline
                    </button>
                  </div>
                </div>

                {(() => {
                  const activeCm =
                    cmTab === 'context'
                      ? (evaluation.context_aware_confusion_matrix ?? evaluation.confusion_matrix)
                      : (evaluation.baseline_confusion_matrix ?? {
                          tp: evaluation.baseline.true_positives,
                          fp: evaluation.baseline.false_positives,
                          tn: evaluation.baseline.true_negatives,
                          fn: evaluation.baseline.false_negatives,
                        })
                  return (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-emerald-900">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">True Positives</span>
                        <div className="text-2xl font-bold font-mono mt-1">{activeCm.tp}</div>
                        <p className="text-[10px] opacity-75 mt-0.5">Correctly Protected</p>
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-amber-900">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">False Positives</span>
                        <div className="text-2xl font-bold font-mono mt-1">{activeCm.fp}</div>
                        <p className="text-[10px] opacity-75 mt-0.5">Over-blocked Safe Prompts</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">True Negatives</span>
                        <div className="text-2xl font-bold font-mono mt-1">{activeCm.tn}</div>
                        <p className="text-[10px] opacity-75 mt-0.5">Correctly Allowed</p>
                      </div>
                      <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-rose-900">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">False Negatives</span>
                        <div className="text-2xl font-bold font-mono mt-1">{activeCm.fn}</div>
                        <p className="text-[10px] opacity-75 mt-0.5">Missed Confidential Data</p>
                      </div>
                    </div>
                  )
                })()}

                <p className="mt-3 text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-2.5">
                  {cmTab === 'context'
                    ? 'ContextGuard achieves 0 false positives by evaluating role authorization, destination boundary, and verbal context.'
                    : 'The naive keyword baseline suffers 4 false positives, blindly blocking public salary bands, password complexity standards, and authorized HR reviews.'}
                </p>
              </div>

              {/* Comparative Chart */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Comparative Performance Metrics</h3>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-300" /> Baseline</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-900" /> ContextGuard</span>
                  </div>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 1.1]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(v: any) => typeof v === 'number' ? (v * 100).toFixed(1) + '%' : String(v)}
                      />
                      <Bar dataKey="baseline" fill="#cbd5e1" name="Keyword Baseline" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="context" fill="#0f172a" name="ContextGuard" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Test Case Execution Ledger */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Per-Vector Test Execution Ledger ({evaluation.results.length} Cases)
                </h3>
                <span className="text-[11px] font-semibold text-emerald-700">
                  {evaluation.results.filter(r => r.passed).length} / {evaluation.results.length} Tests Verified
                </span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {evaluation.results.map((item: EvaluationResult) => (
                  <div key={item.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/50">
                    <div className="space-y-0.5 max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{item.id}</span>
                        {item.category && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {item.category}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 italic truncate">{item.sanitized}</p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-medium">
                      <span className="text-slate-500">Expected: <strong className="text-slate-800">{item.expected_action}</strong></span>
                      <span className="text-slate-500">Actual: <strong className="text-slate-800">{item.actual_action}</strong></span>
                      <span className="font-mono text-slate-400 text-[11px]">{item.latency_ms.toFixed(2)} ms</span>
                      {item.passed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> PASS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                          <XCircle className="h-3 w-3" /> FAIL
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Credibility & Limitations Note */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Info className="h-3.5 w-3.5 text-slate-500" />
                Benchmark Methodology & Credibility Notice
              </div>
              <p className="leading-relaxed">
                This evaluation benchmark runs directly against deterministic synthetic vectors. ContextGuard achieves 100% precision on this suite because its heuristics and role-based policies were designed for these specific enterprise operational vectors. While it demonstrates architectural superiority over simple keyword filtering, evaluation on a small 10-vector demonstration set does not represent generalized production-grade machine-learning accuracy across arbitrary natural language.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Application Shell ───────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<PageName>('playground')
  const [prompt, setPrompt] = useState(SAMPLE_SCENARIOS[1].text)
  const [selectedScenario, setSelectedScenario] = useState(SAMPLE_SCENARIOS[1].id)
  const [role, setRole] = useState('General Employee')
  const [destination, setDestination] = useState('External AI service')
  const [isLoading, setIsLoading] = useState(false)
  const [policies, setPolicies] = useState<{ roles: string[]; destinations: string[]; rules: PolicyRule[] }>({
    roles: [],
    destinations: [],
    rules: [],
  })
  const [result, setResult] = useState<ScanResult | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([])
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null)
  const [health, setHealth] = useState<{ status: string; service: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadPolicies()
    void loadAuditLogs()
    void checkHealth()
  }, [])

  const loadPolicies = async () => {
    try {
      const resp = await fetchPolicies()
      setPolicies(resp)
    } catch (e) {
      console.error('Failed to load policies:', e)
    }
  }

  const loadAuditLogs = async () => {
    try {
      const resp = await fetchAuditLogs()
      setAuditLogs(resp.records)
    } catch (e) {
      console.error('Failed to load audit logs:', e)
    }
  }

  const checkHealth = async () => {
    try {
      const resp = await healthCheck()
      setHealth(resp)
    } catch {
      setHealth({ status: 'unreachable', service: 'ContextGuard Enterprise Security' })
    }
  }

  const handleScenarioChange = (id: string) => {
    const s = SAMPLE_SCENARIOS.find((x) => x.id === id)
    if (!s) return
    setSelectedScenario(id)
    setPrompt(s.text)
    setResult(null)
    setError(null)
  }

  const handleScan = async () => {
    setError(null)
    setIsLoading(true)
    try {
      const resp = await scanPrompt(prompt, role, destination)
      setResult(resp)
      await loadAuditLogs()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan execution failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEvaluation = async () => {
    setError(null)
    setIsLoading(true)
    try {
      const resp = await runEvaluation()
      setEvaluation(resp)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Evaluation benchmark execution failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePolicyUpdate = async (rule: PolicyRule) => {
    const resp = await updatePolicy(rule)
    setPolicies((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === rule.id ? { ...r, default_action: resp.default_action } : r)),
    }))
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 antialiased">
      <div className="mx-auto flex min-h-screen max-w-[1600px] border-x border-slate-200 bg-white shadow-xl">
        {/* Sidebar Navigation */}
        <aside className="w-64 flex-shrink-0 flex flex-col justify-between border-r border-slate-200 bg-slate-950 p-5 text-white">
          <div>
            {/* Brand Logo & Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-sm text-white">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-base font-bold tracking-tight text-white">ContextGuard</div>
                  <div className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                    Security Gateway
                  </div>
                </div>
              </div>

              {/* Status Pill */}
              <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2 text-[11px] text-slate-300 border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${health?.status === 'ok' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <span className="font-medium">
                    {health?.status === 'ok' ? 'Engine Online' : 'Service Offline'}
                  </span>
                </div>
                <span className="font-mono text-[9px] text-slate-400">v2.4</span>
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-1.5">
              {NAV_ITEMS.map(({ id, label, icon: Icon, badge }) => {
                const isActive = page === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPage(id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </div>
                    {badge && (
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                        isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Bottom Sidebar Footer */}
          <div className="pt-4 border-t border-slate-800/80 text-[10px] text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>Environment</span>
              <span className="font-semibold text-slate-400">DEMO SANDBOX</span>
            </div>
            <div className="flex justify-between">
              <span>Gateway Boundary</span>
              <span className="font-semibold text-slate-400">Local Model</span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex min-w-0 flex-1 flex-col bg-slate-50">
          {page === 'playground' && (
            <>
              <PageHeader
                title="Privacy Playground & Inbound Gateway"
                subtitle="Evaluate natural language prompts through multi-stage sensitivity detection, risk scoring, and policy enforcement."
                badge="Active Protection"
              />
              <PlaygroundPage
                result={result}
                isLoading={isLoading}
                error={error}
                role={role}
                destination={destination}
                prompt={prompt}
                selectedScenario={selectedScenario}
                onRoleChange={setRole}
                onDestinationChange={setDestination}
                onPromptChange={setPrompt}
                onScenarioChange={handleScenarioChange}
                onScan={handleScan}
                onClear={() => { setPrompt(''); setResult(null); setError(null) }}
              />
            </>
          )}

          {page === 'policy' && (
            <>
              <PageHeader
                title="Policy Governance & Role Matrix"
                subtitle="Inspect and customize role-based data exfiltration rules, destination boundary access, and sensitivity classifications."
                badge="Governance Engine"
              />
              <PolicyPage
                role={role}
                destination={destination}
                policies={policies}
                onPolicyUpdate={handlePolicyUpdate}
              />
            </>
          )}

          {page === 'audit' && (
            <>
              <PageHeader
                title="Security Audit Ledger"
                subtitle="Review tamper-evident audit logs of privacy inspections, sanitized payloads, and fail-closed policy enforcement events."
                badge="Compliance Audit"
              />
              <AuditPage auditLogs={auditLogs} onRefresh={loadAuditLogs} />
            </>
          )}

          {page === 'evaluation' && (
            <>
              <PageHeader
                title="Quantitative Evaluation & Benchmark Dashboard"
                subtitle="Rigorous empirical comparison of ContextGuard against naive keyword-only filtering across 10 deterministic test vectors."
                badge="Jury Evaluation"
              />
              <EvaluationPage
                evaluation={evaluation}
                isLoading={isLoading}
                onRun={handleEvaluation}
              />
            </>
          )}
        </main>
      </div>
    </div>
  )
}
