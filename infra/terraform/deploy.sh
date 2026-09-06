#!/bin/bash
set -e

# =============================================================================
# Turquoise VPS Deployment Script
# Run this AFTER `terraform apply` to deploy the application to the VPS
# =============================================================================

VPS_HOST="${1:-$(terraform output -raw vps_public_ip)}"
VPS_USER="${2:-ubuntu}"
VPS_PORT="${3:-22}"
SSH_KEY="${4:-~/.ssh/id_rsa}"

echo "=== Turquoise Deployment to $VPS_HOST:$VPS_PORT ==="
echo "User: $VPS_USER | Key: $SSH_KEY"
echo ""

# 1. Clone the repository
echo "[1/5] Cloning repository..."
ssh -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << 'SSHSCRIPT'
  cd ~
  if [ -d "turquoise" ]; then
    cd turquoise
    git fetch origin main
    git reset --hard origin/main
  else
    git clone https://github.com/berkmonder/turquoise.git
    cd turquoise
  fi
  echo "Repository cloned/updated"
SSHSCRIPT

# 2. Install dependencies
echo "[2/5] Installing dependencies..."
ssh -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << 'SSHSCRIPT'
  cd /home/ubuntu/turquoise
  sudo apt-get update
  sudo apt-get install -y docker.io docker-compose curl jq
SSHSCRIPT

# 3. Configure Dokploy
echo "[3/5] Configuring Dokploy..."
ssh -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << 'SSHSCRIPT'
  export DOKPLOY_URL="http://localhost:8080"
  export DOKPLOY_KEY="turquoise"
  export DOKPLOY_PROJECT="turquoise"
  dokploy login
SSHSCRIPT

# 4. Build and deploy
echo "[4/5] Building and deploying..."
ssh -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << 'SSHSCRIPT'
  cd /home/ubuntu/turquoise
  docker-compose build
  docker-compose up -d
  sleep 10
  docker-compose ps
SSHSCRIPT

# 5. Verify deployment
echo "[5/5] Verifying deployment..."
ssh -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << 'SSHSCRIPT'
  echo "=== Service Status ==="
  docker-compose ps
SSHSCRIPT

echo ""
echo "=== Deployment Complete ==="
echo "VPS: $VPS_HOST:$VPS_PORT"
echo "User: $VPS_USER"
echo ""
echo "Next steps:"
echo "  1. SSH into the VPS: ssh -p $VPS_PORT $VPS_USER@$VPS_HOST"
echo "  2. Open Dokploy UI: http://$VPS_HOST:8080"
echo "  3. Configure the project in Dokploy UI"
echo "  4. Push code changes: git push origin main"
