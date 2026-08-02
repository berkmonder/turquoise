# Ecosystem Memory Engine

This document serves as the persistent memory matrix for the developer and AI collaborators. It outlines the current precise technical state, closed quirks, design philosophies, and active sprint pipelines. **Read this file entirely before executing any code mutations.**

---

## Current Operational State

1. **Frontend View Execution**: Completed transition from a single-page layout to a component-managed multi-view architecture. `App.js` acts as a zero-overhead controller toggling between `CatalogView` and `ModelDetailView`.
2. **Database Auto-Seeding**: Backend dynamically spawns relational tables (`models`, `usage_logs`, `wishlist`) via SQLModel reflection on cold boot. A default `sample` entry is injected automatically if the repository is empty.
3. **UI Paradigm Shift**: Fully stripped out template-like emojis and playful design primitives. Visual identity is locked down as an enterprise, high-utility dark developer mesh network workspace.

---

## Resolved Architectural Quirks & Interventions

- **ONNX Version Ceiling**: The execution engine originally failed when loading graphs exported via standard modern packages using Opset 27 / IR v13. Resolved by enforcing compilation to explicit Opset 15 / IR v8 configurations inside `generate_onnx.py`.
- **Typing Boundary Normalization**: Fixed union-type analysis issues flag by `ty` when analyzing the outputs of `onnxruntime`. Handled by utilizing structured `getattr(raw_predictions, "tolist")()` extraction to guarantee predictable payload returns.
- **Lifespan Context Transition**: Migrated away from deprecated FastAPI startup events to standard `asynccontextmanager` lifespan loops to handle graceful connection pooling and resilient back-off retries against the PostgreSQL container.

---

## Active Roadmap & Sprint Backlog

### Sprint 1: Hybrid Node Topology & Telemetry (Current Focus)
The objective is to pivot the platform from an isolated localized sandbox into a hybrid cloud/edge platform using localized PC computing clusters.

- [ ] **Data Model Adaptation**: Extend the `models` SQLModel database schema to track compute node state variables (`node_status`: online/offline, `worker_url`: destination endpoint string).
- [ ] **Tailscale Integration Blueprint**: Configure backend network requests to seamlessly route execution payloads from a minimal VPS control layer out to an external dedicated machine IP via secure WireGuard tunnels.
- [ ] **Background Node Watchdog**: Introduce an asynchronous background pooling routine inside `main.py` that checks the health of assigned worker nodes every 30 seconds and alters their global accessibility state.
- [ ] **Telemetry Frontend Implementation**: Update `CatalogView.js` to render discrete operational health markers (`NODE ACTIVE` / `NODE OFFLINE`) based on live backend evaluations, automatically locking execution triggers if the specialized compute cluster goes dark.

### Sprint 2: Data Safeguards & Platform Ingress Guardrails
- [ ] Implement string payload volume caps inside FastAPI middleware layers to filter out massive inputs before they exhaust system memory allocation limits.
- [ ] Integrate database partition rules or an automated clean-up routing mechanism to prevent analytical log dumps from filling storage blocks on budget hardware nodes.
