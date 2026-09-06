# Turquoise Ecosystem — Infrastructure & DevOps Report

## Executive Summary

The Turquoise Ecosystem uses a **Terraform + Dokploy** infrastructure pattern:
- **Terraform** provisions a VPS (AWS/GCP/DO/Azure) and configures Dokploy
- **Dokploy** orchestrates containers (Backend API, Frontend, PostgreSQL, Redis)
- **GitHub Actions** trigger deployments on `main` branch pushes

**Current state:** The infrastructure is functional but lacks production hardening (no remote state, no security scanning, no rollback mechanism).

---

## 1. Dockerfile Analysis

### Backend (`backend/Dockerfile`)

```dockerfile
FROM python:3.11-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV UV_PROJECT_ENVIRONMENT="/opt/venv"
ENV PATH="/opt/venv/bin:$PATH"
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev
COPY . .
RUN uv sync --frozen --no-dev
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

| Aspect | Status | Notes |
|--------|--------|-------|
| Base image | ✅ `python:3.11-slim` (tiny) | Correct choice |
| Multi-stage | ✅ Uses `uv` from scratch image | Reduces image size |
| Dependencies | ✅ `uv sync --frozen` | Lockfile-based, reproducible |
| Non-root user | ❌ Runs as root | **Security risk** |
| Health check | ❌ No `HEALTHCHECK` | Docker Compose won't auto-restart |
| Read-only root | ❌ Not enforced | Container is writable |
| Pre-warming | ❌ No model warmup | ONNX models load on first request |
| Secrets | ❌ No secrets management | Env vars in image layers |

### Frontend (`frontend/app.json`)

```json
{
  "name": "turquoise-frontend",
  "slug": "turquoise-frontend",
  "version": "1.0.0",
  "orientation": "portrait",
  "icon": "./assets/icon.png",
  "userInterfaceStyle": "dark",
  "assetBundlePatterns": ["**/*"],
  "ios": { "supportsTablet": true },
  "web": { "favicon": "./assets/favicon.png" }
}
```

**Notes:** Uses Expo EAS build. The frontend is a **React Native Web** app bundled as a static SPA.

---

## 2. Docker Compose Analysis

```yaml
services:
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    expose:
      - "8000"
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      - FRONTEND_URL=${FRONTEND_URL}
      - MODEL_DIR=/app/models
    volumes:
      - model_storage:/app/models
    depends_on:
      - db

volumes:
  postgres_data:
  model_storage:
```

| Aspect | Status | Notes |
|--------|--------|-------|
| Service discovery | ✅ Docker network | `db:5432` works via internal DNS |
| Volume persistence | ✅ Named volumes | `postgres_data`, `model_storage` |
| Health checks | ❌ None | Services can crash silently |
| Restart policy | ✅ `restart: always` | Basic resilience |
| Resource limits | ❌ None | No CPU/memory limits |
| Logging | ❌ None | No log aggregation |
| Secrets | ❌ Plain env vars | Passwords in compose file |
| Redis | ❌ Missing | Documented but not deployed |
| Traefik | ❌ Missing | No reverse proxy / TLS termination |

---

## 3. Terraform IaC Analysis

### Providers

```hcl
terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
    google = { source = "hashicorp/google", version = "~> 5.0" }
    digitalocean = { source = "digitalocean/digitalocean", version = "~> 2.30" }
    azure = { source = "hashicorp/azurerm", version = "~> 3.0" }
    local = { source = "hashicorp/local", version = "~> 2.0" }
    ssh = { source = "vultraz/ssh", version = "~> 0.1" }
    null = { source = "hashicorp/null", version = "~> 3.0" }
  }
}
```

**Status:** ✅ Well-chosen providers. Local provider for SSH config generation is a nice touch.

### VPS Provisioning

- **AWS:** Uses Amazon Linux 2 AMI, `t3.medium` (2 vCPU, 4GB RAM), gp3 volume
- **GCP:** Debian 11, `e2-medium`
- **DigitalOcean:** Ubuntu 22.04, `s-2vcpu-2gb`

**Issues identified:**
1. **No remote state backend** — state is local → single point of failure
2. **No `terraform plan` in CI** — no preview before apply
3. **No approval gate** — `-auto-approve` bypasses human review
4. **No `terraform validate` / `fmt`** — no pre-commit linting
5. **No security group rules** — all ports potentially open
6. **No autoscaling group** — single VPS = single point of failure

### Deploy Script (`deploy.sh`)

```bash
#!/bin/bash
ssh -p 22 ubuntu@<VPS_IP> << 'SSHSCRIPT'
  cd /home/ubuntu/turquoise
  sudo apt-get update
  sudo apt-get install -y docker.io docker-compose
  curl -fsSL https://get.dokploy.com | bash
  ./infra/scripts/export-dokploy-config.sh
  docker-compose build
  docker-compose up -d
  docker-compose ps
