#!/usr/bin/env bash
# The day's change log from merged pull requests: number, merged time (MST), title, reviewer state.
# demo/evidence/changes.sh > demo/evidence/CHANGES.md
set -euo pipefail
echo "# Changes merged on $(TZ=America/Denver date +%F) (America/Denver)"
echo
echo "| PR | Merged | Title | Gitar |"
echo "| --- | --- | --- | --- |"
gh pr list --repo aethyrai/kubecon-pq-agent --state merged --limit 100 --json number,title,mergedAt,url \
  --jq 'sort_by(.mergedAt) | .[] | [.number, .mergedAt, .title, .url] | @tsv' \
| while IFS=$'\t' read -r n at title url; do
    local_t=$(TZ=America/Denver date -d "$at" +%H:%M)
    g=$(gh pr checks "$n" --repo aethyrai/kubecon-pq-agent 2>/dev/null </dev/null | awk -F'\t' '$1=="Gitar"{print $2}' | head -1)
    echo "| [#$n]($url) | $local_t | $title | ${g:-n/a} |"
  done
