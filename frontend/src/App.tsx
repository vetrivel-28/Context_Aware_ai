import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Eye,
  FileText,
  FlaskConical,
  Lock,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Sparkles,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const SAMPLE_SCENARIOS: Scenario[] = [
  {
    id: 'public-info',
    label: 'Public information',
    text: "Engineer salary bands are available on the company's public careers page.",
    expected: 'Allow — no sensitive PII, public context',
  },
  {
    id: 'compensation',
    label: 'Confidential compensation',
    text: "Anita's salary is being raised to ₹18 lakh.",
    expected: 'Redact — named individual + compensation amount',
  },
  {
    id: 'credential',
    label: 'Credential exposure',
    text: 'The admin password is Mx7!qR2z.',
    expected: 'Block — real credential detected',
  },
  {
    id: 'public-guidance',
    label: 'Public password guidance',
    text: 'Passwords must contain at least 12 characters.',
    expected: 'Allow — policy guidance, not a real credential',
  },
  {
    id: 'email',
    label: 'Personal contact information',
    text: 'Send the customer report to priya@example.com.',
    expected: 'Redact — personal email address detected',
  },
  {
    id: 'ambiguous',
    label: 'Ambiguous contextual disclosure',
    text: "Anita's compensation was revised upward during the latest review.",
    expected: 'Contextual detection — sensitive if engine catches it',
  },
]

const NAV_ITEMS = [
  { id: 'playground' as const, label: 'Privacy Playground', icon: Shield },
  { id: 'policy' as const, label: 'Policy Controls', icon: ClipboardList },
  { id: 'audit' as const, label: 'Audit Logs', icon: Activity },
  { id: 'evaluation' as const, label: 'Evaluation', icon: FlaskConical },
]

const ACTION_BADGE: Record<Action, string> = {
  allow: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  redact: 'bg-amber-50 border-amber-200 text-amber-700',
  block: 'bg-rose-50 border-rose-200 text-rose-700',
  restrict: 'bg-violet-50 border-violet-200 text-violet-700',
}

type PageName = 'playground' | 'policy' | 'audit' | 'evaluation'

