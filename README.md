# Turquoise Ecosystem

An automated, self-hosted infrastructure framework designed for lightweight, high-performance machine learning model distribution and execution. This system eliminates third-party cloud-serverless complexity by utilizing containerized execution, static ONNX model runtimes, and local network compute bridging.

## Architecture Overview

- **Backend**: FastAPI (Python 3.9) utilizing SQLModel for automated PostgreSQL object-relational mapping and `onnxruntime` for static inference.
- **Frontend**: Expo Web (React Native Web) driven by a state-controlled multi-view architecture.
- **Orchestration**: Docker Compose for localized runtime parity with production VPS multi-tenant models.
- **Toolchain**: `uv` for lightning-fast virtual environment/dependency layering, `ruff` for lint compliance, and `ty` for Rust-backed type checking.

---

## Directory Architecture

```text
turquoise-ecosystem/
├── .env.local                     # Local environment configurations
├── docker-compose.yml             # Local infrastructure runtime orchestration
├── README.md                      # General system manual
├── MEMORY.md                      # Engineering state log & active roadmap
├── backend/
│   ├── main.py                    # Application entrypoint, lifecycle, and API routes
│   ├── pyproject.toml             # Python toolchain configurations (uv, ruff, ty)
│   ├── requirements.txt           # Unified dependency specifications
│   ├── Dockerfile                 # Optimized multi-stage build image
│   └── models/
│       ├── generate_onnx.py       # Deterministic model generator script
│       └── sample.onnx            # Compiled graph: Y = 1.5·X₀ + 2.5·X₁ + 0.5
└── frontend/
    ├── App.js                     # View state manager and core layout layout
    ├── app.json                   # Expo build manifesto
    ├── package.json               # Node dependency declarations
    └── components/
        ├── Header.js              # Minimal global header navigation bar
        ├── Footer.js              # 3-column architecture attribution layer
        ├── CatalogView.js         # Model storefront grid & waitlist component
        └── ModelDetailView.js     # Dual-panel analytics & inference workspace
```

## Quick Start
### 1. Launch Infrastructure Stack
Spin up the local PostgreSQL engine and build the FastAPI container:

```sh
docker compose up --build
```

### 2. Boot Frontend Interface
Install packages and start the Metro bundler targeting web execution in a separate shell:

```sh
cd frontend
npm install
npx expo start --web
```
The interface will be accessible at `http://localhost:8081.`

### 3. Automated Validation Pipeling
Execute code-quality and type-safety validations within the backend directory:

```sh
cd backend
uv run ruff check main.py
uv run ty check .
```

## Technical Specifications & Standards
### Model Operational Constraints
To ensure runtime compatibility across local hardware and slim VPS nodes, all models uploaded to this ecosystem must adhere to the ONNX Opset 15 / IR Version 8 baseline standard. Higher definitions risk runtime execution failures in underlying container layers.

### Data Contracts
- Predict API (`POST /api/predict/{model_id}`): Accepts raw, newline-separated CSV text inputs.
- Wishlist API (`POST /api/wishlist`): Implements strict formatting validation to capture developer intent before database commit.

```sh
curl -X POST http://localhost:8000/api/v1/models/publish \
  -H "Authorization: Bearer sk_turquoise_prod_placeholder_token" \
  -F "id=turquoise-chat" \
  -F "name=Distributed LLM Chatbot" \
  -F "description=Natural language completions routed to home NixOS GPU rig via Tailscale." \
  -F "category=nlp" \
  -F "execution_type=openai_proxy" \
  -F "input_type=text_prompt" \
  -F "output_type=text_completion" \
  -F "worker_url=http://100.76.197.63:8080"
```

```sh
curl -X POST http://localhost:8000/api/v1/models/publish \
  -H "Authorization: Bearer sk_turquoise_prod_placeholder_token" \
  -F "id=linear-demo" \
  -F "name=Linear Model Demo" \
  -F "description=2 input features mapped to 1 output value." \
  -F "category=tabular" \
  -F "execution_type=local_onnx" \
  -F "input_type=csv_matrix" \
  -F "output_type=numeric_array" \
  -F "onnx_file=@backend/models/sample.onnx"
```

```sh
curl -X POST http://localhost:8000/api/v1/models/publish \
  -H "Authorization: Bearer sk_turquoise_prod_placeholder_token" \
  -F "id=mnist-vision" \
  -F "name=MNIST Digit Classifier" \
  -F "description=28x28 drawing canvas digit classifier." \
  -F "category=vision" \
  -F "execution_type=local_onnx" \
  -F "input_type=canvas_28x28" \
  -F "output_type=label_class" \
  -F "onnx_file=@backend/models/mnist.onnx"
```