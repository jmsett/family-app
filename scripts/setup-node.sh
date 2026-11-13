#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
  echo 'Install Node.js 24 for your platform, then use npm ci.' >&2
  exit 1
fi
version=v24.22.3
archive="node-${version}-linux-x64.tar.xz"
checksum=4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb
mkdir -p .tools
if [[ -x .tools/node/bin/node ]]; then
  .tools/node/bin/node --version
  exit 0
fi
download_dir=$(mktemp -d)
trap 'rm -rf "$download_dir"' EXIT
curl -fsSL "https://nodejs.org/dist/${version}/${archive}" -o "$download_dir/$archive"
(cd "$download_dir" && echo "$checksum  $archive" | sha256sum -c -)
tar -xJf "$download_dir/$archive" -C .tools
ln -s "node-${version}-linux-x64" .tools/node
echo 'Ready. Run: export PATH="$PWD/.tools/node/bin:$PATH"'
