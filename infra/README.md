# Turquoise Infrastructure

This directory contains the infrastructure-as-code configuration for the Turquoise Ecosystem.

## Overview

The infrastructure is split into two layers:

### Layer 1: Terraform (Infrastructure)
- Provisions the VPS on your preferred cloud provider
- Installs and configures Dokploy CLI
- Sets up the Dokploy project and environment

### Layer 2: Dokploy (Orchestration)
- Manages the runtime environment (containers, networks, volumes)
- Handles deployments, scaling, and monitoring
- Provides the UI for managing services

## Quick Start

```bash
# 1. Configure Terraform variables
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
# Edit terraform.tfvars with your cloud provider settings

# 2. Initialize Terraform
cd infra/terraform
terraform init

# 3. Apply infrastructure
terraform apply

# 4. Deploy the application
cd ../..
./infra/terraform/deploy.sh
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Terraform (Infrastructure as Code)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Cloud Provider (AWS / GCP / DO)                           │  │
│  │  ┌───────────────────────────────────────────────────────┐│  │
│  │  │  VPS Instance                                        ││  │
│  │  │  ┌───────────────────────────────────────────────────┐│  │
│  │  │  │  Dokploy Platform (Managed by Terraform)          ││  │
│  │  │  │  ┌───────────────────────────────────────────────┐││  │
│  │  │  │  │  Services (managed by Dokploy):               │││  │
│  │  │  │  │  • Backend API (FastAPI)                     │││  │
│  │  │  │  │  • Frontend (React Native Web)              │││  │
│  │  │  │  │  • PostgreSQL Database                      │││  │
│  │  │  │  │  • Redis Cache                              │││  │
│  │  │  │  │  • Traefik (reverse proxy)                  │││  │
│  │  │  │  └───────────────────────────────────────────────┘││  │
│  │  │  └───────────────────────────────────────────────────┘│  │
│  │  └───────────────────────────────────────────────────────────┘  │
│  └─────────────────────────────────────────────────────────────────┘
│
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  GitHub Actions CI/CD                                    │  │
│  │  ┌───────────────────────────────────────────────────────┐│  │
│  │  │  On push to main:                                     ││  │
│  │  │  1. terraform apply                                   ││  │
│  │  │  2. ./deploy.sh                                       ││  │
│  │  │  3. Dokploy deployment                                ││  │
│  │  └───────────────────────────────────────────────────────┘│  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Cloud Provider Selection

### AWS
```bash
# terraform.tfvars
cloud_provider = "aws"
aws_region     = "us-east-1"
aws_instance_type = "t3.medium"
```

### DigitalOcean
```bash
# terraform.tfvars
cloud_provider = "digitalocean"
digitalocean_token = "your-do-token-here"
digitalocean_region = "nyc3"
digitalocean_size = "s-2vcpu-2gb"
```

### GCP
```bash
# terraform.tfvars
cloud_provider = "gcp"
gcp_project_id = "your-project-id"
gcp_region = "us-central1"
```

## Workflow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Git Push   │────▶│  GitHub      │────▶│  Terraform   │
│  (main)     │     │  Actions     │     │  Apply       │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                               │
                                               ▼
┌───────────────────────────────────────────────────────────┐
│                   Dokploy Deploy                           │
│  ┌──────────────────────────────────────────────────────┐│
│  │  1. Build Docker images                              ││
│  │  2. Push to Docker Hub                               ││
│  │  3. Deploy to Dokploy cluster                        ││
│  │  4. Health check & verification                       ││
│  └──────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────┘
```

## Secrets Management

Store sensitive values in:
- **GitHub Secrets** → passed to GitHub Actions
- **Dokploy Secrets** → via `dokploy secret create`
- **Terraform S3 Backend** → encrypted state storage

## Cleanup

To remove all infrastructure:

```bash
cd infra/terraform
terraform destroy
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `terraform init` fails | Check AWS/GCP/DO credentials |
| `deploy.sh` fails | Ensure Dokploy CLI is installed |
| Services won't start | Check Dokploy UI for errors |
| Database connection fails | Verify `DOKPLOY_DB_URL` is set |
| CORS errors | Check `FRONTEND_URL` in backend |

## Next Steps

1. **Add monitoring** (Prometheus + Grafana via Dokploy)
2. **Add logging** (Loki / ELK stack)
3. **Add CI/CD** (GitHub Actions → Terraform → Dokploy)
4. **Add secrets** (Dokploy secrets vault)
5. **Add autoscaling** (Dokploy auto-scaling rules)
EOF