#!/usr/bin/env python3
"""PreToolUse hook (Bash): block pushes to main/master, force pushes and `git reset --hard`.

Reads the hook JSON on stdin. Exit 2 blocks and sends the message to Claude. Unreadable input
blocks (fail closed). Commands are tokenised with shlex, so quoted text such as a commit message
is not mistaken for a command, and wrappers (sudo, env, bash -c, $(...), full paths, -C dir) are seen through.
"""
import json
import os
import re
import shlex
import subprocess
import sys

PROTECTED = {"main", "master"}
WRAPPERS = {"sudo", "command", "env", "exec", "nohup", "time", "builtin"}
SHELLS = {"bash", "sh", "zsh", "dash", "ksh"}
GIT_OPTS_WITH_ARG = {"-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"}


def block(why):
    print(f"BLOCKED: {why}. You do not have authority to run this; ask the user.", file=sys.stderr)
    sys.exit(2)


def segments(cmd):
    cmd = re.sub(r"\$\(|`|\)", " ; ", cmd)  # command substitutions become their own segments
    lex = shlex.shlex(cmd, posix=True, punctuation_chars=True)
    lex.whitespace_split = True
    seg = []
    for tok in lex:
        if tok and all(c in "();&|<>" for c in tok):
            if seg:
                yield seg
            seg = []
        else:
            seg.append(tok)
    if seg:
        yield seg


def current_branch(directory):
    try:
        out = subprocess.run(["git", "-C", directory, "branch", "--show-current"], capture_output=True, text=True, timeout=5)
        return out.stdout.strip()
    except Exception:
        return ""


def check_push(rest, directory):
    for a in (x for x in rest if x.startswith("-")):
        if a in ("--mirror", "--all", "--prune") or a.startswith("--force") or a == "-f":
            block("force or bulk push")
        if re.fullmatch(r"-[a-zA-Z]*f[a-zA-Z]*", a):
            block("force push")
    refspecs = [a for a in rest if not a.startswith("-")][1:]  # first positional is the remote
    for r in refspecs:
        if r.startswith("+"):
            block("force push")
        dst = re.sub(r"^refs/heads/", "", r.split(":")[-1])
        if dst in PROTECTED:
            block("push to main")
    if not refspecs or any(r in ("HEAD", "@") for r in refspecs):
        if current_branch(directory) in PROTECTED:
            block("push from main")


def check(seg, cwd):
    seg = list(seg)
    while seg and (re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", seg[0]) or seg[0] in WRAPPERS):
        seg.pop(0)
    if not seg:
        return
    prog = os.path.basename(seg[0])
    if prog in SHELLS:
        for i, tok in enumerate(seg):
            if re.fullmatch(r"-[a-zA-Z]*c[a-zA-Z]*", tok) and i + 1 < len(seg):
                scan(seg[i + 1], cwd)
                return
        return
    if prog != "git":
        return
    args, i, directory = seg[1:], 0, cwd
    while i < len(args) and args[i].startswith("-"):
        if args[i] == "-C" and i + 1 < len(args):
            directory = os.path.join(cwd, args[i + 1])
            i += 2
        elif args[i] in GIT_OPTS_WITH_ARG:
            i += 2
        else:
            i += 1
    if i >= len(args):
        return
    sub, rest = args[i], args[i + 1 :]
    if sub == "reset" and "--hard" in rest:
        block("git reset --hard (discards uncommitted work)")
    if sub == "push":
        check_push(rest, directory)


def scan(cmd, cwd):
    try:
        for seg in segments(cmd):
            check(seg, cwd)
    except ValueError:
        # Unbalanced quotes (heredoc bodies with apostrophes): fall back to a plain text scan.
        if re.search(r"\bgit\b.*\bpush\b.*(--force|--mirror|--all|\s-\w*f\b|\s\+|:main\b|\bmain\b|\bmaster\b)", cmd, re.S):
            block("git push that looks like a force push or a push to main")
        if re.search(r"\bgit\b.*\breset\b.*--hard", cmd, re.S):
            block("git reset --hard")


def main():
    try:
        data = json.load(sys.stdin)
        cmd = data.get("tool_input", {}).get("command", "") or ""
        cwd = data.get("cwd") or os.getcwd()
    except Exception:
        block("hook input unreadable")
    scan(cmd, cwd)


main()
