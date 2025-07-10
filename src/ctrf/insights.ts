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

export interface TestInsights {
  flakyRate: InsightsMetric
  failRate: InsightsMetric
  skippedRate: InsightsMetric
  averageTestDuration: InsightsMetric
  appearsInRuns: number
  extra?: Record<string, unknown>
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
  insights?: TestInsights
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
  reportsAnalyzed: number
  extra?: Record<string, unknown>
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
 * Base run-level metrics aggregated across multiple reports.
 */
interface AggregatedRunMetrics {
  totalAttempts: number      // Total test attempts (includes retries)
  totalAttemptsFailed: number // Total test attempts failed (includes retries)  
  totalResults: number       // Total test results with final status - not including retries
  totalResultsFailed: number // Total test results with final status failed - not including retries
  totalResultsPassed: number // Total test results with final status passed - not including retries
  totalResultsSkipped: number // Total test results with final status skipped/pending/other - not including retries
  totalResultsFlaky: number  // Total test results marked as flaky - not including retries
  totalResultsDuration: number      // Total duration of all tests
  reportsAnalyzed: number    // Total number of reports analyzed    
}

/**
 * Aggregated run metrics for a single test across multiple reports,
 */
interface AggregatedTestMetrics extends AggregatedRunMetrics {
  appearsInRuns: number // Number of runs test appears in
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
          totalResultsDuration: 0,
          appearsInRuns: 0,
          reportsAnalyzed: 0
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

      metrics.totalResultsDuration += test.duration || 0
    }

    // Track which tests appeared in this report
    const testsInThisReport = new Set<string>()
    for (const test of report.results.tests) {
      testsInThisReport.add(test.name)
    }
    for (const testName of testsInThisReport) {
      const metrics = metricsMap.get(testName)!
      metrics.appearsInRuns += 1
    }
  }

  return metricsMap
}

/**
 * Consolidates all test-level metrics into overall run-level metrics.
 */
function consolidateTestMetricsToRunMetrics(
  metricsMap: Map<string, AggregatedTestMetrics>
): AggregatedRunMetrics {
  let totalAttempts = 0
  let totalAttemptsFailed = 0
  let totalResults = 0
  let totalResultsFailed = 0
  let totalResultsPassed = 0
  let totalResultsSkipped = 0
  let totalResultsFlaky = 0
  let totalResultsDuration = 0

  for (const metrics of metricsMap.values()) {
    totalAttempts += metrics.totalAttempts
    totalAttemptsFailed += metrics.totalAttemptsFailed
    totalResults += metrics.totalResults
    totalResultsFailed += metrics.totalResultsFailed
    totalResultsPassed += metrics.totalResultsPassed
    totalResultsSkipped += metrics.totalResultsSkipped
    totalResultsFlaky += metrics.totalResultsFlaky
    totalResultsDuration += metrics.totalResultsDuration
  }

  return {
    totalAttempts,
    totalAttemptsFailed,
    totalResults,
    totalResultsFailed,
    totalResultsPassed,
    totalResultsSkipped,
    totalResultsFlaky,
    totalResultsDuration,
    reportsAnalyzed: metricsMap.size
  }
}

// ========================================
// INSIGHT Flaky Rate FUNCTIONS
// ========================================

/**
 * Calculates overall flaky rate from consolidated run metrics.
 * Flaky rate = (failed attempts from flaky tests) / (total attempts) * 100
 */
function calculateFlakyRateFromMetrics(
  runMetrics: AggregatedRunMetrics
): number {
  if (runMetrics.totalAttempts === 0) {
    return 0
  }

  return Number(((runMetrics.totalResultsFlaky / runMetrics.totalAttempts) * 100).toFixed(2))
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
  const testMetrics = aggregateTestMetricsAcrossReports(allReports)
  const runMetrics = consolidateTestMetricsToRunMetrics(testMetrics)
  const current = calculateFlakyRateFromMetrics(runMetrics)

  return { current, previous: 0, change: 0 }
}

// ========================================
// INSIGHT Fail Rate FUNCTIONS
// ========================================

/**
 * Calculates overall fail rate from consolidated run metrics.
 * Fail rate = (totalResultsFailed / totalResults) * 100
 */
function calculateFailRateFromMetrics(
  runMetrics: AggregatedRunMetrics
): number {
  if (runMetrics.totalResults === 0) {
    return 0
  }

  return Number(((runMetrics.totalResultsFailed / runMetrics.totalResults) * 100).toFixed(2))
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
  const testMetrics = aggregateTestMetricsAcrossReports(allReports)
  const runMetrics = consolidateTestMetricsToRunMetrics(testMetrics)
  const current = calculateFailRateFromMetrics(runMetrics)

  return { current, previous: 0, change: 0 }
}

