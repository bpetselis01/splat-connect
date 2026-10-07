#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
execFileSync(process.execPath, [new URL('./check.mjs', import.meta.url).pathname, '--write'], { stdio: 'inherit' })
