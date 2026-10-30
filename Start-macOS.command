#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo 'Please install Node.js 22+ from https://nodejs.org/ then run again.'
  read -r -p 'Press Enter to close…'
  exit 1
fi
node scripts/launcher.js
arena_exit=$?
if [ "$arena_exit" -ne 0 ]; then read -r -p 'Press Enter to close…'; fi
exit "$arena_exit"
