/**
 * The rail's collapsed-state cookie name.
 *
 * Lives here rather than only in components/shell-frame.tsx because that file
 * is 'use client': Next.js's client boundary turns every export of a 'use
 * client' module into a client reference, including plain string constants,
 * so a server component importing it directly there sees a reference object
 * instead of the string and every cookie lookup silently misses. A shared,
 * boundary-free module is the one value both sides can read for real.
 */
export const RAIL_COOKIE = 'rail-collapsed'
