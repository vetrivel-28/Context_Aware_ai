interface RiskMeterProps {
  label: string
  weight: string
  value: number
}

export function RiskMeter({ label, weight, value }: RiskMeterProps) {
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)))

  // Color mapping based on risk thresholds
  const barColor =
    value > 0.8
      ? 'bg-[#A82525]' // Crimson for high risk
      : value >= 0.3
      ? 'bg-[#557B83]' // Slate teal for medium risk
      : 'bg-[#39AEA9]' // Teal for low risk

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[#121C1E]">
          {label} <span className="font-normal text-[#557B83]">({weight})</span>
        </span>
        <span className="font-mono font-semibold text-[#121C1E]">{value.toFixed(2)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E8EFEA]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
