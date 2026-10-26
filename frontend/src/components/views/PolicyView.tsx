import { useState } from 'react'
import { Check, Info, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { ActionBadge } from '../ActionBadge'
import type { Action, PolicyRule } from '../../types'

interface PolicyViewProps {
  role: string
  destination: string
  policies: { roles: string[]; destinations: string[]; rules: PolicyRule[] }
  onPolicyUpdate: (rule: PolicyRule) => Promise<void> | void
}

export function PolicyView({
  role,
  destination,
  policies,
  onPolicyUpdate,
}: PolicyViewProps) {
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
      setTimeout(() => {
        setSaveStatus((prev) => {
          const next = { ...prev }
          delete next[rule.id]
          return next
        })
      }, 3000)
    } catch {
      setSaveStatus((prev) => ({ ...prev, [rule.id]: 'error' }))
    }
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Policy Governance Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#D8E2DC] bg-white p-5 shadow-xs">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#557B83]">
            Active Identity Context
          </span>
          <div className="mt-1.5 text-base font-bold text-[#121C1E]">{role}</div>
          <p className="mt-1 text-xs text-[#557B83]">
            Evaluated dynamically against RBAC and boundary exposure rules.
          </p>
        </div>

        <div className="rounded-2xl border border-[#D8E2DC] bg-white p-5 shadow-xs">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#557B83]">
            Target Destination Zone
          </span>
          <div className="mt-1.5 text-base font-bold text-[#121C1E]">{destination}</div>
          <p className="mt-1 text-xs text-[#557B83]">
            Perimeter verified server-side on every inbound transaction.
          </p>
        </div>

        <div className="rounded-2xl border border-[#D8E2DC] bg-white p-5 shadow-xs">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#557B83]">
            Enforcement Mode
          </span>
          <div className="mt-1.5 flex items-center gap-1.5 text-base font-bold text-[#206E4E]">
            <ShieldCheck className="h-4 w-4 text-[#39AEA9]" />
            Fail-Closed
          </div>
          <p className="mt-1 text-xs text-[#557B83]">
            Credential exfiltration rules explicitly override scores to withhold data.
          </p>
        </div>
      </div>

      {/* Role × Sensitivity Boundary Matrix Table */}
      <div className="rounded-2xl border border-[#D8E2DC] bg-white p-6 shadow-xs">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-[#121C1E]">Role × Sensitivity Boundary Matrix</h2>
          <p className="mt-0.5 text-xs text-[#557B83]">
            Cross-reference of authorization policies enforced across caller roles and boundary zones.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#D8E2DC] text-left font-semibold text-[#557B83]">
                <th className="pb-3 pr-4">Role Profile</th>
                <th className="pb-3 px-3 text-center">Credentials</th>
                <th className="pb-3 px-3 text-center">Compensation (External)</th>
                <th className="pb-3 px-3 text-center">Compensation (Internal)</th>
                <th className="pb-3 px-3 text-center">Customer Contact PII</th>
                <th className="pb-3 pl-3 text-center">Security Governance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8E2DC]/60 font-medium">
              {[
                { r: 'General Employee', values: ['block', 'redact', 'redact', 'redact', 'allow'] },
                { r: 'HR Administrator', values: ['block', 'redact', 'allow', 'redact', 'allow'] },
                { r: 'Security Administrator', values: ['block', 'redact', 'redact', 'redact', 'allow'] },
              ].map(({ r, values }) => {
                const isSelected = r === role
                return (
                  <tr
                    key={r}
                    className={`transition-colors ${
                      isSelected ? 'bg-[#EDF7F1]/50 font-semibold' : 'hover:bg-[#F6F8F6]'
                    }`}
                  >
                    <td className="py-3.5 pr-4 text-[#121C1E]">
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="h-2 w-2 rounded-full bg-[#39AEA9] shadow-[0_0_6px_#39AEA9]" />
                        )}
                        <span>{r}</span>
                        {isSelected && (
                          <span className="rounded bg-[#A2D5AB]/30 border border-[#A2D5AB] px-1.5 py-0.2 font-mono text-[9px] text-[#1D603F]">
                            Current
                          </span>
                        )}
                      </div>
                    </td>
                    {values.map((v, idx) => (
                      <td key={idx} className="py-3.5 px-3 text-center">
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

      {/* Configured Policy Rules Configuration */}
      <div className="rounded-2xl border border-[#D8E2DC] bg-white p-6 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#D8E2DC] pb-4">
          <div>
            <h2 className="text-sm font-bold text-[#121C1E]">Active Policy Rules</h2>
            <p className="text-xs text-[#557B83]">
              Default enforcement actions can be updated dynamically in-memory to test downstream effects.
            </p>
          </div>
          <span className="rounded-md border border-[#D8E2DC] bg-[#F6F8F6] px-2.5 py-1 font-mono text-[11px] font-medium text-[#557B83]">
            {policies.rules.length} Rules Active
          </span>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {policies.rules.map((rule) => {
            const isEditing = editingId === rule.id
            const status = saveStatus[rule.id]
            return (
              <div
                key={rule.id}
                className="flex flex-col justify-between rounded-xl border border-[#D8E2DC] bg-[#F6F8F6]/60 p-4 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-[#121C1E]">{rule.title}</h3>
                      <span className="font-mono text-[10px] text-[#557B83]">{rule.id}</span>
                    </div>
                    <ActionBadge action={rule.default_action} />
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-[#557B83]">{rule.description}</p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {rule.applies_to_roles.map((r) => (
                      <span
                        key={r}
                        className="rounded border border-[#D8E2DC] bg-white px-2 py-0.5 text-[10px] font-medium text-[#557B83]"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 border-t border-[#D8E2DC] pt-3">
                  {isEditing ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={editAction}
                        onChange={(e) => setEditAction(e.target.value as Action)}
                        className="rounded-lg border border-[#D8E2DC] bg-white px-2.5 py-1 text-xs text-[#121C1E] outline-none focus:border-[#39AEA9]"
                      >
                        <option value="allow">Allow</option>
                        <option value="redact">Redact</option>
                        <option value="restrict">Restrict</option>
                        <option value="block">Block</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void handleSave(rule)}
                        disabled={status === 'saving'}
                        className="rounded-lg bg-[#182528] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[#203337] disabled:opacity-50"
                      >
                        {status === 'saving' ? 'Saving...' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-[#D8E2DC] bg-white px-2.5 py-1 text-xs text-[#557B83] hover:bg-[#F6F8F6]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(rule.id)
                          setEditAction(rule.default_action)
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#39AEA9] transition hover:text-[#2F938F]"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Modify Action
                      </button>
                      {status === 'saved' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#206E4E]">
                          <Check className="h-3 w-3" /> Updated in-memory
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Persistence Notice */}
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#D8E2DC] bg-[#F6F8F6] p-3 text-[11px] text-[#557B83]">
          <Info className="h-3.5 w-3.5 shrink-0 text-[#39AEA9]" />
          <span>
            <strong>In-Memory Scope:</strong> Policy mutations persist in memory and directly alter subsequent prompt scans. They reset to defaults upon backend server restart.
          </span>
        </div>
      </div>
    </div>
  )
}
