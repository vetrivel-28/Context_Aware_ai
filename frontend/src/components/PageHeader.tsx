import { Layers } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle: string
  badge?: string
}

export function PageHeader({ title, subtitle, badge }: PageHeaderProps) {
  return (
    <header className="border-b border-[#D8E2DC] bg-[#FFFFFF] px-6 lg:px-8 py-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-[#121C1E]">{title}</h1>
            {badge && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[#A2D5AB] bg-[#EDF7F1] px-2 py-0.5 text-[10px] font-mono font-semibold tracking-wide text-[#1D603F]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#39AEA9]" />
                {badge}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#557B83] max-w-2xl">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-[#D8E2DC] bg-[#F6F8F6] px-3 py-1.5 text-xs text-[#557B83]">
            <Layers className="h-3.5 w-3.5 text-[#39AEA9]" />
            <span className="font-medium text-[#121C1E]">Boundary:</span>
            <span className="font-mono text-[11px] text-[#557B83]">Simulated Sandbox</span>
          </div>
        </div>
      </div>
    </header>
  )
}
