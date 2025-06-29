#!/bin/bash

# 🚀 FOLDER2GITHUB - Automated Repository Creation Tool
# Based on successful procedures from kde-memory-guardian, rust-clipboard-suite, 
# linux-desktop-automation, memory-pressure-tools, system-management-tools, and enhanced-monitoring-api

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="/home/owner/Documents/6854a1da-e23c-8008-a9fc-76b7fa3c1f92"
TIMESTAMP=$(date +%s)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Usage function
usage() {
    cat << EOF
🚀 FOLDER2GITHUB - Automated Repository Creation Tool

Usage: $0 [OPTIONS] <source_folder> <repo_name> <description>

Arguments:
    source_folder    Source folder to copy files from
    repo_name        Name for the GitHub repository
    description      Repository description

Options:
    -h, --help       Show this help message
    -v, --verbose    Enable verbose output
    -d, --dry-run    Show what would be done without executing
    --no-verify      Skip verification steps
    --private        Create private repository (default: public)

Examples:
    $0 tools/monitoring enhanced-monitoring-api "Advanced monitoring APIs"
    $0 kde-tools kde-management-suite "KDE management tools" --private
    $0 scripts automation-scripts "System automation scripts" --dry-run

Based on successful procedures from:
✅ kde-memory-guardian
✅ rust-clipboard-suite  
✅ linux-desktop-automation
✅ memory-pressure-tools
✅ system-management-tools
✅ enhanced-monitoring-api
EOF
}

# Parse command line arguments
VERBOSE=false
DRY_RUN=false
NO_VERIFY=false
PRIVATE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-verify)
            NO_VERIFY=true
            shift
            ;;
        --private)
            PRIVATE=true
            shift
            ;;
        -*)
            error "Unknown option $1"
            usage
            exit 1
            ;;
        *)
            break
            ;;
    esac
done

# Check required arguments
if [[ $# -lt 3 ]]; then
    error "Missing required arguments"
    usage
    exit 1
fi

SOURCE_FOLDER="$1"
REPO_NAME="$2"
DESCRIPTION="$3"

# Validate inputs
if [[ ! -d "$SOURCE_FOLDER" ]]; then
    error "Source folder '$SOURCE_FOLDER' does not exist"
    exit 1
fi

if [[ ! "$REPO_NAME" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    error "Repository name contains invalid characters"
    exit 1
fi

# Main execution function
main() {
    log "🚀 Starting FOLDER2GITHUB automation"
    log "Source: $SOURCE_FOLDER"
    log "Repository: $REPO_NAME"
    log "Description: $DESCRIPTION"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        warning "DRY RUN MODE - No actual changes will be made"
    fi
    
    # Step 1: Create target directory
    TARGET_DIR="$BASE_DIR/$REPO_NAME"
    
    if [[ "$DRY_RUN" == "false" ]]; then
        log "📁 Creating target directory: $TARGET_DIR"
        mkdir -p "$TARGET_DIR"
    else
        info "Would create directory: $TARGET_DIR"
    fi
    
    # Step 2: Copy files with proper permissions
    if [[ "$DRY_RUN" == "false" ]]; then
        log "📋 Copying files from $SOURCE_FOLDER to $TARGET_DIR"
        cp -rp "$SOURCE_FOLDER"/* "$TARGET_DIR/" 2>/dev/null || true
        
        # Ensure shell scripts are executable
        find "$TARGET_DIR" -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true
    else
        info "Would copy files from $SOURCE_FOLDER to $TARGET_DIR"
        info "Would make shell scripts executable"
    fi
    
    # Step 3: Generate README.md
    if [[ "$DRY_RUN" == "false" ]]; then
        log "📝 Generating README.md"
        "$SCRIPT_DIR/generate_readme.py" "$TARGET_DIR" "$REPO_NAME" "$DESCRIPTION"
    else
        info "Would generate README.md"
    fi
    
    # Step 4: Create LICENSE
    if [[ "$DRY_RUN" == "false" ]]; then
        log "⚖️ Creating LICENSE file"
        "$SCRIPT_DIR/create_license.sh" "$TARGET_DIR"
    else
        info "Would create LICENSE file"
    fi
    
    # Step 5: Generate CI workflow
    if [[ "$DRY_RUN" == "false" ]]; then
        log "🔧 Generating CI workflow"
        "$SCRIPT_DIR/generate_ci.py" "$TARGET_DIR" "$REPO_NAME"
    else
        info "Would generate CI workflow"
    fi
    
    # Step 6: Initialize git repository
    if [[ "$DRY_RUN" == "false" ]]; then
        log "🔄 Initializing git repository"
        cd "$TARGET_DIR"
        git init
        git branch -m main
        git config user.name "swipswaps"
        git config user.email "swipswaps@users.noreply.github.com"
        git add .
        git commit -m "Initial commit: $REPO_NAME - $DESCRIPTION"
    else
        info "Would initialize git repository"
        info "Would commit files with message: Initial commit: $REPO_NAME - $DESCRIPTION"
    fi
    
    # Step 7: Create GitHub repository
    if [[ "$DRY_RUN" == "false" ]]; then
        log "🌐 Creating GitHub repository"
        cd "$TARGET_DIR"
        
        if [[ "$PRIVATE" == "true" ]]; then
            gh repo create "$REPO_NAME" --private --description "$DESCRIPTION" --source=.
        else
            gh repo create "$REPO_NAME" --public --description "$DESCRIPTION" --source=.
        fi
        
        git push -u origin main
    else
        info "Would create GitHub repository ($([ "$PRIVATE" == "true" ] && echo "private" || echo "public"))"
        info "Would push to GitHub"
    fi
    
    # Step 8: Verification
    if [[ "$NO_VERIFY" == "false" && "$DRY_RUN" == "false" ]]; then
        log "✅ Running verification"
        cd "$TARGET_DIR"
        
        # GitHub native verification
        log "🔧 GitHub native verification"
        gh repo view "swipswaps/$REPO_NAME" > /dev/null
        
        # Selenium verification
        log "🧪 Selenium verification"
        "$SCRIPT_DIR/verify_upload.py" "$REPO_NAME"
        
        log "🎉 Verification completed successfully!"
    else
        info "Skipping verification"
    fi
    
    log "✅ FOLDER2GITHUB completed successfully!"
    log "🔗 Repository URL: https://github.com/swipswaps/$REPO_NAME"
}

# Error handling
trap 'error "Script failed at line $LINENO"' ERR

# Execute main function
main "$@"
