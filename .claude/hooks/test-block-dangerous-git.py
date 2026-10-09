#!/usr/bin/env python3
"""Run: python3 .claude/hooks/test-block-dangerous-git.py   (lives in a file so the hook does not see the cases)"""
import json
import os
import subprocess
import sys

HOOK = os.path.join(os.path.dirname(__file__), "block-dangerous-git.sh")
BLOCKED = [
    "git push origin main",
    "git push origin HEAD:main",
    "git push origin development:main",
    "git push origin HEAD:refs/heads/main",
    "git push origin +main",
    "git push origin +development",
    "git push --force",
    "git push -f origin development",
    "git push --force-with-lease origin development",
    "git push --mirror",
    "git push --all",
    "git push --delete origin main",
    "git -C . push --force",
    "git -c core.x=1 push -f",
    "/usr/bin/git push -f",
    "sudo git reset --hard",
    "FOO=1 git push -f",
    "bash -c 'git push --force'",
    'echo $(git push -f)',
    "cd x && git reset --hard HEAD~1",
    "git reset HEAD~1 --hard",
    "git commit -m \"don't\" && git push -f",
]
ALLOWED = [
    "git push origin development",
    "git push",
    "git push -u origin development",
    "git push origin main:development",
    "git reset --soft HEAD~1",
    "git reset HEAD file",
    "git status",
    "git log --oneline",
    "echo git push main",
    "git commit -m 'push main and git reset --hard'",
    "git commit -m \"git push -f is blocked\"",
    "ls -la",
    "pnpm test",
]


def run(cmd, raw=None):
    payload = raw if raw is not None else json.dumps({"tool_input": {"command": cmd}, "cwd": os.getcwd()})
    return subprocess.run([HOOK], input=payload, capture_output=True, text=True).returncode


bad = [c for c in BLOCKED if run(c) != 2] + [f"ALLOWED wrongly blocked: {c}" for c in ALLOWED if run(c) != 0]
if run(None, raw="not json") != 2:
    bad.append("garbage input must fail closed")
if bad:
    print("FAIL:", *bad, sep="\n  ")
    sys.exit(1)
print(f"ok: {len(BLOCKED)} blocked, {len(ALLOWED)} allowed, garbage input blocked")
