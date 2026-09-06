# Backend Analysis — Turquoise Ecosystem

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        backend/main.py                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  FastAPI Application (Single File, 280 lines)             │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │  Lifespan: asynccontextmanager → init_db() → monitor │  │  │
│  │  │  ┌─────────────────────────────────────────────────┐  │  │  │
│  │  │  │  API Routes (6 endpoints)                        │  │  │  │
│  │  │  │  • GET  /api/v1/models                          │  │  │  │
│  │  │  │  • POST /api/v1/models/publish                  │  │  │  │
│  │  │  │  • POST /api/v1/execute/{model_id}              │  │  │  │
│  │  │  │  • POST /api/auth/verify                       │  │  │  │
│  │  │  │  • POST /api/wishlist                          │  │  │  │
│  │  │  │  • GET  /api/v1/download/{model_id}            │  │  │  │
│  │  │  │  • DELETE /api/v1/models/{model_id}            │  │  │  │
│  │  │  └─────────────────────────────────────────────────┘  │  │  │
│  │  │  ┌─────────────────────────────────────────────────┐  │  │  │
│  │  │  │  Data Models (SQLModel)                         │  │  │  │
│  │  │  │  • ModelTable (models)                         │  │  │  │
│  │  │  │  • UsageLog (usage_logs)                       │  │  │  │
│  │  │  │  • Wishlist (wishlist)                         │  │  │  │
│  │  │  └─────────────────────────────────────────────────┘  │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

## API Endpoint Catalog

| Method | Endpoint | Auth | Request | Response | Description |
|--------|----------|------|---------|-----------|-------------|
| `GET` | `/api/v1/models` | ❌ | — | `List[ModelTable]` | List all registered models |
| `POST` | `/api/v1/models/publish` | ✅ Bearer | `id, name, description, category, execution_type, input_type, output_type, worker_url, onnx_file` | `ModelTable` | Publish/upload a model |
| `POST` | `/api/v1/execute/{model_id}` | ❌ | `{ "payload": Any }` | `{"model_id": str, "timestamp": float, "output": Any}` | Run inference |
| `POST` | `/api/auth/verify` | ❌ | `{ "apiKey": str }` | `{"status": "authenticated"}` | Verify master API key |
| `POST` | `/api/wishlist` | ❌ | `{ "email": str }` | `{"message": str}` | Join developer waitlist |
| `GET` | `/api/v1/download/{model_id}` | ❌ | — | `FileResponse` | Download ONNX file |
| `DELETE` | `/api/v1/models/{model_id}` | ✅ Bearer | — | `{"message": str}` | Delete a model |

## Data Models

### `ModelTable` (SQLModel)

```python
class ModelTable(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    description: str
    owner_id: str = Field(default="system")
    category: str = Field(default="general")
    execution_type: str = Field(default="local_onnx")
        # Values: "local_onnx" | "openai_proxy"
    input_type: str = Field(default="tabular_csv")
        # Values: "tabular_csv" | "image_canvas_28x28" | "text_prompt"
    output_type: str = Field(default="numeric_array")
        # Values: "numeric_array" | "classification_label" | "text_completion"
    worker_url: str = Field(default="local")
    node_status: str = Field(default="online")
        # Values: "online" | "offline"
    created_at: datetime = Field(default_factory=utcnow)
```

### `UsageLog`

```python
class UsageLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    model_id: str
    caller_identity: str
    bytes_processed: int
    timestamp: datetime = Field(default_factory=utcnow)
```

### `Wishlist`

```python
class Wishlist(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    timestamp: datetime = Field(default_factory=utcnow)
```

## Security Analysis

| Control | Status | Implementation | Risk |
|---------|--------|----------------|------|
| **Authentication** | ❌ Weak | Single `MASTER_API_KEY` in env | 🔴 Critical |
| **Authorization** | ❌ None | No user roles, no permissions | 🔴 Critical |
| **Rate Limiting** | ❌ None | No throttling at all | 🔴 Critical |
| **Request Size** | ❌ None | No max body size | 🔴 Critical |
| **File Upload** | ❌ Unvalidated | No content-type check, no size limit | 🔴 Critical |
| **ONNX Validation** | ❌ None | No signature, no schema check | 🔴 Critical |
| **CORS** | ⚠️ Permissive | `allow_origins=["*"]` | 🟡 Medium |
| **Input Sanitization** | ⚠️ Partial | Relies on SQLModel parameterization | 🟡 Medium |
| **SQL Injection** | ✅ Safe | SQLModel uses parameterized queries | ✅ Safe |
| **XSS** | ⚠️ None | No CSP headers, no output encoding | 🟡 Medium |
| **CSRF** | ❌ None | No CSRF tokens | 🟡 Medium |
| **Secrets** | ⚠️ In code | `MASTER_API_KEY` in `main.py` | 🟡 Medium |

## Performance Analysis

### Async/Sync Mismatch

```python
# ❌ This is a problem:
@app.post("/api/v1/execute/{model_id}")
async def execute_model_inference(model_id: str, request: UniversalExecutionRequest):
    def _get_model():
        with Session(engine) as session:
            return session.get(ModelTable, model_id)
            
    model = await asyncio.to_thread(_get_model)  # ✅ Good: offloads DB call
    # ...
    def _run_onnx():
        ort_session = ort.InferenceSession(model_path)
        # ...
    output_data = await asyncio.to_thread(_run_onnx)  # ❌ BAD: ONNX is sync and blocks
```

