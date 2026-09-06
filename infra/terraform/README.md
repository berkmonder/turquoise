# Turquoise Infrastructure as Code

Terraform configuration for managing the Turquoise Ecosystem infrastructure.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Terraform (Infrastructure)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  VPS (AWS/GCP/DigitalOcean)                                │  │
│  │  ┌───────────────────────────────────────────────────────┐│  │
│  │  │  Dokploy (Orchestrator)                               ││  │
│  │  │  ┌─────────────────┐  ┌─────────────────────────────┐││  │
│  │  │  │  Backend API    │  │  Frontend (React Native)   │││  │
│  │  │  │  :8000          │  │  :8081                      │││  │
│  │  │  └─────────────────┘  └─────────────────────────────┘││  │
│  │  │  ┌───────────────────────────────────────────────────┐│  │
│  │  │  │  Postgres DB (Dokploy managed)                     ││  │
│  │  │  └───────────────────────────────────────────────────┘│  │
│  │  │  ┌───────────────────────────────────────────────────┐│  │
│  │  │  │  Redis Cache (Dokploy managed)                    ││  │
│  │  │  └───────────────────────────────────────────────────┘│  │
│  │  └─────────────────────────────────────────────────────────┘  │
│  └─────────────────────────────────────────────────────────────────┘
│
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Dokploy CLI (Terraform-managed)                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  SSH Deployment Script (deploy.sh)                        │  │
│  │  └──> Clones repo → Builds → Deploys via Dokploy          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Configure Variables

Edit `terraform.tfvars` with your cloud provider settings:

```bash
# For AWS
cloud_provider = "aws"
aws_region     = "us-east-1"
aws_instance_type = "t3.medium"

# OR for DigitalOcean
cloud_provider = "digitalocean"
digitalocean_token = "your-do-token"
digitalocean_region = "nyc3"
digitalocean_size = "s-2vcpu-2gb"
```

### 2. Initialize Terraform

```bash
cd infra/terraform
terraform init
```

### 3. Apply Infrastructure

```bash
terraform apply
```

### 4. Deploy Application

```bash
cd ../..
./infra/terraform/deploy.sh
```

### 5. Deploy on Code Push (Future)

```bash
# Create a GitHub Action workflow that runs:
#   terraform apply
#   ./deploy.sh
```

## Directory Structure

```
infra/
├── terraform/
│   ├── main.tf           # Main Terraform logic
│   ├── variables.tf      # Input variables
│   ├── providers.tf      # Provider configuration
│   ├── terraform.tfvars  # User-configured variables
│   ├── dokploy.tfvars    # Dokploy-specific settings
│   ├── deploy.sh         # SSH deployment script
│   └── README.md         # This file
└── .gitignore
```

## Cloud Provider Options

| Provider | Config |
|----------|--------|
| AWS | Set `cloud_provider = "aws"` + `aws_region` + `aws_instance_type` |
| GCP | Set `cloud_provider = "gcp"` + `gcp_project_id` + `gcp_region` |
| DigitalOcean | Set `cloud_provider = "digitalocean"` + `digitalocean_token` |
| Azure | Set `cloud_provider = "azure"` + ARM credentials via env vars |

## Secrets Management

Sensitive values (API keys, database passwords) should be stored in:

- Terraform state (encrypted with AWS KMS, GCP KMS, or HashiCorp Vault)
- Dokploy secrets (via `dokploy secret create`)
- Environment variables in Dokploy project settings

## Cleanup

Remove the VPS and associated resources:

```bash
terraform destroy
```
