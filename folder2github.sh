#!/bin/bash
# 🛡️ FOLDER2GITHUB - SAFE BY DEFAULT
# Enhanced version with data loss prevention
# Original backed up as: folder2github.sh.backup_20250629_172136
# Created: 2025-06-29T17:21:36.914495

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAFE_SCRIPT="$SCRIPT_DIR/folder2github_safe.sh"

# Check if safe script exists
if [[ ! -f "$SAFE_SCRIPT" ]]; then
    echo "❌ ERROR: Safe script not found at $SAFE_SCRIPT"
    echo "💡 Please ensure folder2github_safe.sh is in the same directory"
    exit 1
fi

# Add safety notice
echo "🛡️  FOLDER2GITHUB - SAFE MODE ENABLED"
echo "📋 This version prevents data loss by checking for existing files"
echo "💡 Use folder2github_unsafe.sh if you need the original behavior"
echo ""

# Execute safe script with all arguments
exec "$SAFE_SCRIPT" "$@"