**Problem:** The ONNX inference runs synchronously inside `asyncio.to_thread()`, but it **blocks** that thread. Under high load, this can starve other async tasks.

**Recommended fix:** Use a thread pool with bounded size, or better yet, a task queue (asyncio.Queue) with worker threads.

### Database I/O Pattern

```python
# ❌ Current: Single connection, no pool
engine = create_engine(settings.DATABASE_URL, echo=False)

# Inside async handler:
with Session(engine) as session:
    return session.exec(select(ModelTable)).all()
```

**Problem:** Every request opens a new DB connection, uses it, closes it. This is **extremely inefficient** for high-throughput workloads.

**Recommended fix:** Use SQLAlchemy connection pool:
```python
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=3600,
)
```

### Memory Issues

- **No request body size limit** → a 1GB CSV can exhaust memory
- **No ONNX file size limit** → a 500MB model file can crash the container
- **No timeout on inference** → a hung model blocks forever

## Bugs & Edge Cases

### 1. No Request Timeout

```python
@app.post("/api/v1/execute/{model_id}")
async def execute_model_inference(model_id: str, request: UniversalExecutionRequest):
    # ❌ If the model hangs, this request holds the connection forever
```

**Fix:** Add a timeout of 30-60 seconds to the request.

### 2. No Rate Limiting

A single client can hammer the API, exhausting:
- DB connections
- CPU (ONNX inference is CPU-intensive)
- Memory (large payloads)

**Fix:** Add `@app.middleware(limit_requests_per_minute(60))`

### 3. No File Upload Validation

```python
onnx_file: Optional[UploadFile] = File(None)
```

**Problem:** An attacker can upload:
- A 1GB file (DoS)
- A malicious `.onnx` (arbitrary code execution via ONNX runtime)
- A non-ONNX file that passes basic checks

**Fix:** Validate file size, content-type, and ONNX schema before accepting.

### 4. No Error Rate Monitoring

The code catches exceptions and returns 500, but there's **no alerting**. A misconfigured model could silently crash all requests.

**Fix:** Add structured logging with error rates, alert on >5% error rate.

### 5. No Circuit Breaker

If the remote worker (`openai_proxy` execution_type) is down, every request fails. There's no fallback or retry.

**Fix:** Add a circuit breaker pattern (e.g., using `resilience-circuitbreaker`).

### 6. No Model Versioning

Once a model is published, it can't be "unpublished" — only deleted. There's no version history.

**Fix:** Add a `versions` table with soft deletes.

## Missing Features

| Feature | Priority | Effort |
|---------|----------|--------|
| Rate limiting (per IP, per user) | 🔴 Critical | Low |
| Request size limits | 🔴 Critical | Low |
| File upload validation | 🔴 Critical | Medium |
| ONNX file validation | 🔴 Critical | Medium |
| Rate limiting | 🔴 Critical | Low |
| Request timeouts | 🔴 Critical | Low |
| Health check endpoint | 🔴 Critical | Low |
| Graceful shutdown | 🔴 Critical | Low |
| User authentication (JWT) | 🟡 Medium | Medium |
| Usage metering | 🟡 Medium | Medium |
| Model versioning | 🟡 Medium | Medium |
| Billing integration | 🟢 Low | High |
| Model marketplace UI | 🟢 Low | High |

## Recommendations

### Immediate (v1.1)

1. **Add rate limiting middleware** — 60 req/min per IP, 1000 total/min
2. **Add request size limits** — max 100MB body, max 100MB file upload
3. **Add ONNX validation** — check file size, content-type, and basic schema
4. **Add request timeouts** — 30s for inference, 60s for LLM streaming
5. **Add health check** — `/health` returning `{"status": "ok"}`
6. **Add structured logging** — JSON logs to a centralized logger

### Short-term (v1.2)

7. **Add user authentication** — JWT-based auth with refresh tokens
8. **Add usage metering** — track requests per user, store in Redis
9. **Add model versioning** — soft deletes, version history
10. **Add circuit breaker** — for remote worker failures

### Long-term (v2.0)

11. **Multi-tenant isolation** — per-tenant DB schemas or row-level security
12. **Billing integration** — Stripe Connect for marketplace revenue share
13. **Model sandboxing** — Firecracker microVMs for isolated execution
14. **Multi-region deployment** — GeoDNS + cross-region replication

---

## Code Quality Notes

- ✅ **Good:** Single-file simplicity makes it easy to understand and modify
- ✅ **Good:** Uses `uvicorn` + `uvicorn` for ASGI compliance
- ✅ **Good:** `asyncio.to_thread()` pattern is correct for offloading sync I/O
- ❌ **Bad:** No type hints on function parameters (except the models)
- ❌ **Bad:** No docstrings on any functions
- ❌ **Bad:** No type hints on return types
- ❌ **Bad:** No error handling for malformed JSON payloads
- ❌ **Bad:** No request validation beyond basic type checks

**Overall:** The code is **clean and functional** for an MVP, but lacks production-grade safeguards. The architecture is sound — the issues are all in the **operational layer** (rate limiting, validation, monitoring), not the core logic.
