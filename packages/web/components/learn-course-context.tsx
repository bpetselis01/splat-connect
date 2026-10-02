'use client'
/**
 * The Learn course as an admin last saved it (site-content-learn-legal-editing).
 * app/learn/layout.tsx fetches it once and provides it; the course home and
 * every lesson's shell read it here. With no provider — a unit test, or the
 * fetch failing — it is the code's own course.
 */
import { createContext, useContext } from 'react'
import { LEARN_COURSE, type LearnCourse } from '@splat-connect/types'

const LearnCourseContext = createContext<LearnCourse>(LEARN_COURSE)

export function LearnCourseProvider({ course, children }: { course: LearnCourse; children: React.ReactNode }) {
  return <LearnCourseContext.Provider value={course}>{children}</LearnCourseContext.Provider>
}

export const useLearnCourse = () => useContext(LearnCourseContext)