// ========================================
// INSIGHT Skipped Rate FUNCTIONS
// ========================================

/**
 * Calculates overall skipped rate from consolidated run metrics.
 * Skipped rate = (totalResultsSkipped / totalResults) * 100
 */
function calculateSkippedRateFromMetrics(
  runMetrics: AggregatedRunMetrics
): number {
  if (runMetrics.totalResults === 0) {
    return 0
  }

  return Number(((runMetrics.totalResultsSkipped / runMetrics.totalResults) * 100).toFixed(2))
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
  const testMetrics = aggregateTestMetricsAcrossReports(allReports)
  const runMetrics = consolidateTestMetricsToRunMetrics(testMetrics)
  const current = calculateSkippedRateFromMetrics(runMetrics)

  return { current, previous: 0, change: 0 }
}

// ========================================
// INSIGHT Average Test Duration FUNCTIONS
// ========================================

/**
 * Calculates average test duration from consolidated run metrics.
 * Average test duration = (totalDuration / totalResults)
 */
function calculateAverageTestDurationFromMetrics(
  runMetrics: AggregatedRunMetrics
): number {
  if (runMetrics.totalResults === 0) {
    return 0
  }

  return Number((runMetrics.totalResultsDuration / runMetrics.totalResults).toFixed(2))
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
  const testMetrics = aggregateTestMetricsAcrossReports(allReports)
  const runMetrics = consolidateTestMetricsToRunMetrics(testMetrics)
  const current = calculateAverageTestDurationFromMetrics(runMetrics)

  return { current, previous: 0, change: 0 }
}

// ========================================
// INSIGHT Average Run Duration FUNCTIONS
// ========================================

/**
 * Calculates average run duration from consolidated run metrics.
 * Average run duration = (totalDuration / reportsAnalyzed)
 */
function calculateAverageRunDurationFromMetrics(
  runMetrics: AggregatedRunMetrics
): number {
  if (runMetrics.reportsAnalyzed === 0) {
    return 0
  }

  return Number((runMetrics.totalResultsDuration / runMetrics.reportsAnalyzed).toFixed(2))
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

  const testMetrics = aggregateTestMetricsAcrossReports(allReports)
  const runMetrics = consolidateTestMetricsToRunMetrics(testMetrics)

  // Calculate average run duration across all reports
  const current = calculateAverageRunDurationFromMetrics(runMetrics)

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
  const testMetrics = aggregateTestMetricsAcrossReports(allReports)
  const runMetrics = consolidateTestMetricsToRunMetrics(testMetrics)

  const { reportsAnalyzed, ...relevantMetrics } = runMetrics

  return {
    flakyRate: {
      current: calculateFlakyRateFromMetrics(runMetrics),
      previous: 0,
      change: 0
    },
    failRate: {
      current: calculateFailRateFromMetrics(runMetrics),
      previous: 0,
      change: 0
    },
    skippedRate: {
      current: calculateSkippedRateFromMetrics(runMetrics),
      previous: 0,
      change: 0
    },
    averageTestDuration: {
      current: calculateAverageTestDurationFromMetrics(runMetrics),
      previous: 0,
      change: 0
    },
    averageRunDuration: {
      current: calculateAverageRunDurationFromMetrics(runMetrics),
      previous: 0,
      change: 0
    },
    reportsAnalyzed: allReports.length,
    extra: relevantMetrics

  }
}

// ========================================
// TEST-LEVEL INSIGHTS FUNCTIONS
// ========================================

/**
 * Calculates test-level flaky rate for a specific test.
 */
function calculateTestFlakyRate(
  testName: string,
  testMetrics: AggregatedTestMetrics
): InsightsMetric {
  const current = testMetrics.totalResults === 0 ? 0 : 
    Number(((testMetrics.totalResultsFlaky / testMetrics.totalResults) * 100).toFixed(2))

  return { current, previous: 0, change: 0 }
}

/**
 * Calculates test-level fail rate for a specific test.
 */
function calculateTestFailRate(
  testName: string,
  testMetrics: AggregatedTestMetrics
): InsightsMetric {
  const current = testMetrics.totalResults === 0 ? 0 : 
    Number(((testMetrics.totalResultsFailed / testMetrics.totalResults) * 100).toFixed(2))

  return { current, previous: 0, change: 0 }
}

/**
 * Calculates test-level skipped rate for a specific test.
 */
