# Turquoise Ecosystem

> **A self-hosted, privacy-first model marketplace.** Think "Steam for ML models" — where data scientists publish ONNX models and others execute them locally, without sending data to the cloud.

---

## 🌟 Vision

An automated, self-hosted infrastructure framework for lightweight, high-performance machine learning model distribution and execution. Turquoise eliminates third-party cloud-serverless complexity by utilizing containerized execution, static ONNX model runtimes, and local network compute bridging.

**Core philosophy:** Your data never leaves your infrastructure. Models run locally via ONNX Runtime. The marketplace is for discovery, distribution, and orchestration — not data processing.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TURQUOISE ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌───────────────────────────────────────────────────────────────────────────┐ │
│   │                          FRONTEND (React Native Web)                       │ │
│   │  ┌─────────────────────────────────────────────────────────────────────┐  │ │
│   │  │  App.js (State Manager)                                             │  │ │
│   │  │  ┌─────────────┐  ┌───────────────────┐  ┌─────────────────────┐   │  │ │
│   │  │  │ CatalogView │  │ ModelDetailView   │  │   AuthModal          │   │  │ │
│   │  │  │ (Model Grid)│  │ (Dual-panel)      │  │  (Login / Wishlist)  │   │  │ │
│   │  │  └─────────────┘  └───────────────────┘  └─────────────────────┘   │  │ │
│   │  └─────────────────────────────────────────────────────────────────────┘  │ │
│   └───────────────────────────────────────────────────────────────────────────┘ │
│                                      │ fetch()                                   │
│                                      ▼ HTTP/JSON                                 │
│   ┌───────────────────────────────────────────────────────────────────────────┐ │
│   │                         BACKEND (FastAPI :8000)                            │ │
│   │  ┌─────────────────────────────────────────────────────────────────────┐  │ │
│   │  │  /api/v1/models        ← GET     List all models                    │  │ │
│   │  │  /api/v1/models/publish← POST   Create model (ONNX upload)          │  │ │
│   │  │  /api/v1/execute/{id}  ← POST   Run inference (ONNX or LLM proxy)   │  │ │
│   │  │  /api/auth/verify      ← POST   Bearer token auth                   │  │ │
│   │  │  /api/wishlist         ← POST   Developer waitlist                  │  │ │
│   │  │  /api/v1/download/{id} ← GET    Download ONNX file                 │  │ │
│   │  │  /api/v1/models/{id}   ← DELETE Delete a model                      │  │ │
│   │  └─────────────────────────────────────────────────────────────────────┘  │ │
│   │  ┌─────────────────────────────────────────────────────────────────────┐  │ │
│   │  │  Database: PostgreSQL (models, usage_logs, wishlist)                │  │ │
│   │  │  Storage:   /app/models (ONNX files, ~20GB+)                        │  │ │
│   │  └─────────────────────────────────────────────────────────────────────┘  │ │
│   └───────────────────────────────────────────────────────────────────────────┘ │
│                                      │ HTTP/JSON                                 │
│                                      ▼                                           │
│   ┌───────────────────────────────────────────────────────────────────────────┐ │
│   │                    DOKPLOY ORCHESTRATION LAYER                             │ │
│   │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────────┐  │ │
│   │  │  Backend     │  │  Frontend    │  │  PostgreSQL 15 (Dokploy Mgmt)  │  │ │
│   │  │  (FastAPI)   │  │  (Expo Web)  │  │  ┌──────────────────────────┐  │ │ │
│   │  │  :8000       │  │  :8081       │  │  │  models                  │  │ │ │
│   │  │              │  │             │  │  │  usage_logs              │  │ │ │
│   │  │              │  │             │  │  │  wishlist                │  │ │ │
│   │  │              │  │             │  │  └──────────────────────────┘  │ │ │
│   │  └──────────────┘  └──────────────┘  └────────────────────────────────┘  │ │
│   └───────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                           │
│                                      ▼                                           │
│   ┌───────────────────────────────────────────────────────────────────────────┐ │
│   │  ┌─────────────────────────────────────────────────────────────────────┐  │ │
│   │  │  ONNX Runtime (Inference Engine)                                    │  │ │
│   │  │  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────┐    │  │ │
│   │  │  │ Tabular Model  │  │ Vision Model   │  │  OpenAI Proxy       │    │  │ │
│   │  │  │ (Linear Reg)   │  │ (MNIST CNN)     │  │  (LLM Streaming)    │    │  │ │
│   │  │  └────────────────┘  └────────────────┘  └─────────────────────┘    │  │ │
│   │  └─────────────────────────────────────────────────────────────────────┘  │ │
│   └───────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
cd backend && uv sync --frozen
cd frontend && npm install

# Start services
cd ..
docker-compose up -d
```

Access:
- **Frontend:** http://localhost:8081
- **Backend API:** http://localhost:8000/docs
- **Dokploy UI:** http://localhost:8080

### VPS Deployment (Terraform)

```bash
# Configure your cloud provider
cp infra/terraform.tfvars.example infra/terraform.tfvars
# Edit with your credentials

# Initialize and apply
cd infra/terraform
terraform init
terraform validate
terraform apply

