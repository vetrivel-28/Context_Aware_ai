import { useEffect, useState } from 'react'
import { NavigationRail } from './components/NavigationRail'
import { PageHeader } from './components/PageHeader'
import { PlaygroundView, SAMPLE_SCENARIOS } from './components/views/PlaygroundView'
import { PolicyView } from './components/views/PolicyView'
import { AuditView } from './components/views/AuditView'
import { EvaluationView } from './components/views/EvaluationView'
import {
  fetchAuditLogs,
  fetchPolicies,
  healthCheck,
  runEvaluation,
  scanPrompt,
  updatePolicy,
} from './services/api'
import type {
  AuditRecord,
  EvaluationResponse,
  PageName,
  PolicyRule,
  ScanResult,
} from './types'

export default function App() {
  const [page, setPage] = useState<PageName>('playground')
  const [isExpanded, setIsExpanded] = useState<boolean>(true)
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false)

  // Scan & Prompt Parameters
  const [prompt, setPrompt] = useState(SAMPLE_SCENARIOS[1].text)
  const [selectedScenario, setSelectedScenario] = useState(SAMPLE_SCENARIOS[1].id)
  const [role, setRole] = useState('General Employee')
  const [destination, setDestination] = useState('External AI service')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // API Domain State
  const [result, setResult] = useState<ScanResult | null>(null)
  const [policies, setPolicies] = useState<{ roles: string[]; destinations: string[]; rules: PolicyRule[] }>({
    roles: [],
    destinations: [],
    rules: [],
  })
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([])
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null)
  const [health, setHealth] = useState<{ status: string; service: string } | null>(null)

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
      setHealth({ status: 'unreachable', service: 'ContextGuard Data Privacy Gateway' })
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
      setError(e instanceof Error ? e.message : 'Privacy gateway scan failed')
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
      setError(e instanceof Error ? e.message : 'Benchmark execution failed')
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
    <div className="min-h-screen bg-[#F6F8F6] text-[#121C1E] antialiased">
      {/* Security Navigation Rail */}
      <NavigationRail
        activePage={page}
        onSelectPage={setPage}
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded((prev) => !prev)}
        isMobileOpen={isMobileOpen}
        onToggleMobile={() => setIsMobileOpen((prev) => !prev)}
        engineOnline={health?.status === 'ok'}
      />

      {/* Main Content Surface */}
      <div
        className={`min-h-screen flex flex-col transition-all duration-300 ease-in-out ${
          isExpanded ? 'lg:pl-64' : 'lg:pl-20'
        }`}
      >
        <main className="flex-1 min-w-0">
          {page === 'playground' && (
            <>
              <PageHeader
                title="Privacy Playground & Inspection Workstation"
                subtitle="Inspect inbound natural language prompts with multi-stage entity detection, risk scoring, and policy routing."
                badge="Active Protection"
              />
              <PlaygroundView
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
                onClear={() => {
                  setPrompt('')
                  setResult(null)
                  setError(null)
                }}
              />
            </>
          )}

          {page === 'policy' && (
            <>
              <PageHeader
                title="Policy Governance & Boundary Matrix"
                subtitle="Configure and customize role-based data exfiltration rules, destination boundary zones, and sensitivity levels."
                badge="Governance Engine"
              />
              <PolicyView
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
                subtitle="Review chronological audit events of privacy inspections, sanitized payloads, and fail-closed actions."
                badge="Compliance Audit"
              />
              <AuditView auditLogs={auditLogs} onRefresh={loadAuditLogs} />
            </>
          )}

          {page === 'evaluation' && (
            <>
              <PageHeader
                title="Quantitative Benchmark Console"
                subtitle="Rigorous empirical comparison of ContextGuard against naive keyword-only filtering across 10 deterministic test vectors."
                badge="Jury Evaluation"
              />
              <EvaluationView
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
