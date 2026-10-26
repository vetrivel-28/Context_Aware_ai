export type PageName = 'playground' | 'policy' | 'audit' | 'evaluation'

export type Action = 'allow' | 'redact' | 'restrict' | 'block'

export interface DetectionEntity {
  type: string
  value: string
  start: number
  end: number
  confidence: number
}

export interface ContextClassification {
  label: string
  confidence: number
  source: string
}

export interface DownstreamResult {
  invoked: boolean
  received_payload: string | null
  response: string
  destination?: string
}

export interface ScanResult {
  action: Action
  risk_score: number
  score_breakdown: {
    entity_risk: number
    context_risk: number
    exposure_risk: number
  }
  decision_reason: string
  sanitized_output: string
  detected_entities: DetectionEntity[]
  context_classification: ContextClassification
  policy_rule: string
  detection_method: string
  downstream: DownstreamResult
  event_id: string
}

export interface PolicyRule {
  id: string
  title: string
  description: string
  applies_to_roles: string[]
  applies_to_destinations: string[]
  sensitivity_levels: string[]
  default_action: Action
}

export interface AuditRecord {
  event_id: string
  timestamp: string
  entity_types: string[]
  context_classification: ContextClassification
  entity_risk: number
  context_risk: number
  exposure_risk: number
  final_risk_score: number
  selected_role: string
  destination: string
  action_taken: Action
  applicable_policy_rule: string
  detection_method: string
  sanitized_output: string
  downstream_invoked: boolean
  policy_reason: string
}

export interface EvaluationMetrics {
  true_positives: number
  false_positives: number
  true_negatives: number
  false_negatives: number
  precision: number
  recall: number
  f1: number
  false_positive_rate: number
  false_negative_rate: number
  average_latency_ms: number
}

export interface EvaluationResult {
  id: string
  expected_action: string
  actual_action: string
  expected_sensitive: boolean
  actual_sensitive: boolean
  passed: boolean
  latency_ms: number
  sanitized: string
  context: ContextClassification
}

export interface EvaluationResponse {
  dataset: unknown[]
  results: EvaluationResult[]
  baseline: EvaluationMetrics
  context_aware: EvaluationMetrics
  confusion_matrix: {
    tp: number
    fp: number
    tn: number
    fn: number
  }
}

export interface Scenario {
  id: string
  label: string
  text: string
  expected: string
}
