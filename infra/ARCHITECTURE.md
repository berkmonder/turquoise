# Turquoise Infrastructure Architecture

## Overview

This infrastructure setup provides a complete IaC (Infrastructure as Code) solution for deploying the Turquoise Ecosystem. It combines:

- **Terraform** — for provisioning the VPS and configuring Dokploy
- **Dokploy** — for orchestrating containers, databases, and services
- **GitHub Actions** — for CI/CD automation
- **SSH deployment scripts** — for manual deployments

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              GITHUB REPOSITORY                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  .github/workflows/infra.yml                                          │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │  On push to main:                                               │ │  │
│  │  │    1. terraform apply                                           │ │  │
│  │  │    2. ./deploy.sh                                               │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        TERRAFORM (Infrastructure)                            │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  providers.tf  ───►  AWS / GCP / DigitalOcean / Azure                  │  │
│  │  main.tf         ───►  Provision VPS                                   │  │
│  │  variables.tf    ───►  Input variables                                  │  │
│  │  deploy.sh       ───►  SSH deployment script                           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                        │
│                                      ▼                                        │
┌──────────────────────────────────────────────────────────────────────────────┐
│                          DOKPLOY PLATFORM                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  Dokploy CLI (installed on VPS)                                       │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  │  Project: turquoise                                               │  │
│  │  │  ┌────────────────────────────────────────────────────────────┐  │
│  │  │  │  Services:                                                 │  │
│  │  │  │    • Backend API (FastAPI)     :8000                       │  │
│  │  │  │    • Frontend (React Native)   :8081                       │  │
│  │  │  │    • PostgreSQL              :5432                         │  │
│  │  │  │    • Redis                   :6379                         │  │
│  │  │  │    • Traefik (reverse proxy):80                            │  │
│  │  │  └────────────────────────────────────────────────────────────┘  │
│  │  └──────────────────────────────────────────────────────────────────┘  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          PUBLIC INTERNET                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  Frontend:    http://<VPS_IP>:8081                                     │  │
│  │  Dokploy UI:  http://<VPS_IP>:8080                                    │  │
│  │  Backend API: http://<VPS_IP>:8000/api/v1/models                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

| Component | Purpose | Technology |
|-----------|---------|-----------|
| **Terraform** | Provision VPS, install Dokploy | HashiCorp Terraform |
| **VPS** | Host for all services | AWS / GCP / DigitalOcean |
| **Dokploy** | Container orchestration | Dokploy Platform |
| **Backend** | FastAPI REST API | Python / FastAPI |
| **Frontend** | React Native Web app | React Native |
| **PostgreSQL** | Database | PostgreSQL 15 |
| **Redis** | Caching / sessions | Redis 7 |
| **Traefik** | Reverse proxy / TLS | Traefik 3 |

## Deployment Workflow

```
1. Developer pushes code to GitHub (main branch)
       │
       ▼
2. GitHub Actions triggers
       │
       ▼
3. Terraform applies infrastructure changes
       │
       ▼
4. ./deploy.sh runs on VPS via SSH
       │
       ▼
5. Docker images are built and pushed
       │
       ▼
6. Dokploy deploys new containers
       │
       ▼
7. Health checks pass → Traffic routed
       │
       ▼
8. Application is live
```

## Key Design Decisions

### Why Terraform + Dokploy?

- **Terraform** handles the "where" — provisioning the VPS, networking, and security groups
- **Dokploy** handles the "how" — orchestrating containers, managing databases, handling deployments
- **Separation of concerns** — infrastructure code is separate from application code

### Why not just Docker Compose?

- Docker Compose is great for development, but not for production
- Dokploy provides:
  - Automatic scaling
  - Health checks
  - Rolling deployments
  - Database management
  - SSL/TLS management
  - Monitoring and logging
  - Backup and restore

### Why not Kubernetes?

- Overkill for a small-to-medium application
- Dokploy provides Kubernetes-like capabilities with less operational overhead
- Easier to set up and maintain

## Security Considerations

1. **SSH Access** — Only allow SSH from trusted IP ranges
2. **Firewall** — Only expose necessary ports (80, 443, 8000, 8081)
3. **Secrets** — Use Dokploy secrets vault, not environment variables
4. **Database** — Use strong passwords, enable SSL
5. **HTTPS** — Use Traefik with Let's Encrypt for TLS termination

## Cost Considerations

| Resource | Estimated Cost (AWS) |
|----------|---------------------|
| t3.medium VPS | ~$25/month |
| PostgreSQL (Dokploy) | Included |
| Redis (Dokploy) | Included |
| Bandwidth | ~$10-50/month (varies) |
| **Total** | ~$35-75/month |

## Next Steps

1. **Deploy** — Run `terraform apply` and `./deploy.sh`
2. **Monitor** — Set up Prometheus + Grafana
3. **Scale** — Configure auto-scaling rules
4. **Backup** — Set up automated database backups
5. **CI/CD** — Connect to your CI provider
6. **SSL** — Set up Let's Encrypt certificates

## Cleanup

When you're done, remove the VPS and associated resources by running:

```bash
cd infra/terraform
terraform destroy
```
