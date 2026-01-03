#!/bin/bash
# =============================================================================
# Site Sync Tool - Sync code changes from Aqar (master) to other sites
# Usage: ./sync-sites.sh [target] [--dry-run]
#   target: alfahd, newcity, or all
#   --dry-run: Test without making changes
# =============================================================================

# Configuration
MASTER_SITE="/var/www/aqar.codenextai.com/aqar"
declare -A SITES=(
    ["alfahd"]="/var/www/alfahddevelopment.com/alfahd"
    ["newcity"]="/var/www/newcitydevelopment.net/newcity"
)

# Files/folders to EXCLUDE from sync (site-specific)
EXCLUDES=(
    ".env"
    "secure_data/"
    "public/uploads/"
    "node_modules/"
    "ecosystem.config.js"
    ".pm2/"
    "*.log"
    ".git/"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Build exclude arguments for rsync
build_excludes() {
    local excludes=""
    for item in "${EXCLUDES[@]}"; do
        excludes="$excludes --exclude=$item"
    done
    echo "$excludes"
}

# Sync function
sync_site() {
    local target_name=$1
    local target_path=$2
    local dry_run=$3
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}📁 Syncing: Aqar → $target_name${NC}"
    echo -e "${BLUE}   From: $MASTER_SITE${NC}"
    echo -e "${BLUE}   To:   $target_path${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    local excludes=$(build_excludes)
    local rsync_opts="-avz --delete --progress"
    
    if [ "$dry_run" = true ]; then
        rsync_opts="$rsync_opts --dry-run"
        echo -e "${YELLOW}⚠️  DRY RUN MODE - No changes will be made${NC}"
    fi
    
    # Run rsync
    eval rsync $rsync_opts $excludes "$MASTER_SITE/" "$target_path/"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Sync complete for $target_name${NC}"
        
        if [ "$dry_run" != true ]; then
            # Restart PM2 for the synced site
            echo -e "${YELLOW}🔄 Restarting $target_name PM2 processes...${NC}"
            pm2 restart $target_name
            echo -e "${GREEN}✅ $target_name restarted${NC}"
        fi
    else
        echo -e "${RED}❌ Sync failed for $target_name${NC}"
        return 1
    fi
}

# Show usage
show_usage() {
    echo -e "${BLUE}Site Sync Tool${NC}"
    echo ""
    echo "Usage: $0 [target] [options]"
    echo ""
    echo "Targets:"
    echo "  alfahd     Sync to Alfahd Development"
    echo "  newcity    Sync to NewCity Development"
    echo "  all        Sync to all sites"
    echo ""
    echo "Options:"
    echo "  --dry-run  Test sync without making changes"
    echo ""
    echo "Examples:"
    echo "  $0 alfahd              # Sync to Alfahd"
    echo "  $0 all --dry-run       # Test sync to all sites"
    echo "  $0 newcity             # Sync to NewCity"
}

# Main logic
main() {
    local target=$1
    local dry_run=false
    
    # Check for dry-run flag
    if [[ "$2" == "--dry-run" ]] || [[ "$1" == "--dry-run" ]]; then
        dry_run=true
        if [[ "$1" == "--dry-run" ]]; then
            target=$2
        fi
    fi
    
    # Validate master site exists
    if [ ! -d "$MASTER_SITE" ]; then
        echo -e "${RED}❌ Master site not found: $MASTER_SITE${NC}"
        exit 1
    fi
    
    case $target in
        alfahd)
            sync_site "alfahd" "${SITES[alfahd]}" $dry_run
            ;;
        newcity)
            sync_site "newcity" "${SITES[newcity]}" $dry_run
            ;;
        all)
            for site_name in "${!SITES[@]}"; do
                sync_site "$site_name" "${SITES[$site_name]}" $dry_run
                echo ""
            done
            ;;
        -h|--help|"")
            show_usage
            ;;
        *)
            echo -e "${RED}❌ Unknown target: $target${NC}"
            show_usage
            exit 1
            ;;
    esac
}

# Confirmation before sync (unless dry-run)
confirm_sync() {
    local target=$1
    local dry_run=$2
    
    if [ "$dry_run" = true ]; then
        main "$@"
        return
    fi
    
    echo -e "${YELLOW}⚠️  You are about to sync code from Aqar to: $target${NC}"
    echo -e "${YELLOW}   This will overwrite code files (not data or uploads).${NC}"
    read -p "Continue? (y/N): " confirm
    
    if [[ $confirm =~ ^[Yy]$ ]]; then
        main "$@"
    else
        echo "Cancelled."
    fi
}

# Run
confirm_sync "$@"
