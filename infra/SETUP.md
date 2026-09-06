# Infrastructure Setup Guide

This guide walks you through setting up the Turquoise Ecosystem infrastructure using Terraform + Dokploy.

## Prerequisites

- [Terraform](https://www.terraform.io/downloads) 1.0+
- [Dokploy CLI](https://github.com/dokploy/dokploy-cli)
- Docker and Docker Compose installed
- A GitHub account (for CI/CD)
- A cloud provider account (AWS, GCP, or DigitalOcean)

## Step 1: Clone the Repository

```bash
git clone https://github.com/berkmonder/turquoise.git
cd turquoise
```

## Step 2: Configure Terraform

```bash
cd infra/terraform

# Copy the example config
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars
nano terraform.tfvars
```

Fill in your cloud provider credentials. For DigitalOcean, you need an API token:

```bash
# Get your DO token
curl https://cloud.digitalocean.com/v1/account | jq '.token'
```

## Step 3: Initialize Terraform

```bash
terraform init
```

This downloads the required providers and creates the `.terraform` directory.

## Step 4: Apply Infrastructure

```bash
terraform apply
```

This will:
1. Provision a VPS on your chosen cloud provider
2. Install Dokploy CLI on the VPS
3. Configure the Dokploy project
4. Set up SSH access

## Step 5: Deploy the Application

```bash
cd ..
./infra/terraform/deploy.sh
```

This script will:
1. Clone the repository to the VPS
2. Install Docker and Docker Compose
3. Build and deploy the application via Dokploy

## Step 6: Access the Application

Once deployment is complete, you can access the application at:

```
http://<VPS_PUBLIC_IP>:8081
```

The Dokploy UI is available at:

```
http://<VPS_PUBLIC_IP>:8080
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  GitHub (Code Repository)                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  .github/workflows/infra.yml                              │  │
│  │  ┌───────────────────────────────────────────────────────┐│  │
│  │  │  On push to main:                                     ││  │
│  │  │  1. terraform apply                                   ││  │
│  │  │  2. ./deploy.sh                                       ││  │
│  │  │  3. Dokploy deployment                                ││  │
│  │  └───────────────────────────────────────────────────────┘│  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Terraform (Infrastructure)                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Provision VPS on AWS/GCP/DigitalOcean                     │  │
│  │  Install Dokploy CLI                                      │  │
│  │  Configure Dokploy project                                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Dokploy (Orchestration)                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Services:                                                 │  │
│  │  • Backend API (FastAPI) :8000                            │  │
│  │  • Frontend (React)   :8081                               │  │
│  │  • PostgreSQL        :5432                               │  │
│  │  • Redis             :6379                               │  │
│  │  • Traefik (reverse proxy) :80                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Common Issues

### Issue: `terraform init` fails

**Solution:** Check your cloud provider credentials are correctly set in `terraform.tfvars`.

### Issue: `deploy.sh` fails with "Dokploy CLI not found"

**Solution:** Ensure the VPS was successfully provisioned and Dokploy was installed. Check the Terraform output.

### Issue: Services won't start

**Solution:** Check the Dokploy UI at `http://<VPS_IP>:8080` for error messages. Common issues:
- Database not accessible (check firewall rules)
- Port conflicts (ensure ports 8000, 8081, 5432, 6379 are open)
- Incorrect environment variables

### Issue: CORS errors

**Solution:** The backend's `FRONTEND_URL` environment variable must match the frontend's actual URL. Update in Dokploy settings.

## Next Steps

1. **Monitor:** Set up monitoring with Prometheus + Grafana
2. **Scale:** Configure auto-scaling rules in Dokploy
3. **Backup:** Set up database backups via Dokploy
4. **CI/CD:** Connect to your CI provider (GitHub Actions, GitLab CI, etc.)
5. **Security:** Add a reverse proxy (Nginx) with SSL/TLS

## Cleanup

When you're done:

```bash
cd infra/terraform
terraform destroy
```

This will remove the VPS and all associated resources.
