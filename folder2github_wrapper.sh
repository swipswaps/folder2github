#!/bin/bash
# 🛡️ FOLDER2GITHUB SAFETY WRAPPER
# Automatically uses safe mode by default
# Created: 2025-06-29T17:21:36.889994

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAFE_SCRIPT="$SCRIPT_DIR/folder2github_safe.sh"

# Check if user explicitly wants unsafe mode
if [[ "$1" == "--unsafe" ]]; then
    shift
    echo "⚠️  WARNING: Using unsafe mode - data loss possible!"
    exec "$SCRIPT_DIR/folder2github.sh" "$@"
else
    echo "🛡️  Using safe mode (use --unsafe to override)"
    exec "$SAFE_SCRIPT" "$@"
fi