SSHSCRIPT
```

**Issues:**
- No rollback on failure
- No health check verification
- No idempotency (re-running overwrites state)
- No cleanup of old containers

---

## 4. CI/CD (GitHub Actions) Analysis

### `infra.yml`

```yaml
name: Infrastructure
on:
  push:
    branches: [main]
jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - uses: aws-actions/configure-aws-credentials@v4
      - run: cd infra/terraform && terraform init
      - run: cd infra/terraform && terraform validate
      - run: cd infra/terraform && terraform apply -auto-approve
      - run: ./infra/terraform/deploy.sh
```

**Critical gaps:**
- ❌ No `terraform plan` output (no preview)
- ❌ No approval step (dangerous for production)
- ❌ No security scanning (no `tfsec`, `checkov`, `tflint`)
- ❌ No dependency scanning (no `snyk`, `trivy`)
- ❌ No branch protection (anyone can push to main)
- ❌ No PR review requirement

### `dokploy.yml`

```yaml
name: Dokploy Deploy
on:
  push:
    branches: [main]
jobs:
  dokploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dokploy/dokploy-cli-action@v1
        with:
          api-url: ${{ secrets.DOKPLOY_API_URL }}
          api-key: ${{ secrets.DOKPLOY_API_KEY }}
          project-key: turquoise
          command: "project:deploy"
```

**Status:** ✅ Correct pattern for Dokploy integration.

---

## 5. Security Posture Assessment

| Control | Status | Risk |
|---------|--------|------|
| API Authentication | Single master key, no user auth | 🔴 Critical |
| Rate Limiting | None | 🔴 Critical |
| Request Size Limits | None | 🔴 Critical |
| Input Validation | None beyond type checks | 🟡 Medium |
| File Upload Validation | None (no type check, no size limit) | 🔴 Critical |
| ONNX File Validation | None | 🔴 Critical |
| CORS | `allow_origins: ["*"]` | 🟡 Medium |
| Secrets | Plain env vars in `.env` | 🟡 Medium |
| HTTPS | No (plain HTTP) | 🔴 Critical |
| Security Groups | Not defined in Terraform | 🔴 Critical |
| Network Policies | None | 🔴 Critical |
| Logging | None | 🟡 Medium |
| Monitoring | None | 🟡 Medium |
| Backups | None | 🔴 Critical |
| Disaster Recovery | None | 🔴 Critical |

---

## 6. Recommendations (Prioritized)

### 🔴 Critical (Fix Immediately)

1. **Add rate limiting middleware** — 60 req/min per IP, 1000 req/min globally
2. **Add request size limits** — max 100MB body, 50MB for file uploads
3. **Add HTTPS/TLS** — use Traefik with Let's Encrypt or AWS ALB
4. **Add security groups** — only allow 80/443 from internet, SSH from trusted IPs
5. **Add ONNX validation** — validate `.onnx` files before accepting uploads
6. **Add file upload validation** — check content-type, enforce max size

### 🟡 Medium (Next Sprint)

7. **Add health check endpoint** — `/health` returning `{"status": "ok"}`
8. **Add request timeouts** — 30s for inference, 60s for LLM streaming
9. **Add graceful shutdown** — signal handlers, cleanup on SIGTERM
10. **Add logging** — structured JSON logs to Loki or CloudWatch
11. **Add metrics** — Prometheus + Grafana for monitoring
12. **Add remote state backend** — S3/StateLock for Terraform state

### 🟢 Nice to Have (Future)

13. **Add autoscaling** — Dokploy auto-scaling based on CPU/memory
14. **Add multi-region** — GeoDNS + cross-region replication
15. **Add billing** — Stripe integration for usage-based pricing
16. **Add model sandboxing** — Firecracker microVMs for isolated execution

---

## 7. Cost Estimate

| Component | AWS (t3.medium) | DigitalOcean (s-2vcpu-2gb) | GCP (e2-medium) |
|-----------|-----------------|---------------------------|-----------------|
| Compute | $25/mo | $12/mo | $15/mo |
| RDS (Postgres) | $15/mo | $12/mo | $15/mo |
| Redis | $5/mo | $5/mo | $5/mo |
| Bandwidth | $10-50/mo | $10-50/mo | $10-50/mo |
| **Total** | **~$50-100/mo** | **~$40-80/mo** | **~$45-90/mo** |

*Note: These are rough estimates. Actual costs depend on usage patterns.*

---

## 8. Summary

The infrastructure is **functional but not production-ready**. The core architecture (Terraform → VPS → Dokploy) is sound, but production hardening is missing. The priority order is:

1. **Security** (rate limiting, auth, TLS, file validation)
2. **Observability** (logging, metrics, health checks)
3. **Resilience** (remote state, backups, autoscaling)
4. **Cost optimization** (right-sizing, spot instances)

The codebase itself is clean and well-structured. The gaps are primarily in **operational maturity**, not in the application code.
