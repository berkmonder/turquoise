#!/bin/bash
# ============================================================================
# Dokploy Configuration Export Script
# ============================================================================
# Run this on your VPS to extract all Dokploy configuration and convert it
# to Terraform-compatible format.
#
# Usage: ./export-dokploy-config.sh [--project-key YOUR_KEY]
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_KEY="${PROJECT_KEY:-turquoise}"
OUTPUT_DIR="$SCRIPT_DIR/../terraform/exports"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Dokploy Configuration Export ===${NC}"
echo "Project Key: $PROJECT_KEY"
echo "Output:      $OUTPUT_DIR"
echo ""

# Check if Dokploy CLI is installed
if ! command -v dokploy &> /dev/null; then
    echo -e "${RED}ERROR: Dokploy CLI not found.${NC}"
    echo "Install it with: curl -fsSL https://get.dokploy.com | bash"
    exit 1
fi

# Check if we're connected to the Dokploy API
echo -e "${YELLOW}Checking Dokploy connection...${NC}"
if dokploy status &> /dev/null; then
    echo -e "${GREEN}✓ Connected to Dokploy${NC}"
else
    echo -e "${RED}✗ Cannot connect to Dokploy API${NC}"
    echo "  Make sure the Dokploy server is running and accessible."
    echo "  Try: dokploy login"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo ""
echo -e "${YELLOW}Exporting configuration...${NC}"
echo ""

# --- 1. Project Info ---
echo -e "${BLUE}[1/6] Project Information${NC}"
dokploy project info --project-key="$PROJECT_KEY" > "$OUTPUT_DIR/project-info.json" 2>/dev/null || \
    dokploy project info --key="$PROJECT_KEY" > "$OUTPUT_DIR/project-info.json" 2>/dev/null || \
    { echo "  (project info not available)"; touch "$OUTPUT_DIR/project-info.json"; }

# --- 2. Services ---
echo -e "${BLUE}[2/6] Services${NC}"
dokploy service list --project-key="$PROJECT_KEY" --format=json > "$OUTPUT_DIR/services.json" 2>/dev/null || \
    dokploy service list --key="$PROJECT_KEY" --format=json > "$OUTPUT_DIR/services.json" 2>/dev/null || \
    { echo "  (services not available)"; touch "$OUTPUT_DIR/services.json"; }

# --- 3. Environment Variables ---
echo -e "${BLUE}[3/6] Environment Variables${NC}"
dokploy environment list --project-key="$PROJECT_KEY" --format=json > "$OUTPUT_DIR/env-vars.json" 2>/dev/null || \
    dokploy environment list --key="$PROJECT_KEY" --format=json > "$OUTPUT_DIR/env-vars.json" 2>/dev/null || \
    { echo "  (env vars not available)"; touch "$OUTPUT_DIR/env-vars.json"; }

# --- 4. Secrets ---
echo -e "${BLUE}[4/6] Secrets${NC}"
dokploy secret list --project-key="$PROJECT_KEY" --format=json > "$OUTPUT_DIR/secrets.json" 2>/dev/null || \
    dokploy secret list --key="$PROJECT_KEY" --format=json > "$OUTPUT_DIR/secrets.json" 2>/dev/null || \
    { echo "  (secrets not available)"; touch "$OUTPUT_DIR/secrets.json"; }

# --- 5. Databases ---
echo -e "${BLUE}[5/6] Databases${NC}"
dokploy database list --project-key="$PROJECT_KEY" --format=json > "$OUTPUT_DIR/databases.json" 2>/dev/null || \
    dokploy database list --key="$PROJECT_KEY" --format=json > "$OUTPUT_DIR/databases.json" 2>/dev/null || \
    { echo "  (databases not available)"; touch "$OUTPUT_DIR/databases.json"; }

# --- 6. Domains / Traefik ---
echo -e "${BLUE}[6/6] Domains / Traefik${NC}"
dokploy domain list --project-key="$PROJECT_KEY" --format=json > "$OUTPUT_DIR/domains.json" 2>/dev/null || \
    dokploy domain list --key="$PROJECT_KEY" --format=json > "$OUTPUT_DIR/domains.json" 2>/dev/null || \
    { echo "  (domains not available)"; touch "$OUTPUT_DIR/domains.json"; }

# --- 7. VPS Info ---
echo -e "${BLUE}[7/7] VPS Information${NC}"
dokploy vps list --format=json > "$OUTPUT_DIR/vps.json" 2>/dev/null || \
    { echo "  (VPS info not available)"; touch "$OUTPUT_DIR/vps.json"; }

# --- Generate Terraform-compatible files ---
echo ""
echo -e "${BLUE}Generating Terraform files...${NC}"

# Generate .env file from environment variables
echo "  - .env"
if [ -f "$OUTPUT_DIR/env-vars.json" ]; then
    cat > "$OUTPUT_DIR/.env" << 'ENVEOF'
# Environment Variables (generated from Dokploy)
# Run: cat infra/terraform/exports/.env >> .env
ENVEOF
    # Parse JSON and add to .env
    jq -r '.[] | "EXPO_PUBLIC_API_BASE=\(.value)"' "$OUTPUT_DIR/env-vars.json" 2>/dev/null >> "$OUTPUT_DIR/.env" || true
fi

# Generate secrets.tfvars
echo "  - secrets.tfvars"
cat > "$OUTPUT_DIR/secrets.tfvars" << 'EOF'
# Secrets (generated from Dokploy)
# Run: terraform apply -var-file="infra/terraform/exports/secrets.tfvars"
EOF
if [ -f "$OUTPUT_DIR/secrets.json" ]; then
    jq -r '.[] | "SECRET_" + .name + "=\"\(.value)\""' "$OUTPUT_DIR/secrets.json" 2>/dev/null >> "$OUTPUT_DIR/secrets.tfvars" || true
fi

# Generate terraform.tfvars from VPS info
echo "  - terraform.tfvars (VPS config)"
if [ -f "$OUTPUT_DIR/vps.json" ]; then
    jq -r '.[] | "cloud_provider = \"" + .provider + "\"" + "\naws_region = \"" + .region + "\"" + "\naws_instance_type = \"" + .instance_type + "\"" + "\naws_instance_size = \"" + .size + "\"" + "\ndigitalocean_token = \"" + .token + "\"" + "\ndigitalocean_region = \"" + .region + "\"" + "\ndigitalocean_size = \"" + .size + "\"" + "\ngcp_project_id = \"" + .project_id + "\"" + "\ngcp_region = \"" + .region + "\"" + "\ngcp_machine_type = \"" + .machine_type + "\"" > "$OUTPUT_DIR/terraform.tfvars" 2>/dev/null || true
else
    touch "$OUTPUT_DIR/terraform.tfvars"
fi

# --- Summary ---
echo ""
echo -e "${GREEN}=== Export Complete ===${NC}"
echo ""
echo "Files created in: $OUTPUT_DIR"
echo ""
ls -la "$OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "  1. Copy files to your local terraform directory:"
echo "     cp -r $OUTPUT_DIR/* infra/terraform/"
echo ""
echo "  2. Review and edit the generated files"
echo "  3. Run: terraform apply -var-file=\"infra/terraform/exports/terraform.tfvars\""
echo ""
echo -e "${YELLOW}Tip: If you want to save this as a permanent Terraform state, consider using a remote backend (S3, GCS, Azure Blob).${NC}"
