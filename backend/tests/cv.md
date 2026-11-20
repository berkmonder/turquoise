# Muhammed Berk Önder

**AI/ML Engineer · MLOps and LLM Systems**

Istanbul, Turkey · [berkmonder@gmail.com](mailto:berkmonder@gmail.com) · +90 545 528 3371 · [linkedin.com/in/berkmonder](https://www.linkedin.com/in/berkmonder) · [github.com/berkmonder](https://github.com/berkmonder) · [berkmonder.com](https://berkmonder.com)

## Summary

AI/ML engineer with 4+ years of experience taking machine learning and LLM systems from prototype to production in telecommunications and mobile apps. Builds the whole path: data pipelines, training and fine-tuning, evaluation, serving, monitoring, and the infrastructure underneath. Strong in Python, LLM systems (RAG, agents, model serving), MLOps (MLflow, Airflow, CI/CD, Docker) and GCP. M.Sc. in physics.

## Experience

### MLOps Engineer, Teknasyon

*Aug 2024 – Present*

- Designed and deployed a modular retrieval-augmented generation (RAG) assistant with LangChain and Open WebUI that answers precisely from structured internal data, through custom Python pipelines and tool integrations.
- Scaled a production spam detection pipeline processing millions of records per week by segmenting its data processing, removing memory bottlenecks and making runs stable.
- Built automated anomaly detection pipelines on GCP with Dataform and Airflow for high-cardinality event data across thousands of dimensions, replacing manual query work.
- Fine-tuned ~30B-parameter Qwen models on RunPod with better GPU utilization, cutting training time and infrastructure cost.
- Standardized experiment tracking by integrating MLflow into Airflow pipelines, improving model observability and reproducibility.
- Built CI/CD with GitHub, Cloud Build and Docker that produces versioned model artifacts and reproducible deployments; containerized ML and LLM services.

### Machine Learning Engineer, P.I. Works

*Jul 2022 – Jul 2024*

- Built a telecom LLM assistant with LangChain that combines knowledge base retrieval, SQL data access, analysis and visualization in one interface.
- Developed a heatmap forecasting system that predicts network traffic from football match data with regression models, reducing aggregate error from 77% to 0.75%.
- Implemented multivariate anomaly detection on streaming time series with clustering, improving detection across diverse network scenarios.
- Designed a Monte Carlo synthetic data generation framework that increased data granularity 60×.

## Projects

### Turquoise: an LLM agent on self-hosted infrastructure

*[berkmonder.com/turquoise](https://berkmonder.com/turquoise/)*

- Agent built with Pydantic AI that answers questions about the website it runs on: it reads the visitor's current page, searches the site and the CV (BM25 and embeddings), and streams its reasoning and tool calls to a React chat built on the Vercel AI SDK.
- Serves Qwen3.5 9B with llama.cpp on a home RTX 3060 behind LiteLLM (per-client keys and limits), with every call traced in MLflow; falls back to search-only answers when the GPU is offline.

### Infrastructure as code for production and a home GPU server

*NixOS, GitHub Actions, Podman, Tailscale*

- Runs a production VPS and a GPU workstation from one Nix repository: pull-based deploys, container builds in GitHub Actions with health-checked rollbacks, encrypted secrets (sops), a private network (Tailscale), nightly backups (restic), Prometheus and Grafana monitoring, and external uptime checks.

### Hive: a desktop app for AI coding agents

*[github.com/berkmonder/hive](https://github.com/berkmonder/hive) · open source*

- Runs Claude Code, Codex and Gemini side by side, each in its own terminal and git worktree, with review, commit and merge in one place.

## Education

### M.Sc., High Energy and Plasma Physics, İstanbul University

*2024 · GPA 3.63/4.00*

### B.Sc., Physics, İstanbul University

*2021 · GPA 3.31/4.00*

## Skills

- **Programming:** Python, SQL, Bash
- **LLMs and machine learning:** RAG, AI agents (Pydantic AI, LangChain, LangGraph), fine-tuning (Hugging Face, Unsloth), llama.cpp, vLLM, Ollama, LiteLLM, PyTorch, scikit-learn, TensorFlow, time series forecasting, anomaly detection
- **MLOps and data:** MLflow, Airflow, Prefect, Dataform, PySpark, Pandas, Polars, FastAPI, CI/CD (GitHub Actions, Cloud Build)
- **Infrastructure:** Docker, Podman, Linux, NixOS, GCP, RunPod, Tailscale, Prometheus, Grafana
- **Languages:** Turkish (native), English (professional working proficiency)
