#!/usr/bin/env bash
# PreToolUse hook (Bash). Blocks: git push to main, any force push, git reset --hard.
# Plain pushes to other branches (development) pass. Exit 2 = blocked, message goes to Claude.
CMD=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)
block() { echo "BLOCKED: $1. You do not have authority to run this; ask the user." >&2; exit 2; }

# split on ; && || | newlines so "cd x && git push -f" is still seen
while IFS= read -r part; do
  [[ "$part" =~ (^|[[:space:]])git([[:space:]]+-[^[:space:]]+)*[[:space:]]+reset([[:space:]].*)?[[:space:]]--hard ]] && block "git reset --hard (discards uncommitted work)"
  if [[ "$part" =~ (^|[[:space:]])git([[:space:]]+-[^[:space:]]+)*[[:space:]]+push([[:space:]]|$) ]]; then
    [[ "$part" =~ [[:space:]](-f|--force|--force-with-lease|--force-if-includes)([[:space:]=]|$) || "$part" =~ [[:space:]]-[a-zA-Z]*f[a-zA-Z]*([[:space:]]|$) ]] && block "force push"
    [[ "$part" =~ [[:space:]:](main|master)([[:space:]]|$) || "$part" =~ refs/heads/(main|master) ]] && block "push to main"
    # bare `git push` while on main
    if ! [[ "$part" =~ push[[:space:]]+[^-[:space:]] ]]; then
      [ "$(git branch --show-current 2>/dev/null)" = "main" ] && block "push from main"
    fi
  fi
done < <(printf '%s\n' "$CMD" | sed -E 's/(&&|\|\||;|\|)/\n/g')
exit 0