// ─── Utility components ────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_BADGE[(action as Action)] ?? 'bg-slate-50 border-slate-200 text-slate-700'
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style}`}>
      {action}
    </span>
  )
}

function RiskBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100)
  const color = value > 0.8 ? 'bg-rose-500' : value >= 0.3 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className="font-mono font-semibold">{value.toFixed(2)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
      {message}
    </div>
  )
}

function SectionHeader({ icon: Icon, title, sub }: { icon: React.ComponentType<{ className?: string }>; title: string; sub?: string }) {
  return (
    <div className="mb-4">
      {sub && <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{sub}</div>}
      <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <Icon className="h-5 w-5 text-slate-600" />
        {title}
      </div>
    </div>
  )
}

// ─── Pages ────────────────────────────────────────────────────────────────────

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

  return (
    <div className="space-y-6 p-6">
      {/* Input and Decision area */}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        {/* Input panel */}
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Prompt input</div>
              <h2 className="text-xl font-semibold text-slate-900">Privacy Playground</h2>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
              {prompt.length} / 5000 chars
            </div>
          </div>

          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Sample scenario
          </label>
          <select
            value={selectedScenario}
            onChange={(e) => onScenarioChange(e.target.value)}
            className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
          >
            {SAMPLE_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            rows={6}
            maxLength={5000}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-slate-400"
            placeholder="Enter your prompt here…"
          />

          {currentScenario && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Expected: </span>
              {currentScenario.expected}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Role <span className="normal-case text-slate-400">(simulated auth)</span>
              </label>
              <select
                value={role}
                onChange={(e) => onRoleChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
              >
                <option>General Employee</option>
                <option>HR Administrator</option>
                <option>Security Administrator</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Destination
              </label>
              <select
                value={destination}
                onChange={(e) => onDestinationChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
              >
                <option>Local AI model</option>
                <option>External AI service</option>
                <option>Internal reporting system</option>
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onScan}
              disabled={isLoading || prompt.trim().length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              {isLoading ? 'Scanning…' : 'Scan and Protect'}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" />
              Clear
            </button>
          </div>
        </section>

        {/* Decision panel */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            <Target className="h-3.5 w-3.5" />
            Decision summary
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-4 w-4" />
                Error
              </div>
              <div className="mt-1 text-xs">{error}</div>
            </div>
          )}

          {result ? (
            <>
              <div className="flex items-center gap-3">
                <ActionBadge action={result.action} />
                <span className="text-xs text-slate-500">
                  {result.detection_method === 'heuristic' ? 'Rule-based detection' : result.detection_method}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">Final risk score</span>
                  <span className={`font-bold tabular-nums ${result.risk_score > 0.8 ? 'text-rose-600' : result.risk_score >= 0.3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {result.risk_score.toFixed(2)}
                  </span>
                </div>
                <div className="space-y-2.5">
                  <RiskBar value={result.score_breakdown.entity_risk} label="Entity risk (×0.4)" />
                  <RiskBar value={result.score_breakdown.context_risk} label="Context risk (×0.4)" />
                  <RiskBar value={result.score_breakdown.exposure_risk} label="Exposure risk (×0.2)" />
                </div>
                <div className="border-t border-slate-100 pt-2 text-[10px] text-slate-400">
                  Score = 0.4×E + 0.4×C + 0.2×X · thresholds: &lt;0.30 allow, 0.30–0.80 redact, &gt;0.80 block
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700">
                <span className="font-semibold text-slate-800">Policy rule: </span>
                {result.policy_rule}
                <br />
                <span className="mt-1 block text-slate-600">{result.decision_reason}</span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Context: </span>
                {result.context_classification.label}{' '}
                <span className="text-slate-400">({(result.context_classification.confidence * 100).toFixed(0)}% conf · {result.context_classification.source})</span>
              </div>
            </>
          ) : (
            <EmptyState message="Scan a prompt to view the privacy decision and risk breakdown." />
          )}
        </section>
      </div>

      {/* Entities + Sanitized output */}
      {result && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <SectionHeader icon={Eye} title="Detected entities" />
            {result.detected_entities.length > 0 ? (
              <ul className="space-y-2">
                {result.detected_entities.map((entity, i) => (
                  <li
                    key={`${entity.type}-${i}`}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                        {entity.type}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-500">
                        {(entity.confidence * 100).toFixed(0)}% conf
                      </span>
                    </div>
                    <div className="mt-1 break-all font-mono text-xs text-slate-600">{entity.value}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="No sensitive entities detected in the current input." />
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <SectionHeader icon={ShieldOff} title="Sanitized output" />
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 font-mono">
              {result.sanitized_output || '—'}
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Lock className="h-4 w-4 text-emerald-600" />
                Downstream simulation
              </div>
              {result.downstream.invoked ? (
                <div className="space-y-2 text-xs text-slate-600">
                  <div>
                    <span className="font-medium text-slate-800">Payload received: </span>
                    <span className="font-mono">{result.downstream.received_payload ?? '(empty)'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-800">Model response: </span>
                    {result.downstream.response}
                  </div>
                  <div className="mt-1 rounded bg-emerald-50 px-2 py-1 text-emerald-700">
                    ✓ Only sanitized payload was forwarded
                  </div>
                </div>
              ) : (
                <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  ✗ Downstream model was not invoked — request blocked by policy
                </div>
              )}
            </div>
          </section>
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
    <div className="space-y-6 p-6">
      {/* Current context */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <SectionHeader icon={ShieldCheck} title="Policy controls" sub="Role-aware privacy firewall" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Current role</div>
            <div className="mt-2 text-base font-semibold text-slate-900">{role}</div>
            <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-700">Simulated authentication — demo only</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Destination</div>
            <div className="mt-2 text-base font-semibold text-slate-900">{destination}</div>
            <div className="mt-1 text-[10px] text-slate-400">Validated server-side on every scan</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Default action</div>
            <div className="mt-2 text-base font-semibold text-slate-900">Allow</div>
            <div className="mt-1 text-[10px] text-slate-400">Fails closed on explicit high-risk rules</div>
          </div>
        </div>
      </section>

      {/* Policy matrix */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Policy rule matrix</h3>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-medium text-blue-700">
            Default actions are editable for demo purposes
          </span>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {policies.rules.map((rule) => {
            const isEditing = editingId === rule.id
            const status = saveStatus[rule.id]
            return (
              <div key={rule.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900">{rule.title}</div>
                  <ActionBadge action={rule.default_action} />
                </div>
                <p className="text-xs leading-5 text-slate-600">{rule.description}</p>

                <div className="mt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Applies to roles</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {rule.applies_to_roles.map((r) => (
                      <span key={r} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Sensitivity levels</div>
                  <div className="mt-1 text-xs text-slate-600">{rule.sensitivity_levels.join(', ')}</div>
                </div>

                {isEditing ? (
                  <div className="mt-3 space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Change default action
                    </label>
                    <select
                      value={editAction}
                      onChange={(e) => setEditAction(e.target.value as Action)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 outline-none"
                    >
                      <option value="allow">allow</option>
                      <option value="redact">redact</option>
                      <option value="restrict">restrict</option>
                      <option value="block">block</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSave(rule)}
                        disabled={status === 'saving'}
                        className="flex-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                      >
                        {status === 'saving' ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                    {status === 'error' && <div className="text-[10px] text-rose-600">Save failed — backend may be unavailable.</div>}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(rule.id)
                      setEditAction(rule.default_action)
                    }}
                    className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Edit default action
                  </button>
                )}
                {status === 'saved' && !isEditing && (
                  <div className="mt-1 text-[10px] text-emerald-600">✓ Saved — next scan will use updated rule</div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Role comparison table */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Role × sensitivity decision matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-2 text-left font-semibold text-slate-500">Role</th>
                <th className="pb-2 text-center font-semibold text-slate-500">Credential</th>
                <th className="pb-2 text-center font-semibold text-slate-500">Compensation (ext.)</th>
                <th className="pb-2 text-center font-semibold text-slate-500">Compensation (int.)</th>
                <th className="pb-2 text-center font-semibold text-slate-500">Personal contact</th>
                <th className="pb-2 text-center font-semibold text-slate-500">Public info</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { role: 'General Employee', values: ['block', 'redact', 'redact', 'redact', 'allow'] },
                { role: 'HR Administrator', values: ['block', 'redact', 'allow', 'redact', 'allow'] },
                { role: 'Security Administrator', values: ['block', 'redact', 'redact', 'redact', 'allow'] },
              ].map(({ role: r, values }) => (
                <tr key={r} className={r === role ? 'bg-slate-100' : ''}>
                  <td className="py-2 pr-4 font-medium text-slate-700">
                    {r === role && <span className="mr-1.5 text-slate-400">▶</span>}
                    {r}
                  </td>
                  {values.map((v, i) => (
                    <td key={i} className="py-2 text-center">
                      <ActionBadge action={v as Action} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[10px] text-slate-400">
          These are demonstration policies. The highlighted row is your current role.
        </p>
      </section>
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
  const [expanded, setExpanded] = useState<string | null>(null)

  const visible = useMemo(() => {
    return auditLogs.filter((rec) => {
      const haystack = `${rec.selected_role} ${rec.destination} ${rec.policy_reason} ${rec.action_taken} ${rec.applicable_policy_rule}`.toLowerCase()
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
    <div className="space-y-6 p-6">
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <SectionHeader icon={Activity} title="Audit logs" sub="Privacy event history" />
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search role, destination, policy…"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
          />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value="all">All actions</option>
            <option value="allow">Allow</option>
            <option value="redact">Redact</option>
            <option value="block">Block</option>
            <option value="restrict">Restrict</option>
          </select>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value="all">All risk levels</option>
            <option value="low">Low (&lt; 0.30)</option>
            <option value="medium">Medium (0.30–0.80)</option>
            <option value="high">High (&gt; 0.80)</option>
          </select>
        </div>
      </section>

      {visible.length === 0 ? (
        <EmptyState message="No audit records match the current filters. Run a scan to generate the first event." />
      ) : (
        <div className="space-y-3">
          {[...visible].reverse().map((rec) => {
            const isExpanded = expanded === rec.event_id
            return (
              <div key={rec.event_id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 p-4 text-left"
                  onClick={() => setExpanded(isExpanded ? null : rec.event_id)}
                >
                  <div className="flex items-center gap-3">
                    <ActionBadge action={rec.action_taken} />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {rec.selected_role} → {rec.destination}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-slate-400">{rec.event_id}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="hidden md:block">{new Date(rec.timestamp).toLocaleString()}</span>
                    <span className="font-mono font-semibold text-slate-700">
                      risk {rec.final_risk_score.toFixed(2)}
                    </span>
                    <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-3 text-sm">
                    <div className="grid gap-3 md:grid-cols-3 text-xs">
                      <div><span className="font-medium text-slate-700">Entity types:</span> {rec.entity_types.join(', ') || 'none'}</div>
                      <div><span className="font-medium text-slate-700">Context:</span> {rec.context_classification?.label ?? '—'} ({rec.detection_method})</div>
                      <div><span className="font-medium text-slate-700">Policy rule:</span> {rec.applicable_policy_rule}</div>
                      <div><span className="font-medium text-slate-700">Entity risk:</span> {rec.entity_risk.toFixed(2)}</div>
                      <div><span className="font-medium text-slate-700">Context risk:</span> {rec.context_risk.toFixed(2)}</div>
                      <div><span className="font-medium text-slate-700">Exposure risk:</span> {rec.exposure_risk.toFixed(2)}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-700">
                      <span className="font-semibold">Decision rationale: </span>{rec.policy_reason}
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs font-mono text-slate-700">
                      <span className="not-italic font-semibold text-slate-600">Sanitized output: </span>
                      {rec.sanitized_output}
                    </div>
                    <div className="text-xs text-slate-500">
                      Downstream invoked: {rec.downstream_invoked ? '✓ Yes' : '✗ No (blocked)'}
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

// ─── Evaluation Page ──────────────────────────────────────────────────────────

function EvaluationPage({
  evaluation,
  isLoading,
  onRun,
}: {
  evaluation: EvaluationResponse | null
  isLoading: boolean
  onRun: () => void
}) {
  const chartData = evaluation
    ? [
        { name: 'Precision', baseline: evaluation.baseline.precision, context: evaluation.context_aware.precision },
        { name: 'Recall', baseline: evaluation.baseline.recall, context: evaluation.context_aware.recall },
        { name: 'F1', baseline: evaluation.baseline.f1, context: evaluation.context_aware.f1 },
        { name: 'FPR', baseline: evaluation.baseline.false_positive_rate, context: evaluation.context_aware.false_positive_rate },
        { name: 'FNR', baseline: evaluation.baseline.false_negative_rate, context: evaluation.context_aware.false_negative_rate },
      ]
    : []

  const metricCards = evaluation
    ? [
        { label: 'Precision', ca: evaluation.context_aware.precision, bl: evaluation.baseline.precision },
        { label: 'Recall', ca: evaluation.context_aware.recall, bl: evaluation.baseline.recall },
        { label: 'F1 score', ca: evaluation.context_aware.f1, bl: evaluation.baseline.f1 },
        { label: 'Avg latency (ms)', ca: evaluation.context_aware.average_latency_ms, bl: evaluation.baseline.average_latency_ms, raw: true },
      ]
    : []

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <SectionHeader icon={FlaskConical} title="Evaluation dashboard" sub="Quantitative comparison" />
            <p className="text-xs text-slate-500 -mt-2">
              Runs the context-aware engine against a deterministic test dataset and compares it to a keyword-only baseline.
              Metrics are calculated from actual results — not hardcoded.
            </p>
          </div>
          <button
            type="button"
            onClick={onRun}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowRight className="h-4 w-4" />
            {isLoading ? 'Running…' : 'Run Evaluation'}
          </button>
        </div>

        {!evaluation && (
          <EmptyState message="Click 'Run Evaluation' to execute the test suite and compare engines." />
        )}

        {evaluation && (
          <>
            {/* Metric cards */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metricCards.map(({ label, ca, bl, raw }) => {
                const better = ca >= bl
                return (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
                    <div className="mt-2 flex items-end gap-2">
                      <div className="text-2xl font-bold text-slate-900">
                        {raw ? ca.toFixed(2) : (ca * 100).toFixed(1) + '%'}
                      </div>
                      <div className={`mb-0.5 text-xs font-medium ${better ? 'text-emerald-600' : 'text-rose-600'}`}>
                        vs {raw ? bl.toFixed(2) : (bl * 100).toFixed(1) + '%'} baseline
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Confusion matrix + chart */}
            <div className="mt-6 grid gap-6 xl:grid-cols-[0.65fr_1.35fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 text-sm font-semibold text-slate-800">Confusion matrix (context-aware)</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'tp', label: 'True Positives', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                    { key: 'fp', label: 'False Positives', color: 'bg-amber-50 text-amber-800 border-amber-200' },
                    { key: 'tn', label: 'True Negatives', color: 'bg-slate-50 text-slate-800 border-slate-200' },
                    { key: 'fn', label: 'False Negatives', color: 'bg-rose-50 text-rose-800 border-rose-200' },
                  ].map(({ key, label, color }) => (
                    <div key={key} className={`rounded-xl border p-3 ${color}`}>
                      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
                      <div className="mt-1 text-3xl font-bold">
                        {evaluation.confusion_matrix[key as keyof typeof evaluation.confusion_matrix]}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[10px] text-slate-400">
                  Small demo dataset (6 cases). Not representative of production accuracy.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-800">Baseline vs context-aware comparison</div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300 inline-block" /> Keyword baseline</span>
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-slate-800 inline-block" /> Context-aware</span>
                  </div>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 1.1]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any) => typeof v === 'number' ? v.toFixed(3) : String(v ?? '')}
                      />
                      <Bar dataKey="baseline" fill="#cbd5e1" name="Keyword baseline" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="context" fill="#0f172a" name="Context-aware" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Per-test results */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 p-4 text-sm font-semibold text-slate-800">
                Per-test case results
              </div>
              <div className="divide-y divide-slate-100">
                {evaluation.results.map((item: EvaluationResult) => (
                  <div key={item.id} className="flex flex-wrap items-center gap-4 px-4 py-3 text-xs">
                    <div className="flex-1 min-w-[180px]">
                      <div className="font-mono font-medium text-slate-700">{item.id}</div>
                      <div className="mt-0.5 text-slate-400 font-mono text-[10px] truncate max-w-[300px]">
                        {item.sanitized}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-slate-500">
                        Expected: <span className="font-medium text-slate-700">{item.expected_action}</span>
                      </div>
                      <div className="text-slate-500">
                        Actual: <span className="font-medium text-slate-700">{item.actual_action}</span>
                      </div>
                      <div className="text-slate-500">
                        {item.latency_ms.toFixed(1)}ms
                      </div>
                      {item.passed ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Pass
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-semibold text-rose-700">
                          <XCircle className="h-3 w-3" /> Fail
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

// ─── Root App ─────────────────────────────────────────────────────────────────

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
      setHealth({ status: 'unreachable', service: 'ContextGuard' })
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
      setError(e instanceof Error ? e.message : 'Scan failed')
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
      setError(e instanceof Error ? e.message : 'Evaluation failed')
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

  const healthColor =
    health?.status === 'ok' ? 'text-emerald-600' : health?.status === 'unreachable' ? 'text-rose-600' : 'text-amber-600'

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px] border-x border-slate-200 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.06)]">
        {/* Sidebar */}
        <aside className="w-[260px] flex-shrink-0 border-r border-slate-200 bg-slate-50 p-6">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">Prototype</div>
              <div className="text-xl font-bold leading-tight text-slate-900">ContextGuard</div>
            </div>
          </div>

          <nav className="space-y-1">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPage(id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  page === id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              </button>
            ))}
          </nav>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-amber-800">
              <Sparkles className="h-3.5 w-3.5" />
              Hackathon MVP
            </div>
            <p className="text-[11px] leading-5 text-amber-700">
              Built for demo evaluation. Detection uses deterministic heuristics, not a trained ML model. All outcomes
              are reproducible and clearly labelled.
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs">
            <div className="font-semibold text-slate-600">Detection method</div>
            <div className="mt-1 text-slate-500">Rule-based heuristics + contextual patterns. No external ML API.</div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">Security operations</div>
              <h1 className="text-xl font-bold text-slate-900">Context-Aware Data Privacy</h1>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              <Activity className={`h-3.5 w-3.5 ${healthColor}`} />
              {health ? `${health.status.toUpperCase()} · ${health.service}` : 'Connecting…'}
            </div>
          </header>

          {/* Page content */}
          <div className="flex-1 overflow-auto">
            {page === 'playground' && (
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
            )}
            {page === 'policy' && (
              <PolicyPage
                role={role}
                destination={destination}
                policies={policies}
                onPolicyUpdate={handlePolicyUpdate}
              />
            )}
            {page === 'audit' && (
              <AuditPage auditLogs={auditLogs} onRefresh={loadAuditLogs} />
            )}
            {page === 'evaluation' && (
              <EvaluationPage
                evaluation={evaluation}
                isLoading={isLoading}
                onRun={handleEvaluation}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
