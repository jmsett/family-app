#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$project_dir"

if [[ ! -x "$project_dir/.tools/node/bin/node" ]]; then
  bash "$project_dir/scripts/setup-node.sh"
fi

export PATH="$project_dir/.tools/node/bin:$PATH"
exec npm "$@"
