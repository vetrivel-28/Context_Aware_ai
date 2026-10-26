import type { ComponentType } from 'react'
import {
  Database,
  FlaskConical,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import type { PageName } from '../types'

interface NavigationRailProps {
  activePage: PageName
  onSelectPage: (page: PageName) => void
  isExpanded: boolean
  onToggleExpanded: () => void
  isMobileOpen: boolean
  onToggleMobile: () => void
  engineOnline: boolean
}

const DESTINATIONS: Array<{
  id: PageName
  label: string
  sublabel: string
  icon: ComponentType<{ className?: string }>
  badge?: string
}> = [
  {
    id: 'playground',
    label: 'Playground',
    sublabel: 'Inbound Inspection',
    icon: ShieldCheck,
    badge: 'Live',
  },
  {
    id: 'policy',
    label: 'Policies',
    sublabel: 'Boundary Matrix',
    icon: SlidersHorizontal,
    badge: 'RBAC',
  },
  {
    id: 'audit',
    label: 'Audit',
    sublabel: 'Event Ledger',
    icon: Database,
    badge: 'Logs',
  },
  {
    id: 'evaluation',
    label: 'Evaluation',
    sublabel: '10-Vector Suite',
    icon: FlaskConical,
    badge: 'Bench',
  },
]

export function NavigationRail({
  activePage,
  onSelectPage,
  isExpanded,
  onToggleExpanded,
  isMobileOpen,
  onToggleMobile,
  engineOnline,
}: NavigationRailProps) {
  return (
    <>
      {/* Mobile Top Bar */}
      <div className="flex h-14 w-full items-center justify-between border-b border-[#D8E2DC] bg-[#182528] px-4 text-white lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#203337] border border-[#39AEA9]/30 text-[#E5EFC1]">
            <ShieldCheck className="h-5 w-5 text-[#39AEA9]" />
          </div>
          <div>
            <span className="font-semibold text-sm tracking-tight text-[#E5EFC1]">ContextGuard</span>
            <span className="ml-2 text-[10px] text-[#A2D5AB] font-mono">Gateway</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleMobile}
          aria-label={isMobileOpen ? 'Close navigation' : 'Open navigation'}
          className="rounded-lg p-2 text-[#A2D5AB] hover:bg-[#203337] focus:outline-none focus:ring-2 focus:ring-[#39AEA9]"
        >
          {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={onToggleMobile}
        />
      )}

      {/* Sidebar / Rail Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col justify-between border-r border-[#24373B] bg-[#182528] text-white transition-all duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isExpanded ? 'lg:w-64' : 'lg:w-20'}`}
      >
        {/* Top Header & Brand */}
        <div>
          <div className="flex h-16 items-center px-4 border-b border-[#24373B]">
            <div className="flex items-center gap-3 overflow-hidden">
              {/* Distinctive Security Mark */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#203337] to-[#121C1E] border border-[#39AEA9]/40 shadow-xs text-[#E5EFC1]">
                <ShieldCheck className="h-5 w-5 text-[#39AEA9]" />
              </div>
              {(isExpanded || isMobileOpen) && (
                <div className="min-w-0 transition-opacity duration-200">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold tracking-tight text-sm text-[#F6F8F6]">ContextGuard</span>
                    <span className="rounded bg-[#203337] border border-[#39AEA9]/30 px-1 py-0.2 text-[9px] font-mono font-medium text-[#E5EFC1]">
                      v2.4
                    </span>
                  </div>
                  <div className="text-[10px] text-[#A2D5AB] font-medium tracking-wide">
                    Data Privacy Gateway
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Engine Status Sub-banner */}
          {(isExpanded || isMobileOpen) ? (
            <div className="mx-3 mt-3 flex items-center justify-between rounded-lg bg-[#121C1E] px-3 py-2 border border-[#24373B]">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    engineOnline ? 'bg-[#39AEA9] shadow-[0_0_8px_#39AEA9]' : 'bg-rose-500'
                  }`}
                />
                <span className="text-[11px] font-medium text-[#D8E2DC]">
                  {engineOnline ? 'Engine Online' : 'Service Offline'}
                </span>
              </div>
              <span className="text-[9px] font-mono text-[#557B83]">Simulated Sandbox</span>
            </div>
          ) : (
            <div className="mt-3 flex justify-center">
              <span
                title={engineOnline ? 'Engine Online' : 'Offline'}
                className={`h-2.5 w-2.5 rounded-full ${
                  engineOnline ? 'bg-[#39AEA9] shadow-[0_0_8px_#39AEA9]' : 'bg-rose-500'
                }`}
              />
            </div>
          )}

          {/* Navigation Items */}
          <nav className="mt-4 space-y-1.5 px-2.5" aria-label="Main Navigation">
            {DESTINATIONS.map(({ id, label, sublabel, icon: Icon, badge }) => {
              const isActive = activePage === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onSelectPage(id)
                    if (isMobileOpen) onToggleMobile()
                  }}
                  title={!isExpanded && !isMobileOpen ? `${label} — ${sublabel}` : undefined}
                  className={`group relative flex w-full items-center rounded-xl transition-all duration-150 ${
                    isExpanded || isMobileOpen ? 'px-3 py-2.5' : 'justify-center p-3'
                  } ${
                    isActive
                      ? 'bg-[#203337] text-white shadow-xs border border-[#39AEA9]/30'
                      : 'text-[#8FAAB0] hover:bg-[#1E2E31] hover:text-[#E5EFC1] border border-transparent'
                  }`}
                >
                  {/* Slim active indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#39AEA9]" />
                  )}

                  <div className="flex items-center gap-3">
                    <Icon
                      className={`h-5 w-5 shrink-0 transition-colors ${
                        isActive
                          ? 'text-[#39AEA9]'
                          : 'text-[#557B83] group-hover:text-[#A2D5AB]'
                      }`}
                    />

                    {(isExpanded || isMobileOpen) && (
                      <div className="text-left min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs font-semibold tracking-tight ${
                              isActive ? 'text-[#E5EFC1]' : 'text-[#D8E2DC]'
                            }`}
                          >
                            {label}
                          </span>
                          {badge && (
                            <span
                              className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-semibold ${
                                isActive
                                  ? 'bg-[#39AEA9]/20 text-[#E5EFC1]'
                                  : 'bg-[#121C1E] text-[#557B83]'
                              }`}
                            >
                              {badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#557B83] truncate">{sublabel}</p>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Footer Area with Expand/Collapse & Metadata */}
        <div className="p-3 border-t border-[#24373B]">
          {(isExpanded || isMobileOpen) ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-[#121C1E] p-2.5 text-[10px] text-[#557B83] space-y-1 border border-[#24373B]/50">
                <div className="flex justify-between">
                  <span className="text-[#8FAAB0]">Model Target</span>
                  <span className="font-mono text-[#A2D5AB]">Airgapped / Cloud</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8FAAB0]">Fail-Closed</span>
                  <span className="font-mono text-[#39AEA9]">Active</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onToggleExpanded}
                className="hidden lg:flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#8FAAB0] hover:bg-[#203337] hover:text-[#E5EFC1] transition"
              >
                <span className="text-[11px]">Collapse Rail</span>
                <PanelLeftClose className="h-4 w-4 text-[#557B83]" />
              </button>
            </div>
          ) : (
            <div className="hidden lg:flex justify-center">
              <button
                type="button"
                onClick={onToggleExpanded}
                title="Expand Navigation Rail"
                className="rounded-lg p-2 text-[#8FAAB0] hover:bg-[#203337] hover:text-[#E5EFC1] transition"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
