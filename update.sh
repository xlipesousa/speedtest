#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -d "${SCRIPT_DIR}/.git" ]]; then
  echo "No git repository found. Initialize the repo before updating." >&2
  exit 1
fi

current_branch="$(git -C "${SCRIPT_DIR}" rev-parse --abbrev-ref HEAD)"

git -C "${SCRIPT_DIR}" fetch origin

git -C "${SCRIPT_DIR}" pull --ff-only origin "${current_branch}"

echo "Repository updated on branch ${current_branch}."
