#!/usr/bin/env python3
"""Run `graphify hook-guard <kind>` the first time per session and per kind, then stay silent.

The guard nudges on every grep and read; after the first one it is noise that the agent
learns to ignore. Fails open: any error prints nothing.
"""
import json, os, subprocess, sys, tempfile

GRAPHIFY = '/Library/Frameworks/Python.framework/Versions/3.13/bin/graphify'
kind = sys.argv[1] if len(sys.argv) > 1 else 'search'
raw = sys.stdin.buffer.read()
try:
    sid = str(json.loads(raw).get('session_id') or '')
except Exception:
    sid = ''
marker = os.path.join(tempfile.gettempdir(), f'graphify-nudged-{sid or os.getppid()}-{kind}')
if os.path.exists(marker):
    sys.exit(0)
out = subprocess.run([GRAPHIFY, 'hook-guard', kind], input=raw, capture_output=True, timeout=8).stdout
if out.strip():
    open(marker, 'w').close()  # only a real nudge uses up the one allowed
    sys.stdout.buffer.write(out)
