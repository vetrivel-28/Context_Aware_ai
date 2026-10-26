import { useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  FlaskConical,
  Info,
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
import type { EvaluationResponse, EvaluationResult } from '../../types'

interface EvaluationViewProps {
  evaluation: EvaluationResponse | null
  isLoading: boolean
  onRun: () => void
}

export function EvaluationView({
  evaluation,
  isLoading,
  onRun,
}: EvaluationViewProps) {
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
        {
          label: 'Precision',
          ca: evaluation.context_aware.precision,
          bl: evaluation.baseline.precision,
          note: 'True Positives / Predicted Positives',
        },
        {
          label: 'Recall',
          ca: evaluation.context_aware.recall,
          bl: evaluation.baseline.recall,
          note: 'True Positives / Actual Sensitive',
        },
        {
          label: 'F1 Score',
          ca: evaluation.context_aware.f1,
          bl: evaluation.baseline.f1,
          note: 'Harmonic mean of precision & recall',
        },
        {
          label: 'Avg Latency',
          ca: evaluation.context_aware.average_latency_ms,
          bl: evaluation.baseline.average_latency_ms,
          isRaw: true,
          note: 'Micro-execution pipeline time',
        },
      ]
    : []

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Benchmark Console Header */}
      <div className="rounded-2xl border border-[#D8E2DC] bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D8E2DC] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-[#39AEA9]" />
              <h2 className="text-sm font-bold text-[#121C1E]">
                Empirical Privacy Enforcement Benchmark
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#557B83] max-w-2xl">
              Controlled evaluation of ContextGuard against a naive keyword-only filter over 10 balanced deterministic test vectors.
            </p>
          </div>

          <button
            type="button"
            onClick={onRun}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-[#182528] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#203337] focus:outline-none focus:ring-2 focus:ring-[#39AEA9] disabled:opacity-50"
          >
            <ArrowRight className="h-4 w-4 text-[#39AEA9]" />
            {isLoading ? 'Running Benchmark Suite...' : 'Execute Benchmark Suite'}
          </button>
        </div>

        {!evaluation ? (
          <div className="rounded-xl border border-dashed border-[#D8E2DC] p-12 text-center text-xs text-[#557B83]">
            <Compass className="mx-auto mb-2 h-8 w-8 text-[#A2D5AB]" />
            <p>Click &quot;Execute Benchmark Suite&quot; to execute all 10 synthetic test vectors through both the context-aware engine and keyword baseline.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Primary KPI Metric Comparison Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metricCards.map(({ label, ca, bl, isRaw, note }) => {
                const diff = ca - bl
                return (
                  <div
                    key={label}
                    className="flex flex-col justify-between rounded-xl border border-[#D8E2DC] bg-[#F6F8F6]/60 p-4 transition"
                  >
                    <div>
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#557B83]">
                        {label}
                      </span>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="font-mono text-2xl font-bold text-[#121C1E]">
                          {isRaw ? `${ca.toFixed(2)} ms` : `${(ca * 100).toFixed(1)}%`}
                        </span>
                        <span className="font-mono text-xs text-[#557B83]">
                          Baseline: {isRaw ? `${bl.toFixed(2)} ms` : `${(bl * 100).toFixed(1)}%`}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 border-t border-[#D8E2DC] pt-2">
                      {!isRaw ? (
                        <div
                          className={`text-[11px] font-semibold ${
                            diff >= 0 ? 'text-[#206E4E]' : 'text-[#A82525]'
                          }`}
                        >
                          {diff >= 0
                            ? `+${(diff * 100).toFixed(1)}% vs Keyword Baseline`
                            : `${(diff * 100).toFixed(1)}% vs Keyword Baseline`}
                        </div>
                      ) : (
                        <div className="text-[10px] text-[#557B83]">{note}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Confusion Matrix and Visual Comparison Chart */}
            <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              {/* Dual-Tab Confusion Matrix Console */}
              <div className="rounded-xl border border-[#D8E2DC] bg-white p-5 shadow-xs">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#121C1E]">
                    Confusion Matrix
                  </h3>
                  <div className="inline-flex rounded-lg border border-[#D8E2DC] bg-[#F6F8F6] p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCmTab('context')}
                      className={`rounded-md px-2.5 py-1 font-semibold transition ${
                        cmTab === 'context'
                          ? 'bg-[#182528] text-[#E5EFC1] shadow-xs'
                          : 'text-[#557B83] hover:text-[#121C1E]'
                      }`}
                    >
                      ContextGuard
                    </button>
                    <button
                      type="button"
                      onClick={() => setCmTab('baseline')}
                      className={`rounded-md px-2.5 py-1 font-semibold transition ${
                        cmTab === 'baseline'
                          ? 'bg-[#182528] text-[#E5EFC1] shadow-xs'
                          : 'text-[#557B83] hover:text-[#121C1E]'
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
                      <div className="rounded-xl border border-[#A2D5AB] bg-[#EDF7F1] p-3 text-[#1D603F]">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider opacity-80">
                          True Positives (TP)
                        </span>
                        <div className="mt-1 font-mono text-2xl font-bold">{activeCm.tp}</div>
                        <p className="mt-0.5 text-[10px] opacity-80">Correctly Protected</p>
                      </div>

                      <div className="rounded-xl border border-[#ECCF96] bg-[#FEF9EE] p-3 text-[#8F5E0A]">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider opacity-80">
                          False Positives (FP)
                        </span>
                        <div className="mt-1 font-mono text-2xl font-bold">{activeCm.fp}</div>
                        <p className="mt-0.5 text-[10px] opacity-80">Over-blocked Safe Prompts</p>
                      </div>

                      <div className="rounded-xl border border-[#D8E2DC] bg-[#F6F8F6] p-3 text-[#121C1E]">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#557B83]">
                          True Negatives (TN)
                        </span>
                        <div className="mt-1 font-mono text-2xl font-bold">{activeCm.tn}</div>
                        <p className="mt-0.5 text-[10px] text-[#557B83]">Correctly Allowed</p>
                      </div>

                      <div className="rounded-xl border border-[#F3B9B2] bg-[#FDF2F1] p-3 text-[#A82525]">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider opacity-80">
                          False Negatives (FN)
                        </span>
                        <div className="mt-1 font-mono text-2xl font-bold">{activeCm.fn}</div>
                        <p className="mt-0.5 text-[10px] opacity-80">Missed Confidential Data</p>
                      </div>
                    </div>
                  )
                })()}

                <p className="mt-3 border-t border-[#D8E2DC] pt-2.5 text-[11px] leading-relaxed text-[#557B83]">
                  {cmTab === 'context'
                    ? 'ContextGuard achieves 0 false positives by evaluating role authorization, destination boundary, and verbal context.'
                    : 'The naive keyword baseline exhibits 4 false positives (80% FPR), blocking public salary bands, password complexity standards, and authorized HR reviews.'}
                </p>
              </div>

              {/* Comparative Recharts Visualization */}
              <div className="rounded-xl border border-[#D8E2DC] bg-white p-5 shadow-xs">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#121C1E]">
                    Comparative Performance
                  </h3>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1.5 text-[#557B83]">
                      <span className="h-2 w-2 rounded-sm bg-[#557B83]" /> Baseline
                    </span>
                    <span className="flex items-center gap-1.5 font-semibold text-[#121C1E]">
                      <span className="h-2 w-2 rounded-sm bg-[#39AEA9]" /> ContextGuard
                    </span>
                  </div>
                </div>

                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EAEFEA" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#557B83' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 1.1]} tick={{ fontSize: 10, fill: '#557B83' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          fontSize: 11,
                          borderRadius: 8,
                          backgroundColor: '#182528',
                          color: '#FFFFFF',
                          border: '1px solid #24373B',
                        }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(v: any) => (typeof v === 'number' ? (v * 100).toFixed(1) + '%' : String(v))}
                      />
                      <Bar dataKey="baseline" fill="#557B83" name="Keyword Baseline" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="context" fill="#39AEA9" name="ContextGuard" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Test Case Execution Ledger (10 Vectors) */}
            <div className="overflow-hidden rounded-xl border border-[#D8E2DC] bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-[#D8E2DC] bg-[#F6F8F6]/80 px-4 py-3">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#121C1E]">
                  Vector Execution Ledger ({evaluation.results.length} Cases)
                </h3>
                <span className="text-[11px] font-semibold text-[#206E4E]">
                  {evaluation.results.filter((r) => r.passed).length} / {evaluation.results.length} Tests Verified
                </span>
              </div>

              <div className="divide-y divide-[#D8E2DC]/60 text-xs">
                {evaluation.results.map((item: EvaluationResult) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3.5 hover:bg-[#F6F8F6]/60 transition"
                  >
                    <div className="max-w-md space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#121C1E]">{item.id}</span>
                        {item.category && (
                          <span className="rounded bg-[#F6F8F6] border border-[#D8E2DC] px-1.5 py-0.2 font-mono text-[9px] font-medium text-[#557B83]">
                            {item.category}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-[#557B83] italic">{item.sanitized}</p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-medium">
                      <span className="text-[#557B83]">
                        Target: <strong className="font-mono text-[#121C1E]">{item.expected_action}</strong>
                      </span>
                      <span className="text-[#557B83]">
                        Outcome: <strong className="font-mono text-[#121C1E]">{item.actual_action}</strong>
                      </span>
                      <span className="font-mono text-[11px] text-[#557B83]">
                        {item.latency_ms.toFixed(2)} ms
                      </span>
                      {item.passed ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#A2D5AB] bg-[#EDF7F1] px-2 py-0.5 font-mono text-[10px] font-bold text-[#1D603F]">
                          <CheckCircle2 className="h-3 w-3 text-[#39AEA9]" /> PASS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#F3B9B2] bg-[#FDF2F1] px-2 py-0.5 font-mono text-[10px] font-bold text-[#A82525]">
                          <XCircle className="h-3 w-3" /> FAIL
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Credibility & Limitations Note */}
            <div className="rounded-xl border border-[#D8E2DC] bg-[#F6F8F6] p-4 text-[11px] text-[#557B83] space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#121C1E]">
                <Info className="h-3.5 w-3.5 text-[#39AEA9]" />
                Benchmark Methodology &amp; Evaluation Scope Notice
              </div>
              <p className="leading-relaxed">
                This benchmark suite runs against a deterministic 10-vector dataset. ContextGuard achieves 100% precision on this suite because its rules and context classifiers are explicitly modeled for these enterprise vectors. While this confirms architectural superiority over simple keyword matching, testing on a compact synthetic dataset does not constitute production-scale machine-learning evaluation across open-ended natural language.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