# Deploy to the VPS
./infra/terraform/deploy.sh
```

---

## 🧠 Core Concepts

### ONNX-Native Execution

Turquoise doesn't re-implement ML frameworks. It uses **ONNX Runtime** as the universal execution layer. Models are published as `.onnx` files and executed anywhere — on your laptop, on a VPS, on a local machine — with zero vendor lock-in.

### Privacy-First Design

- **No data leaves your infrastructure.** All inference runs locally.
- **No telemetry.** We don't log your inputs or outputs.
- **Self-hosted.** You control the entire stack.

### Hybrid Compute

Turquoise supports two execution modes:

| Mode | Description | Use Case |
|------|-------------|----------|
| `local_onnx` | Model runs locally via ONNX Runtime | Privacy-critical, low-latency |
| `openai_proxy` | Model runs on remote worker via API | Heavy models, GPU instances |

---

## 📁 Project Structure

```
turquoise/
├── backend/                    # FastAPI backend
│   ├── main.py                # Application entry point
│   ├── migrations.py          # Database migrations
│   ├── Dockerfile            # Container image
│   ├── pyproject.toml        # Dependencies (uv)
│   └── models/               # ONNX model storage
│       ├── generate_onnx.py  # Model generator
│       └── sample.onnx       # Demo model
├── frontend/                  # React Native Web app
│   ├── App.js                # Main component
│   ├── app.json             # Expo config
│   ├── package.json         # Dependencies
│   └── components/          # Reusable components
│       ├── Header.js
│       ├── Footer.js
│       ├── CatalogView.js
│       └── ModelDetailView.js
├── infra/                    # Infrastructure as Code
│   ├── terraform/           # Terraform modules
│   ├── scripts/             # Deployment scripts
│   └── ARCHITECTURE.md      # Infra docs
├── migrations/               # Database migrations
│   └── 001_create_models.sql
├── .github/workflows/       # CI/CD
│   ├── infra.yml            # Terraform pipeline
│   └── dokploy.yml          # Dokploy pipeline
├── docker-compose.yml       # Local orchestration
├── README.md               # This file
├── MEMORY.md               # Project memory (decisions, facts)
└── INFRASTRUCTURE_REPORT.md # Full infra analysis
```

---

## 🔐 Security

> ⚠️ **This is a reference implementation. For production use, see [SECURITY.md](SECURITY.md).**

Current gaps:
- No rate limiting
- No user authentication (master API key only)
- No request size limits
- No HTTPS (use Traefik + Let's Encrypt in production)

See [`BACKEND_ANALYSIS.md`](BACKEND_ANALYSIS.md) for the full security assessment.

---

## 📈 Roadmap

| Phase | Timeline | Focus |
|-------|----------|-------|
| **v1.1 Hardening** | 2 weeks | Rate limiting, validation, timeouts, health checks |
| **v1.2 Auth & Billing** | 4 weeks | JWT auth, usage metering, Stripe integration |
| **v1.3 Marketplace** | 6 weeks | Model catalog UI, search, filtering, versioning |
| **v1.4 Multi-tenancy** | 8 weeks | Per-tenant isolation, quotas, billing |
| **v2.0 Platform** | 12 weeks | Model sandboxing, multi-region, CI/CD for models |

---

## 🧪 Demo Models

| Model | Type | Description |
|-------|------|-------------|
| `linear-regression` | Tabular | Predicts house prices from features |
| `mnist-cnn` | Vision | Classifies handwritten digits |
| `gemma-chat` | Text | OpenAI proxy to Gemma-2 via remote workers |

---

## 🧰 Toolchain

| Layer | Tool | Why |
|-------|------|-----|
| **Language** | Python 3.11 | FastAPI, ONNX Runtime, pydantic |
| **Frontend** | React Native Web | Expo, TypeScript, native feel |
| **Database** | PostgreSQL 15 | ACID, JSONB, full-text search |
| **Cache** | Redis | Session store, rate limiting |
| **Orchestration** | Dokploy | One-click Docker Compose deploy |
| **IaC** | Terraform | Multi-cloud VPS provisioning |
| **CI/CD** | GitHub Actions | Automated deployments |
| **Package Mgmt** | `uv` | Fast Python dependency resolution |

---

## 📚 Deep Dives

- [`BACKEND_ANALYSIS.md`](BACKEND_ANALYSIS.md) — Full API catalog, security analysis, performance review
- [`FRONTEND_ANALYSIS.md`](FRONTEND_ANALYSIS.md) — Component tree, UX audit, a11y findings
- [`INFRASTRUCTURE_REPORT.md`](INFRASTRUCTURE_REPORT.md) — Dockerfile review, Terraform audit, cost analysis
- [`PRODUCT_ANALYSIS.md`](PRODUCT_ANALYSIS.md) — Vision, GTM strategy, competitive landscape

---

## 🤝 Contributing

Turquoise is open source. We welcome contributions:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your change
4. Test locally: `docker-compose up`
5. Submit a pull request

### Good First Issues

- [ ] Add rate limiting middleware
- [ ] Add request size validation
- [ ] Add HTTPS with Traefik
- [ ] Add JWT authentication
- [ ] Add model versioning

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **ONNX Runtime** — The universal inference engine
- **FastAPI** — The best async Python framework
- **React Native Web** — The best way to build cross-platform UIs
- **Dokploy** — The simplest Docker orchestration
- **Terraform** — The standard for IaC

---

## 📞 Contact

- **GitHub:** [@berkonder](https://github.com/berkonder)
- **Twitter:** [@berkonder](https://twitter.com/berkonder)
- **Email:** berkonder@proton.me

---

> "Model distribution shouldn't be a black box. You should own your stack, own your data, and own your models." — Turquoise Ecosystem
