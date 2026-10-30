#!/usr/bin/env bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo 'Please install Node.js 22+ from https://nodejs.org/ then run again.'
  exit 1
fi
node scripts/launcher.js
