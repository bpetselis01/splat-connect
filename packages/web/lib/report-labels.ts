/** The reporter-facing name of each member-report category, shared by the admin queue and My reports. */
export const REPORT_CATEGORY = {
  safety: 'Safety concern',
  no_show: 'Didn’t show up',
  arrived_broken: 'Arrived broken',
  wrong_info: 'Wrong or missing info',
  conduct: 'How someone behaved',
  other: 'Something else',
} as const

export type ReportCategory = keyof typeof REPORT_CATEGORY
