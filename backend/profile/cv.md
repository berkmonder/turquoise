# Berk Önder

<!-- The assistant's only knowledge (and the fallback search's). Keep the headings (## and ###): the
search cuts this file into sections at them, and shows a matching section as it is. Source: Berk's CV
(berkmonder.com/files/resume_muhammedBerkOnder.pdf) and the services on berkmonder.com. -->

Muhammed Berk Önder is an AI/ML engineer in Istanbul, Turkey. He builds and deploys production ML and
LLM systems, runs the infrastructure under them, and teaches teams to use and maintain them. He has
worked in telecommunications and in software/mobile apps since 2022.

## Summary

AI/ML engineer with experience building, deploying and scaling production ML and LLM systems.
Specialized in LLM-powered systems (RAG assistants, agents), anomaly detection, large-scale data
processing and data pipelines. Strong in Python, Docker, Git, Airflow, GCP and modern LLM tools
(LangChain, Ollama, llama.cpp, LiteLLM). M.Sc. in physics.

With LLMs, Berk has built a RAG assistant over internal data (Teknasyon), a telco LLM assistant
(P.I. Works), and his own production LLM service, which runs this assistant (see Projects).

## Services

Berk offers consulting, hands-on builds and team training, in Turkish or English, remotely or on-site
in Istanbul. Details: berkmonder.com/services.

### LLM and agent systems

Assistants that answer from a company's own data, and agents that use its tools, with evaluation and
tracing from day one, on cloud APIs or self-hosted models. Typical work: retrieval-augmented
assistants over documents and databases, agents calling internal tools and APIs with guardrails,
evaluation sets and tracing, and choosing between cloud APIs and self-hosted models for privacy,
latency and cost.

### ML infrastructure and MLOps

Pipelines (Airflow, Dataform, Prefect) on GCP or a company's own servers, experiment tracking and a
model registry with MLflow, CI/CD that makes every model a versioned and reproducible artifact,
serving, monitoring and alerting, and keeping GPU and cloud costs under control.

### Training for teams

Hands-on workshops on a company's own use cases, from half a day to several days: LLMs and NLP for
engineers (embeddings, retrieval, evaluation), building agents (tools, memory, safety), practical AI
for every team (using assistants well and safely), and MLOps fundamentals. The team keeps the
material.

### How an engagement works

A free 30-minute intro call; then a short written proposal with scope, deliverables, timeline and a
fixed price; then work in small steps with regular check-ins; and a handover with documentation and a
walkthrough, so the team can run it without Berk. Cost: each engagement has a fixed price, set in
the proposal after the free intro call, so ask Berk for a quote. Berk signs NDAs, and can set up open models on a
company's own servers so that sensitive data never leaves them.

## Experience

### MLOps Engineer, Teknasyon (August 2024 – present)

- Designed and deployed a modular RAG-based LLM system with LangChain and Open WebUI, for
  high-precision retrieval from structured internal data through custom Python pipelines and tools.
- Scaled a production spam detection pipeline handling millions of records a week by segmenting the
  data processing, removing memory bottlenecks and improving stability.
- Built automated data pipelines for anomaly detection with Dataform and Airflow on GCP, for
  high-cardinality event data across thousands of dimensions.
- Integrated MLflow into Airflow pipelines to standardize experiment tracking and reproducibility.
- Optimized fine-tuning of ~30B-parameter Qwen models on RunPod, cutting training time and cost
  through better GPU utilization.
- Implemented CI/CD with GitHub, Cloud Build and Docker for versioned model artifacts and
  reproducible deployments; containerized ML and LLM services.

### Machine Learning Engineer, P.I. Works (July 2022 – July 2024)

- Built a telco LLM assistant with LangChain: knowledge-base retrieval, SQL data access, analysis and
  visualization in one interface.
- Developed a heatmap forecasting system with regression models that predicts network traffic from
  football match data, reducing aggregate error from 77% to 0.75%.
- Implemented multivariate anomaly detection on streaming time series with clustering.
- Designed a synthetic data generation framework with Monte Carlo methods, increasing data
  granularity 60 times.

## Projects

### A production LLM service on his own GPU

An open model (Qwen3.5 9B) served by llama.cpp behind LiteLLM on Berk's own PC (RTX 3060), with a key
per client, every request traced in MLflow, speech in and out, and Open WebUI as a chat interface.
This assistant runs on it; when the GPU is off, a search over this profile answers instead.

### Live anomaly detection

A live demo on berkmonder.com: a streaming signal, forecast every second by Chronos-Bolt, with each
point judged against the forecast band.

### Three machines as code

Berk's laptop, GPU workstation and cloud server are all configured with Nix in one repository:
pull-based deploys, encrypted secrets, nightly off-site backups and uptime checks
(berkmonder.com/status).

### Hive

An open-source desktop command center for AI coding agents: Claude Code, Codex and Gemini side by
side, each in its own terminal and git worktree, with review, commit and merge in one place
(github.com/berkmonder/hive).

## Skills

- Programming: Python, SQL, Bash
- LLMs: LangChain, LangGraph, llama.cpp, vLLM, Ollama, LM Studio, LiteLLM, Hugging Face, Unsloth
- Machine learning: scikit-learn, PyTorch, TensorFlow, PySpark, MLflow, time series, anomaly detection
- Python libraries: Pandas, Polars, NumPy, Matplotlib, Plotly, Typer, NetworkX
- MLOps and infrastructure: Git, Docker, Podman, CI/CD, FastAPI, Airflow, Prefect, GCP, RunPod, Linux,
  uv, Nix
- Languages: Turkish (native), English (proficient)

## Education

Where Berk studied: İstanbul University, for both degrees. His study was physics: a bachelor's
degree, then a master's in high energy and plasma physics.

### M.Sc., High Energy and Plasma Physics, İstanbul University (2024)

GPA 3.63.

### B.Sc., Physics, İstanbul University (2021)

GPA 3.31.

## Contact and availability

Berk is open to new projects (consulting and training) and to new roles: he's happy to talk with
recruiters about ML and MLOps roles and jobs. Email: berkmonder@gmail.com. LinkedIn: linkedin.com/in/berkmonder. GitHub:
github.com/berkmonder. Website: berkmonder.com. Or leave an email with "Contact Berk" in this chat.
