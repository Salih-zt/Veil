#!/usr/bin/env bash
# VEIL Protocol — One-Click Launcher for macOS / Linux / WSL

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "========================================================================"
echo "  VEIL PROTOCOL — ONE-CLICK LAUNCHER (BASH / UNIX)"
echo "========================================================================"

node scripts/launch.mjs
