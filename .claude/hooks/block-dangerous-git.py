#!/usr/bin/env python3
"""PreToolUse hook (Bash): block pushes to main/master, force pushes and `git reset --hard`.

Reads the hook JSON on stdin. Exit 2 blocks and sends the message to Claude. Unreadable input
blocks (fail closed). Commands are tokenised with shlex, so quoted text such as a commit message
is not mistaken for a command, and wrappers (sudo, env -u X, bash -c, eval, $(...), full paths,
-C dir) are seen through. A push whose target is built dynamically ($VAR, $(...), backticks) is
blocked because it cannot be resolved here.

This stops an agent's accidental or careless push. It is not a security boundary: a script file,
an alias, `python -c` or the GitHub API can still reach main. Enforce that with branch protection on main.
"""
import json
import os
import re
import shlex
import subprocess
import sys

PROTECTED = {"main", "master"}
WRAPPERS = {"sudo", "command", "env", "exec", "nohup", "time", "builtin", "nice", "xargs"}
SHELLS = {"bash", "sh", "zsh", "dash", "ksh"}
GIT_OPTS_WITH_ARG = {"-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"}


def block(why):
    print(f"BLOCKED: {why}. You do not have authority to run this; ask the user.", file=sys.stderr)
    sys.exit(2)


def segments(cmd, rewrite=True):
    if rewrite:
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


def command_index(seg):
    """Index of the real command: skip wrappers, VAR=x assignments, options and an option's argument."""
    after_opt = False
    for i, tok in enumerate(seg):
        is_opt = tok.startswith("-")
        if tok in WRAPPERS or re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", tok) or is_opt or after_opt:
            after_opt = is_opt and not after_opt
            continue
        return i
    return None


def check(seg, cwd):
    i = command_index(seg)
    if i is None:
        return
    prog, args = os.path.basename(seg[i]), seg[i + 1 :]
    if prog == "eval":
        scan(" ".join(args), cwd)
        return
    if prog in SHELLS:
        for j, tok in enumerate(args):
            if re.fullmatch(r"-[a-zA-Z]*c[a-zA-Z]*", tok) and j + 1 < len(args):
                scan(args[j + 1], cwd)
                return
        return
    if prog != "git":
        return
    j, directory = 0, cwd
    while j < len(args) and args[j].startswith("-"):
        if args[j] == "-C" and j + 1 < len(args):
            directory = os.path.join(cwd, args[j + 1])
            j += 2
        elif args[j] in GIT_OPTS_WITH_ARG:
            j += 2
        else:
            j += 1
    if j >= len(args):
        return
    sub, rest = args[j], args[j + 1 :]
    if sub == "reset" and "--hard" in rest:
        block("git reset --hard (discards uncommitted work)")
    if sub == "push":
        check_push(rest, directory)


def is_dynamic_push(seg):
    """A git push whose own words contain $VAR, $(...) or backticks: its target cannot be read here."""
    i = command_index(seg)
    if i is None or os.path.basename(seg[i]) != "git":
        return False
    args, j = seg[i + 1 :], 0
    while j < len(args) and args[j].startswith("-"):
        j += 2 if args[j] in GIT_OPTS_WITH_ARG | {"-C"} else 1
    return j < len(args) and args[j] == "push" and any("$" in t or "`" in t for t in args[j + 1 :])


def scan(cmd, cwd):
    try:
        if any(is_dynamic_push(seg) for seg in segments(cmd, rewrite=False)):
            block("push with a dynamic target ($VAR, $(...) or backticks)")
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
