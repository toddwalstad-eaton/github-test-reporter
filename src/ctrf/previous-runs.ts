import { CtrfReport } from '../types/ctrf'

// here i need to add functions to manage the data for previous runs

// Type definition for extracted run data
export interface PreviousRunData {
  id: string
  date: number
  status: 'passed' | 'failed' | 'mixed'
  passed: number
  failed: number
  skipped: number
  flaky: number
  duration: number
  buildUrl?: string
  buildNumber?: string
}

// Extended CTRF report with previousRuns property
export interface CtrfReportWithPreviousRuns extends CtrfReport {
  previousRuns?: PreviousRunData[]
}

// set a root level property to store the previous runs
// an array of objects with the following properties:
// - id: the id of the run
// - date: the date of the run
// - status: the status of the run
// - passed: the number of tests that passed
// - fail: the number of tests that failed
// - skip: the number of tests that were skipped
// - flaky: the number of tests that were flaky
// - duration: the duration of the run
// - build url
// build number

/**
 * Extracts key details from an array of CTRF reports
 * @param reports - Array of CTRF reports to extract data from
 * @returns Array of extracted run data
 */
export function extractPreviousRunsData(reports: CtrfReport[]): PreviousRunData[] {
  return reports.map((report, index) => {
    const { results } = report
    const { summary, environment } = results
    
    // Calculate flaky test count
    const flakyCount = results.tests.filter(test => test.flaky === true).length
    
    // Calculate duration (in milliseconds)
    const duration = summary.stop - summary.start
    
    // Determine overall status
    let status: 'passed' | 'failed' | 'mixed' = 'passed'
    if (summary.failed > 0) {
      status = summary.passed > 0 ? 'mixed' : 'failed'
    }
    
    const id = environment?.buildNumber || `${summary.start}_${index}`
    
    return {
      id,
      date: summary.start,
      status,
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
      flaky: flakyCount,
      duration,
      buildUrl: environment?.buildUrl,
      buildNumber: environment?.buildNumber
    }
  })
}

/**
 * Sets the previousRuns property on a CTRF report
 * @param report - The CTRF report to modify
 * @param previousRuns - Array of previous run data to set
 * @returns The modified report with previousRuns property
 */
export function setPreviousRuns(
  report: CtrfReport, 
  previousRuns: PreviousRunData[]
): CtrfReportWithPreviousRuns {
  return {
    ...report,
    previousRuns
  }
}
