# Berk Önder

<!-- The assistant's only knowledge (and the fallback search's). Keep the headings (## and ###): the
search cuts this file into sections at them, and shows a matching section as it is. Source: Berk's CV
(berkmonder.com/files/resume_muhammedBerkOnder.pdf). The website itself is the agent's other source. -->

Muhammed Berk Önder is an AI/ML engineer in Istanbul, Turkey. Berk builds and deploys production ML and
LLM systems, runs the infrastructure under them, and teaches teams to use and maintain them. Berk has
worked in telecommunications and in software/mobile apps since 2022.

## Summary

AI/ML engineer with experience building, deploying and scaling production ML and LLM systems.
Specialized in LLM-powered systems (RAG assistants, agents), anomaly detection, large-scale data
processing and data pipelines. Strong in Python, Docker, Git, Airflow, GCP and modern LLM tools
(LangChain, Ollama, llama.cpp, LiteLLM). M.Sc. in physics.

With LLMs, Berk has built a RAG assistant over internal data (Teknasyon), a telco LLM assistant
(P.I. Works), and a production LLM service of Berk's own, which runs this assistant (see Projects).

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

### A production LLM service on Berk's own GPU

An open model (Qwen3.5 9B) served by llama.cpp behind LiteLLM on Berk's own PC (RTX 3060), with a key
per client, every request traced in MLflow, speech in and out, and Open WebUI as a chat interface.
This assistant, Turquoise, runs on it: a Pydantic AI agent that searches this profile and berkmonder.com
(berkmonder.com/turquoise). When the GPU is off, it gives quick answers from search alone.

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

Where Berk studied: İstanbul University, for both degrees. The field of study was physics: a bachelor's
degree, then a master's in high energy and plasma physics.

### M.Sc., High Energy and Plasma Physics, İstanbul University (2024)

GPA 3.63.

### B.Sc., Physics, İstanbul University (2021)

GPA 3.31.

## Contact and availability

Berk is open to new projects, trainings and roles, and happy to talk with recruiters about ML and
MLOps jobs. Email: berkmonder@gmail.com. LinkedIn: linkedin.com/in/berkmonder. GitHub:
github.com/berkmonder. Website: berkmonder.com.
