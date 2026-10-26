import { useMemo, useState } from 'react'
import {
  ChevronRight,
  Database,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { ActionBadge } from '../ActionBadge'
import type { AuditRecord } from '../../types'

interface AuditViewProps {
  auditLogs: AuditRecord[]
  onRefresh: () => void
}

export function AuditView({ auditLogs, onRefresh }: AuditViewProps) {
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

  const hasActiveFilters = search !== '' || actionFilter !== 'all' || riskFilter !== 'all'

  const handleResetFilters = () => {
    setSearch('')
    setActionFilter('all')
    setRiskFilter('all')
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Search and Filter Console */}
      <div className="rounded-2xl border border-[#D8E2DC] bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D8E2DC] pb-4">
          <div>
            <h2 className="text-sm font-bold text-[#121C1E]">Security Event Ledger</h2>
            <p className="text-xs text-[#557B83]">
              Chronological log of gateway inspections. Sensitive credentials are sanitized prior to storage.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#D8E2DC] bg-white px-3.5 py-2 text-xs font-semibold text-[#121C1E] transition hover:bg-[#F6F8F6] focus:outline-none focus:ring-2 focus:ring-[#39AEA9]"
          >
            <RefreshCw className="h-3.5 w-3.5 text-[#39AEA9]" />
            Refresh Ledger
          </button>
        </div>

        {/* Filter Controls */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#557B83]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search event ID, role, destination..."
              className="w-full rounded-xl border border-[#D8E2DC] bg-[#F6F8F6]/60 pl-8 pr-3 py-2 text-xs text-[#121C1E] outline-none transition focus:border-[#39AEA9] focus:bg-white"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-xl border border-[#D8E2DC] bg-white px-3 py-2 text-xs text-[#121C1E] outline-none transition focus:border-[#39AEA9]"
          >
            <option value="all">All Verdicts</option>
            <option value="allow">Allow</option>
            <option value="redact">Redact</option>
            <option value="block">Block</option>
            <option value="restrict">Restrict</option>
          </select>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="rounded-xl border border-[#D8E2DC] bg-white px-3 py-2 text-xs text-[#121C1E] outline-none transition focus:border-[#39AEA9]"
          >
            <option value="all">All Risk Bands</option>
            <option value="low">Low Risk (&lt; 0.30)</option>
            <option value="medium">Medium Risk (0.30–0.80)</option>
            <option value="high">High Risk (&gt; 0.80)</option>
          </select>
        </div>

        {/* Filter Status Summary */}
        <div className="mt-3 flex items-center justify-between text-[11px] text-[#557B83]">
          <span>
            Showing <strong>{filteredLogs.length}</strong> of <strong>{auditLogs.length}</strong> logged transactions
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 font-semibold text-[#39AEA9] hover:underline"
            >
              <X className="h-3 w-3" />
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Audit Event Ledger Rows */}
      {filteredLogs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8E2DC] bg-white p-12 text-center text-xs text-[#557B83]">
          <Database className="mx-auto mb-2 h-8 w-8 text-[#A2D5AB]" />
          <p>No audit events match your filter criteria.</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-2 text-xs font-semibold text-[#39AEA9] hover:underline"
            >
              Clear search filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {[...filteredLogs].reverse().map((rec) => {
            const isExpanded = expandedId === rec.event_id
            return (
              <div
                key={rec.event_id}
                className="overflow-hidden rounded-2xl border border-[#D8E2DC] bg-white shadow-xs transition"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : rec.event_id)}
                  className="flex w-full flex-wrap items-center justify-between gap-4 p-4 text-left hover:bg-[#F6F8F6]/60 transition"
                >
                  <div className="flex items-center gap-3">
                    <ActionBadge action={rec.action_taken} />
                    <div>
                      <div className="text-xs font-semibold text-[#121C1E]">
                        {rec.selected_role} <span className="text-[#557B83]">→</span> {rec.destination}
                      </div>
                      <span className="font-mono text-[10px] text-[#557B83]">{rec.event_id}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="font-mono text-[11px] text-[#557B83]">
                      {new Date(rec.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className={`font-mono text-xs font-bold ${
                        rec.final_risk_score > 0.8
                          ? 'text-[#A82525]'
                          : rec.final_risk_score >= 0.3
                          ? 'text-[#8F5E0A]'
                          : 'text-[#206E4E]'
                      }`}
                    >
                      Risk {rec.final_risk_score.toFixed(2)}
                    </span>
                    <ChevronRight
                      className={`h-4 w-4 text-[#557B83] transition-transform ${
                        isExpanded ? 'rotate-90 text-[#39AEA9]' : ''
                      }`}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[#D8E2DC] bg-[#F6F8F6]/60 p-4 space-y-3 text-xs">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#557B83]">
                          UTC Timestamp
                        </span>
                        <div className="font-mono text-[11px] text-[#121C1E]">
                          {new Date(rec.timestamp).toISOString()}
                        </div>
                      </div>
                      <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#557B83]">
                          Triggered Rule
                        </span>
                        <div className="font-mono text-[11px] text-[#121C1E]">
                          {rec.applicable_policy_rule}
                        </div>
                      </div>
                      <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#557B83]">
                          Downstream Dispatch
                        </span>
                        <div className="text-[11px] font-semibold text-[#121C1E]">
                          {rec.downstream_invoked ? 'Forwarded (Sanitized)' : 'Suppressed (Blocked)'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#557B83]">
                        Policy Enforcement Rationale
                      </span>
                      <div className="mt-1 rounded-lg border border-[#D8E2DC] bg-white p-2.5 text-[#121C1E] leading-relaxed">
                        {rec.policy_reason}
                      </div>
                    </div>

                    <div>
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#557B83]">
                        Sanitized Payload Preserved in Audit Record
                      </span>
                      <div className="mt-1 rounded-lg border border-[#D8E2DC] bg-white p-2.5 font-mono text-[11px] text-[#121C1E] break-all">
                        {rec.sanitized_output || '— (Zero payload persisted)'}
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
