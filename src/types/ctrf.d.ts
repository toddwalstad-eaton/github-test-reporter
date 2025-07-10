export interface CtrfReport {
  results: Results
  insights?: RunInsights
}

export interface Results {
  tool: Tool
  summary: Summary
  tests: CtrfTest[]
  environment?: CtrfEnvironment
  extra?: EnhancedResultsExtra & Record<string, unknown>
}

export interface Summary {
  tests: number
  passed: number
  failed: number
  skipped: number
  pending: number
  other: number
  suites?: number
  start: number
  stop: number
  extra?: EnhancedSummaryExtra & Record<string, unknown>
}

export interface CtrfTest {
  name: string
  status: CtrfTestState
  duration: number
  start?: number
  stop?: number
  suite?: string
  message?: string
  trace?: string
  line?: number
  ai?: string
  rawStatus?: string
  tags?: string[]
  type?: string
  filePath?: string
  retries?: number
  flaky?: boolean
  attempts?: CtrfTest[]
  browser?: string
  device?: string
  screenshot?: string
  parameters?: Record<string, unknown>
  steps?: Step[]
  extra?: EnhancedTestExtra & Record<string, unknown>
}

export interface CtrfEnvironment {
  reportName?: string
  appName?: string
  appVersion?: string
  osPlatform?: string
  osRelease?: string
  osVersion?: string
  buildName?: string
  buildNumber?: string
  buildUrl?: string
  repositoryName?: string
  repositoryUrl?: string
  branchName?: string
  testEnvironment?: string
  extra?: Record<string, unknown>
}

export interface Tool {
  name: string
  version?: string
  extra?: Record<string, unknown>
}

export interface Step {
  name: string
  status: CtrfTestState
}

export type CtrfTestState =
  | 'passed'
  | 'failed'
  | 'skipped'
  | 'pending'
  | 'other'

export type RunInsights = {
  reportsAnalyzed?: number
  flakyRate?: InsightsMetric
  failRate?: InsightsMetric
  skippedRate?: InsightsMetric
  averageRunDuration?: InsightsMetric
  averageTestDuration?: InsightsMetric
  extra?: Record<string, unknown>
}

export type TestInsights = {
  flakyRate?: InsightsMetric
  failRate?: InsightsMetric
  skippedRate?: InsightsMetric
  averageDuration?: InsightsMetric
  averageP95Duration?: InsightsMetric
  extra?: Record<string, unknown>
}

export type InsightsMetric = {
  current: number
  previous: number
  change: number
}

/**
 * Metrics interfaces
 */
export interface TestMetrics {
  totalAttempts: number
  flakyCount: number
  passedCount: number
  failedCount: number
  finalResults: number
  finalFailures: number
}

export interface Insights {
  flakyRate: InsightsMetric
  failRate: InsightsMetric
  skippedRate: InsightsMetric
  averageTestDuration: InsightsMetric
  averageRunDuration: InsightsMetric
}

export interface InsightsMetric {
  current: number
  previous: number
  change: number
}

/**
 * Enhanced extra fields for tests.
 * This extends the basic `extra` fields with additional metrics.
 */
export interface EnhancedTestExtra {
  totalAttempts: number
  flakyRate: number
  flakyRateChange: number
  passedCount: number
  failedCount: number
  failRate: number
  failRateChange: number
  finalResults: number
  finalFailures: number
  avgDuration?: number
}

/**
 * Enhanced extra fields for summary.
 */
export interface EnhancedSummaryExtra extends Record<string, unknown> {
  // to be replaced with insights.flakyRate.current
  flakyRate: number
  // to be replaced with insights.flakyRate.change
  flakyRateChange: number
  // to be replaced with insights.failRate.current
  failRate: number
  // to be replaced with insights.failRate.change
  failRateChange: number
  // to be replaced with insights.finalResults.current
  finalResults: number
  finalFailures: number
  duration?: number
  result?: string
  averageTestsPerRun?: number
  totalFlakyTests?: number
  totalFailures?: number
  reportsUsed?: number
  slowestTest?: {
    name: string
    duration: number
  }
  slowestTests?: CtrfTest[]
  includeFailedReportCurrentFooter?: boolean
  includeFlakyReportCurrentFooter?: boolean
  includeFailedReportAllFooter?: boolean
  includeFlakyReportAllFooter?: boolean
  includeMeasuredOverFooter?: boolean
  includeSkippedReportCurrentFooter?: boolean
  includeSkippedReportAllFooter?: boolean
  showSkippedReports?: boolean
  showFailedReports?: boolean
  showFlakyReports?: boolean
}

/**
 * Enhanced results extra fields.
 */
export interface EnhancedResultsExtra {
  previousReports: EnhancedCtrfReport[]
}

/**
 * An enhanced CTRF report, which could be used for referencing previous reports.
 */
export interface EnhancedCtrfReport {
  results: Results
}
