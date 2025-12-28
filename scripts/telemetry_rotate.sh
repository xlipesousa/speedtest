#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/data/telemetry-log.jsonl"
ARCHIVE_DIR="${PROJECT_ROOT}/data/archive"
MAX_SIZE_BYTES=$((5 * 1024 * 1024)) # 5 MB
MAX_LINES=2000
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"

mkdir -p "${ARCHIVE_DIR}"

touch "${LOG_FILE}"

current_size=$(stat -c%s "${LOG_FILE}" 2>/dev/null || echo 0)
current_lines=$(wc -l < "${LOG_FILE}" 2>/dev/null || echo 0)

if (( current_size <= MAX_SIZE_BYTES && current_lines <= MAX_LINES )); then
  echo "Nenhuma ação necessária (tamanho: ${current_size} bytes, linhas: ${current_lines})."
  exit 0
fi

archive_file="${ARCHIVE_DIR}/telemetry-${TIMESTAMP}.jsonl"
cp "${LOG_FILE}" "${archive_file}"
: > "${LOG_FILE}"

echo "Arquivo de telemetria arquivado em ${archive_file}."