function calculateTestSkippedRate(
  testName: string,
  testMetrics: AggregatedTestMetrics
): InsightsMetric {
  const current = testMetrics.totalResults === 0 ? 0 : 
    Number(((testMetrics.totalResultsSkipped / testMetrics.totalResults) * 100).toFixed(2))

  return { current, previous: 0, change: 0 }
}

/**
 * Calculates test-level average duration for a specific test.
 */
function calculateTestAverageDuration(
  testName: string,
  testMetrics: AggregatedTestMetrics
): InsightsMetric {
  const current = testMetrics.totalResults === 0 ? 0 : 
    Number((testMetrics.totalResultsDuration / testMetrics.totalResults).toFixed(2))

  return { current, previous: 0, change: 0 }
}

/**
 * Calculates test-level insights for a specific test.
 */
function calculateTestInsights(
  testName: string,
  testMetrics: AggregatedTestMetrics,
): TestInsights {
  const { appearsInRuns, reportsAnalyzed, ...relevantMetrics } = testMetrics

  return {
    flakyRate: calculateTestFlakyRate(testName, testMetrics),
    failRate: calculateTestFailRate(testName, testMetrics),
    skippedRate: calculateTestSkippedRate(testName, testMetrics),
    averageTestDuration: calculateTestAverageDuration(testName, testMetrics),
    appearsInRuns: testMetrics.appearsInRuns,
    extra: relevantMetrics
  }
}

/**
 * Adds test-level insights to all tests in the current report.
 *
 * @param currentReport - The current CTRF report to add insights to
 * @param previousReports - Array of historical CTRF reports
 * @returns The current report with test-level insights added to each test
 */
export function addTestInsightsToCurrentReport(
  currentReport: CtrfReport,
  previousReports: CtrfReport[]
): CtrfReport {
  if (!validateReportForInsights(currentReport)) {
    return currentReport
  }

  // Combine current report with all previous reports for analysis
  const allReports = [currentReport, ...previousReports]
  const testMetrics = aggregateTestMetricsAcrossReports(allReports)

  // Create a copy of the current report to avoid mutating the original
  const reportWithInsights: CtrfReport = {
    ...currentReport,
    results: {
      ...currentReport.results,
      tests: currentReport.results.tests.map(test => {
        const testName = test.name
        const metrics = testMetrics.get(testName)
        
        if (metrics) {
          const testInsights = calculateTestInsights(testName, metrics)
          return {
            ...test,
            insights: testInsights
          }
        }
        
        // If no metrics found, return test without insights
        return test
      })
    }
  }

  return reportWithInsights
}

// ========================================
// BASELINE INSIGHTS FUNCTIONS
// ========================================

/**
 * Calculates baseline report-level insights using existing insights from current and previous reports.
 * Both reports should already have their insights populated.
 *
 * @param currentReport - The current CTRF report with insights
 * @param previousReport - The previous CTRF report with insights
 * @returns Insights with current, previous, and change values calculated
 */
export function calculateReportInsightsBaseline(
  currentReport: CtrfReport,
  previousReport: CtrfReport
): Insights {
  const currentInsights = currentReport.insights
  const previousInsights = previousReport.insights

  if (!currentInsights || !previousInsights) {
    console.log('Both reports must have insights populated')
    return currentReport.insights as Insights
  }

  return {
    flakyRate: {
      current: currentInsights.flakyRate.current,
      previous: previousInsights.flakyRate.current,
      change: Number((currentInsights.flakyRate.current - previousInsights.flakyRate.current).toFixed(2))
    },
    failRate: {
      current: currentInsights.failRate.current,
      previous: previousInsights.failRate.current,
      change: Number((currentInsights.failRate.current - previousInsights.failRate.current).toFixed(2))
    },
    skippedRate: {
      current: currentInsights.skippedRate.current,
      previous: previousInsights.skippedRate.current,
      change: Number((currentInsights.skippedRate.current - previousInsights.skippedRate.current).toFixed(2))
    },
    averageTestDuration: {
      current: currentInsights.averageTestDuration.current,
      previous: previousInsights.averageTestDuration.current,
      change: Number((currentInsights.averageTestDuration.current - previousInsights.averageTestDuration.current).toFixed(2))
    },
    averageRunDuration: {
      current: currentInsights.averageRunDuration.current,
      previous: previousInsights.averageRunDuration.current,
      change: Number((currentInsights.averageRunDuration.current - previousInsights.averageRunDuration.current).toFixed(2))
    },
    reportsAnalyzed: currentInsights.reportsAnalyzed,
    extra: currentInsights.extra
  }
}

// what to do
// p95 duration per test
// avg tests per run

// basline functions. Pass in a previous report and a current report and update current report with insights.





