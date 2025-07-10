// ========================================
// STANDALONE INSIGHTS FUNCTIONS
// ========================================
// These functions are designed to be completely self-contained
// with no external dependencies for easy packaging and reuse.

// ========================================
// TYPES
// ========================================

export type CtrfTestState =
  | 'passed'
  | 'failed'
  | 'skipped'
  | 'pending'
  | 'other'

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
  extra?: Record<string, unknown>
}

export interface Step {
  name: string
  status: CtrfTestState
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
  extra?: Record<string, unknown>
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

export interface Results {
  tool: Tool
  summary: Summary
  tests: CtrfTest[]
  environment?: CtrfEnvironment
  extra?: Record<string, unknown>
}

export interface CtrfReport {
  results: Results
  insights?: Insights
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

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Determines if a test is flaky based on its retries and status.
 *
 * @param test - The CTRF test to evaluate.
 * @returns `true` if the test is considered flaky, otherwise `false`.
 */
export function isTestFlaky(test: CtrfTest): boolean {
  return (
    test.flaky ||
    (test.retries && test.retries > 0 && test.status === 'passed') ||
    false
  )
}

/**
 * Helper function to validate that reports have the necessary data for insights calculation.
 */
function validateReportForInsights(report: CtrfReport): boolean {
  return !!(report?.results?.tests && Array.isArray(report.results.tests))
}

/**
 * Aggregated test metrics across multiple reports.
 */
interface AggregatedTestMetrics {
  totalAttempts: number // Total test attempts (includes retries)
  totalAttemptsFailed: number // Total test attempts failed (includes retries)
  totalResults: number // Total tests results with final status - not including retries
  totalResultsFailed: number // Total tests with final status failed - not including retries
  totalResultsPassed: number // Total tests with final status passed - not including retries
  totalResultsSkipped: number // Total tests with final status skipped/pending/other - not including retries
  totalResultsFlaky: number // Total tests marked as flaky - not including retries
  totalDuration: number // Total duration of all tests
  appearsInReports: number // Number of reports test appears in
}

/**
 * Aggregates test metrics across multiple reports.
 */
function aggregateTestMetricsAcrossReports(
  reports: CtrfReport[]
): Map<string, AggregatedTestMetrics> {
  const metricsMap = new Map<string, AggregatedTestMetrics>()

  for (let reportIndex = 0; reportIndex < reports.length; reportIndex++) {
    const report = reports[reportIndex]
    if (!validateReportForInsights(report)) continue

    for (const test of report.results.tests) {
      const isPassed = test.status === 'passed'
      const isFailed = test.status === 'failed'
      const isSkipped = test.status === 'skipped'
      const isPending = test.status === 'pending'
      const isOther = test.status === 'other'

      const testName = test.name

      if (!metricsMap.has(testName)) {
        metricsMap.set(testName, {
          totalAttempts: 0,
          totalAttemptsFailed: 0,
          totalResults: 0,
          totalResultsFailed: 0,
          totalResultsPassed: 0,
          totalResultsSkipped: 0,
          totalResultsFlaky: 0,
          totalDuration: 0,
          appearsInReports: 0
        })
      }

      const metrics = metricsMap.get(testName)!

      metrics.totalResults += 1
      metrics.totalAttempts += 1 + (test.retries || 0)
      metrics.totalAttemptsFailed += test.retries || 0

      if (isFailed) {
        metrics.totalResultsFailed += 1
        metrics.totalAttemptsFailed += 1 + (test.retries || 0)
      } else if (isPassed) {
        metrics.totalResultsPassed += 1
      } else if (isSkipped) {
        metrics.totalResultsSkipped += 1
      } else if (isPending) {
        metrics.totalResultsSkipped += 1
      } else if (isOther) {
        metrics.totalResultsSkipped += 1
      }
      if (isTestFlaky(test)) {
        metrics.totalResultsFlaky += 1
      }

      metrics.totalDuration += test.duration || 0
    }

    const testsInThisReport = new Set<string>()
    for (const test of report.results.tests) {
      testsInThisReport.add(test.name)
    }
    for (const testName of testsInThisReport) {
      const metrics = metricsMap.get(testName)!
      metrics.appearsInReports += 1
    }
  }

  return metricsMap
}

// ========================================
// INSIGHT Flaky Rate FUNCTIONS
// ========================================

/**
 * Calculates overall flaky rate from aggregated test metrics.
 * Flaky rate = (failed attempts from flaky tests) / (total attempts) * 100
 */
function calculateFlakyRateFromMetrics(
  metricsMap: Map<string, AggregatedTestMetrics>
): number {
  let totalAttempts = 0
  let totalResultsFlaky = 0

  for (const metrics of metricsMap.values()) {
    totalAttempts += metrics.totalAttempts
    totalResultsFlaky += metrics.totalResultsFlaky
  }

  if (totalAttempts === 0) {
    return 0
  }

  return Number(((totalResultsFlaky / totalAttempts) * 100).toFixed(2))
}

/**
 * Calculates flaky rate insights across all reports (current + all previous).
 *
 * @param currentReport - The current CTRF report
 * @param previousReports - Array of historical CTRF reports
 * @returns InsightsMetric with current value calculated across all reports
 */
export function calculateFlakyRateInsight(
  currentReport: CtrfReport,
  previousReports: CtrfReport[]
): InsightsMetric {
  // Combine current report with all previous reports
  const allReports = [currentReport, ...previousReports]

  // Calculate flaky rate across all reports
  const metrics = aggregateTestMetricsAcrossReports(allReports)
  const current = calculateFlakyRateFromMetrics(metrics)

  return { current, previous: 0, change: 0 }
}

// ========================================
// INSIGHT Fail Rate FUNCTIONS
// ========================================

/**
 * Calculates overall fail rate from aggregated test metrics.
 * Fail rate = (totalResultsFailed / totalResults) * 100
 */
function calculateFailRateFromMetrics(
  metricsMap: Map<string, AggregatedTestMetrics>
): number {
  let totalResults = 0
  let totalResultsFailed = 0

  for (const metrics of metricsMap.values()) {
    totalResults += metrics.totalResults
    totalResultsFailed += metrics.totalResultsFailed
  }

  if (totalResults === 0) {
    return 0
  }

  return Number(((totalResultsFailed / totalResults) * 100).toFixed(2))
}

/**
 * Calculates fail rate insights across all reports (current + all previous).
 *
 * @param currentReport - The current CTRF report
 * @param previousReports - Array of historical CTRF reports
 * @returns InsightsMetric with current value calculated across all reports
 */
export function calculateFailRateInsight(
  currentReport: CtrfReport,
  previousReports: CtrfReport[]
): InsightsMetric {
  // Combine current report with all previous reports
  const allReports = [currentReport, ...previousReports]

  // Calculate fail rate across all reports
  const metrics = aggregateTestMetricsAcrossReports(allReports)
  const current = calculateFailRateFromMetrics(metrics)

  return { current, previous: 0, change: 0 }
}

// ========================================
// INSIGHT Skipped Rate FUNCTIONS
// ========================================

/**
 * Calculates overall skipped rate from aggregated test metrics.
 * Skipped rate = (totalResultsSkipped / totalResults) * 100
 */
function calculateSkippedRateFromMetrics(
  metricsMap: Map<string, AggregatedTestMetrics>
): number {
  let totalResults = 0
  let totalResultsSkipped = 0

  for (const metrics of metricsMap.values()) {
    totalResults += metrics.totalResults
    totalResultsSkipped += metrics.totalResultsSkipped
  }

  if (totalResults === 0) {
    return 0
  }

  return Number(((totalResultsSkipped / totalResults) * 100).toFixed(2))
}

/**
 * Calculates skipped rate insights across all reports (current + all previous).
 *
 * @param currentReport - The current CTRF report
 * @param previousReports - Array of historical CTRF reports
 * @returns InsightsMetric with current value calculated across all reports
 */
export function calculateSkippedRateInsight(
  currentReport: CtrfReport,
  previousReports: CtrfReport[]
): InsightsMetric {
  // Combine current report with all previous reports
  const allReports = [currentReport, ...previousReports]

  // Calculate skipped rate across all reports
  const metrics = aggregateTestMetricsAcrossReports(allReports)
  const current = calculateSkippedRateFromMetrics(metrics)

  return { current, previous: 0, change: 0 }
}

// ========================================
// INSIGHT Average Test Duration FUNCTIONS
// ========================================

/**
 * Calculates average test duration from aggregated test metrics.
 * Average test duration = (totalDuration / totalResults)
 */
function calculateAverageTestDurationFromMetrics(
  metricsMap: Map<string, AggregatedTestMetrics>
): number {
  let totalDuration = 0
  let totalResults = 0

  for (const metrics of metricsMap.values()) {
    totalDuration += metrics.totalDuration
    totalResults += metrics.totalResults
  }

  if (totalResults === 0) {
    return 0
  }

  return Number((totalDuration / totalResults).toFixed(2))
}

/**
 * Calculates average test duration insights across all reports (current + all previous).
 *
 * @param currentReport - The current CTRF report
 * @param previousReports - Array of historical CTRF reports
 * @returns InsightsMetric with current value calculated across all reports
 */
export function calculateAverageTestDurationInsight(
  currentReport: CtrfReport,
  previousReports: CtrfReport[]
): InsightsMetric {
  // Combine current report with all previous reports
  const allReports = [currentReport, ...previousReports]

  // Calculate average test duration across all reports
  const metrics = aggregateTestMetricsAcrossReports(allReports)
  const current = calculateAverageTestDurationFromMetrics(metrics)

  return { current, previous: 0, change: 0 }
}

// ========================================
// INSIGHT Average Run Duration FUNCTIONS
// ========================================

/**
 * Calculates average run duration from multiple reports.
 * Average run duration = (sum of all run durations) / (number of reports)
 */
function calculateAverageRunDurationFromReports(reports: CtrfReport[]): number {
  let totalRunDuration = 0
  let validReports = 0

  for (const report of reports) {
    if (!validateReportForInsights(report)) continue
    
    const summary = report.results.summary
    if (summary.start && summary.stop && summary.stop > summary.start) {
      totalRunDuration += summary.stop - summary.start
      validReports += 1
    }
  }

  if (validReports === 0) {
    return 0
  }

  return Number((totalRunDuration / validReports).toFixed(2))
}

/**
 * Calculates average run duration insights across all reports (current + all previous).
 *
 * @param currentReport - The current CTRF report
 * @param previousReports - Array of historical CTRF reports
 * @returns InsightsMetric with current value calculated across all reports
 */
export function calculateAverageRunDurationInsight(
  currentReport: CtrfReport,
  previousReports: CtrfReport[]
): InsightsMetric {
  // Combine current report with all previous reports
  const allReports = [currentReport, ...previousReports]

  // Calculate average run duration across all reports
  const current = calculateAverageRunDurationFromReports(allReports)

  return { current, previous: 0, change: 0 }
}

// ========================================
// INSIGHT Current FUNCTIONS
// ========================================

/**
 * Calculates current insights across all reports.
 *
 * @param currentReport - The current CTRF report
 * @param previousReports - Array of historical CTRF reports
 * @returns Insights with current values calculated across all reports
 */
export function calculateCurrentInsights(
  currentReport: CtrfReport,
  previousReports: CtrfReport[]
): Insights {
  const allReports = [currentReport, ...previousReports]
  const metrics = aggregateTestMetricsAcrossReports(allReports)

  return {
    flakyRate: {
      current: calculateFlakyRateFromMetrics(metrics),
      previous: 0,
      change: 0
    },
    failRate: {
      current: calculateFailRateFromMetrics(metrics),
      previous: 0,
      change: 0
    },
    skippedRate: {
      current: calculateSkippedRateFromMetrics(metrics),
      previous: 0,
      change: 0
    },
    averageTestDuration: {
      current: calculateAverageTestDurationFromMetrics(metrics),
      previous: 0,
      change: 0
    },
    averageRunDuration: {
      current: calculateAverageRunDurationFromReports(allReports),
      previous: 0,
      change: 0
    }
  }
}
