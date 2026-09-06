# Security Policy

> **Current Status:** ⚠️ **This is a reference implementation.** The platform is **NOT** suitable for production use without significant hardening.

---

## 🚨 Known Vulnerabilities

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| SEC-001 | 🔴 Critical | No rate limiting — API can be DDoS'd | Unpatched |
| SEC-002 | 🔴 Critical | No request size limits — DoS via large payloads | Unpatched |
| SEC-003 | 🔴 Critical | No file upload validation — arbitrary file upload | Unpatched |
| SEC-004 | 🔴 Critical | No ONNX file validation — malicious models accepted | Unpatched |
| SEC-005 | 🔴 Critical | No user authentication — anyone can access API | Unpatched |
| SEC-006 | 🔴 Critical | No request timeouts — hung requests block forever | Unpatched |
| SEC-007 | 🟡 Medium | CORS allows all origins (`*`) | Unpatched |
| SEC-008 | 🟡 Medium | No input sanitization — SQL injection possible | Unpatched |
| SEC-009 | 🟡 Medium | No CSRF protection | Unpatched |
| SEC-010 | 🟡 Medium | No Content Security Policy headers | Unpatched |
| SEC-011 | 🟡 Medium | Secrets in code (`.env` in git) | Unpatched |
| SEC-012 | 🟡 Medium | No HTTPS/TLS | Unpatched |
| SEC-013 | 🟢 Low | No security headers (X-Frame-Options, etc.) | Unpatched |
| SEC-014 | 🟢 Low | No HSTS | Unpatched |
| SEC-015 | 🟢 Low | Docker runs as root | Unpatched |

---

## 1. Rate Limiting

**Threat:** A single IP can hammer the API, exhausting DB connections, CPU, or memory.

**Mitigation:**

```python
# middleware/ratelimit.py
from fastapi import Request
from fastapi.responses import JSONResponse
import time
from collections import defaultdict
from typing import Dict, List

class RateLimiterMiddleware:
    """Rate limiter using sliding window algorithm."""
    
    def __init__(self, requests_per_minute: int = 60, requests_per_ip: int = 1000):
        self.requests_per_minute = requests_per_minute
        self.requests_per_ip = requests_per_ip
        self._window_start = time.time()
        self._requests: Dict[str, List[float]] = defaultdict(list)
        self._global_count = 0
    
    async def __call__(self, call_next: Request) -> Response:
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        
        # Clean old requests outside the window
        self._requests[client_ip] = [
            t for t in self._requests[client_ip]
            if now - t < 60
        ]
        
        if len(self._requests[client_ip]) >= self.requests_per_ip:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."}
            )
        
        # Global rate limit
        if self._global_count >= self.requests_per_minute:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Please try again later."}
            )
        
        self._requests[client_ip].append(now)
        self._global_count += 1
        
        return await call_next(request)
```

**Recommended limits:**
- Global: 1000 requests/minute
- Per IP: 60 requests/minute
- Per authenticated user: 1000 requests/minute

---

## 2. Request Size Limits

**Threat:** A 1GB CSV upload can exhaust memory and crash the container.

**Mitigation:**

```python
# middleware/max_size.py
from fastapi import Request
from fastapi.responses import JSONResponse

class MaxSizeMiddleware:
    """Enforces request body size limits."""
    
    MAX_BODY_SIZE = 100 * 1024 * 1024  # 100MB
    MAX_FILE_SIZE = 100 * 1024 * 1024   # 100MB
    
    def __init__(self, app: FastAPI):
        app.add_middleware(self)
    
    async def __call__(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        
        if content_length and int(content_length) > self.MAX_BODY_SIZE:
            return JSONResponse(
                status_code=413,
                content={
                    "detail": "Request body too large. Maximum allowed: 100MB"
                }
            )
        
        return await call_next(request)
```

---

## 3. File Upload Validation

**Threat:** An attacker uploads a malicious `.onnx` file that contains arbitrary code or triggers a denial of service.

**Mitigation:**

```python
# middleware/file_validation.py
import tempfile
import os
from fastapi import UploadFile, HTTPException
from typing import Optional

class FileUploadValidator:
    """Validates uploaded files before processing."""
    
    ALLOWED_EXTENSIONS = {".onnx", ".pkl", ".h5", ".npz"}
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    ALLOWED_CONTENT_TYPES = {
        "application/octet-stream",
        "application/x-onnx",
        "application/x-pickle",
        "application/x-hdf5",
        "application/zip",
    }
    
    @staticmethod
    def validate_file(file: UploadFile, max_size: int) -> bytes:
        """Validate and read a file upload."""
        # Check content type
        content_type = file.content_type
        if content_type not in FileUploadValidator.ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=415,
                detail=f"Invalid content type. Allowed: {FileUploadValidator.ALLOWED_CONTENT_TYPES}"
            )
        
        # Check file size
        file_size = file.headers.get("content-length", "0")
        try:
            size = int(file_size)
        except (ValueError, TypeError):
            size = 0
        
        if size > max_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum: {max_size / (1024*1024):.0f}MB"
            )
        
        # Read file into memory
        content = await file.read()
        if len(content) > max_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum: {max_size / (1024*1024):.0f}MB"
            )
        
        return content
    
    @staticmethod
    async def validate_onnx_file(file: UploadFile) -> bytes:
        """Validate an ONNX file before accepting it."""
        content = await file.read()
        
        # Check minimum size (ONNX files have a minimum header)
        if len(content) < 8:
            raise HTTPException(
                status_code=400,
                detail="File is too small to be a valid ONNX model"
            )
        
        # Check magic number (ONNX files start with "ONNX\x00\x01")
        if content[:6] != b"ONNX\x00\x01":
            raise HTTPException(
                status_code=400,
                detail="Invalid ONNX file format. Expected ONNX magic number."
            )
        
        # Validate with ONNX checker
        try:
            import onnx
            onnx.checker.check_model(onnx.ModelProto.from_json(content))
        except onnx.checker.ValidationError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid ONNX model: {str(e)}"
            )
        
        return content
```

---

## 4. ONNX Model Validation

**Threat:** A malicious ONNX model could trigger out-of-memory errors, infinite loops, or other DoS conditions.

**Mitigation:**

```python
# middleware/onnx_validator.py
import onnx
import onnx.checker
import onnx.shape_inference
from fastapi import HTTPException

class ONNXValidator:
    """Validates ONNX models before accepting them."""
    
    MAX_INPUT_NODES = 10
    MAX_OUTPUT_NODES = 10
    MAX_INPUT_DIMS = 100
    MAX_OUTPUT_DIMS = 100
    MAX_NODE_COUNT = 1000
    MAX_MODEL_SIZE = 500 * 1024 * 1024  # 500MB
    
    @staticmethod
    def validate(model_proto: onnx.ModelProto) -> None:
        """Comprehensive ONNX model validation."""
        
        # Check size
        model_size = len(onnx.helper.serialize_model(model_proto))
        if model_size > ONNXValidator.MAX_MODEL_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"Model too large: {model_size / (1024*1024):.1f}MB"
            )
        
        # Check input/output counts
        if len(model_proto.graph.input) > ONNXValidator.MAX_INPUT_NODES:
            raise HTTPException(
                status_code=400,
                detail=f"Too many input nodes: {len(model_proto.graph.input)} > {ONNXValidator.MAX_INPUT_NODES}"
            )
        
        if len(model_proto.graph.output) > ONNXValidator.MAX_OUTPUT_NODES:
            raise HTTPException(
                status_code=400,
                detail=f"Too many output nodes: {len(model_proto.graph.output)} > {ONNXValidator.MAX_OUTPUT_NODES}"
            )
        
        # Check graph structure
        shape_inference.infer_shapes(model_proto)
        
        # Check for known problematic patterns
        ONNXValidator._check_for_infinite_loops(model_proto)
        ONNXValidator._check_for_divergent_graphs(model_proto)
    
    @staticmethod
    def _check_for_infinite_loops(model_proto: onnx.ModelProto) -> None:
        """Check for potential infinite loops in the graph."""
        # This is a simplified check — in production, use a more thorough analysis
        for node in model_proto.graph.node:
            for attr in node.attribute:
                if attr.name == "loop_limit":
                    if attr.i > 10000:
                        raise HTTPException(
                            status_code=400,
                            detail="Loop limit too high. Maximum: 10000"
                        )
```

---

## 5. Request Timeouts

**Threat:** A hung inference request blocks the connection forever, exhausting resources.

**Mitigation:**

```python
# middleware/timeout.py
import asyncio
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from typing import Callable

class RequestTimeoutMiddleware:
    """Enforces request timeouts to prevent hung connections."""
    
    INFERENCE_TIMEOUT = 30  # seconds
    UPLOAD_TIMEOUT = 60     # seconds for file uploads
    
    def __init__(self, app: FastAPI):
        app.add_middleware(self)
    
    async def __call__(self, request: Request, call_next: Callable) -> Response:
        if request.url.path.startswith("/api/v1/execute/"):
            timeout = self.INFERENCE_TIMEOUT
        elif request.url.path.startswith("/api/v1/models/publish"):
            timeout = self.UPLOAD_TIMEOUT
        else:
            timeout = 30
        
        try:
            return await asyncio.wait_for(call_next(request), timeout=timeout)
        except asyncio.TimeoutError:
            return JSONResponse(
                status_code=504,
                content={"detail": "Request timed out. Please try again."}
            )
```

---

## 6. Authentication & Authorization

**Threat:** Anyone can access the API and execute models or upload malicious files.

**Mitigation:** Implement JWT-based authentication.

```python
# auth/middleware.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
import secrets
import hashlib
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")
ALGORITHM = "HS256"
SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(64))
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user(username)
    if user is None:
        raise credentials_exception
    return user
```

---

## 7. HTTPS/TLS

**Threat:** Data is transmitted in plaintext, allowing MITM attacks.

**Mitigation:** Use Traefik with Let's Encrypt:

```yaml
# docker-compose.yml
services:
  traefik:
    image: traefik:v3.0
    command:
      - "--providers.docker"
      - "--entrypoints.web.address=:443"
      - "--entrypoints.web.http.redirections.entryPoint.to=websecure"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge"
      - "--certificatesresolvers.letsencrypt.acme.email=admin@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    volumes:
      - letsencrypt:/letsencrypt
    ports:
      - "443:443"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.turquoise.rule=Host(`turquoise.example.com`)"
      - "traefik.http.routers.turquoise.tls.certresolver=letsencrypt"
      - "traefik.http.routers.turquoise.entrypoints=websecure"
      - "traefik.http.middlewares.turquoise.headers.securitydefinition.hsts=true"
      - "traefik.http.middlewares.turquoise.headers.securitydefinition.hstsincludeSubDomains=true"
      - "traefik.http.middlewares.turquoise.headers.securitydefinition.hstspreload=true"
      - "traefik.http.middlewares.turquoise.headers.securitydefinition.sts=true"
      - "traefik.http.middlewares.turquoise.headers.securitydefinition.stsincludeSubDomains=true"
      - "traefik.http.middlewares.turquoise.headers.securitydefinition.stsmaxage=31536000"
      - "traefik.http.middlewares.turquoise.headers.frameDeny=true"
      - "traefik.http.middlewares.turquoise.headers.contentSecurityPolicy.DefaultSrc=none"
      - "traefik.http.middlewares.turquoise.headers.contentSecurityPolicy.ConnectSrc=https:"
      - "traefik.http.middlewares.turquoise.headers.contentSecurityPolicy.ScriptSrc=https:"
      - "traefik.http.middlewares.turquoise.headers.contentSecurityPolicy.UpgradeInsecureRequests=true"
      - "traefik.http.middlewares.turquoise.headers.contentSecurityPolicy.ObjectSrc=none"
      - "traefik.http.middlewares.turquoise.headers.contentSecurityPolicy.MediaSrc=none"
      - "traefik.http.middlewares.turquoise.headers.contentSecurityPolicy.WorkerSrc=none"
      - "traefik.http.middlewares.turquoise.headers.contentSecurityPolicy.ChildSrc=none"
      - "traefik.http.middlewares.turquoise.headers.contentSecurityPolicy.FormAction=none"
      - "traefik.http.middlewares.turquoise.headers.contentSecurityPolicy.FrameAncestors=none"
      - "traefik.http.middlewares.turquoise.headers.contentSecurityPolicy.BaseUri=none"
      - "traefik.http.middlewares.turquoise.headers.contentSecurityPolicy.SandboxSrc=none"
      - "traefik.http.middlewares.turquoise.headers.contentSecurityPolicy.UpgradeInsecureRequests=true"
      - "traefik.http.middlewares.turquoise.headers.referrerPolicy=strict-origin-when-cross-origin"
      - "traefik.http.middlewares.turquoise.headers.xssProtection=1; mode=block"
      - "traefik.http.middlewares.turquoise.headers.xframeOptions=DENY"
      - "traefik.http.middlewares.turquoise.headers.xcontenttypeoptions=nosniff"
      - "traefik.http.middlewares.turquoise.headers.xpermittedcrossorigin=same-origin"
      - "traefik.http.middlewares.turquoise.headers.refererPolicy=strict-origin-when-cross-origin"
      - "traefik.http.middlewares.turquoise.headers.contentTypeNosniff=true"
      - "traefik.http.middlewares.turquoise.headers.customHeadersContent-Type=no-store"
      - "traefik.http.middlewares.turquoise.headers.customHeadersCache-Control=no-cache,no-store"
```

---

## 8. Security Headers

**Threat:** Clickjacking, MIME sniffing, XSS, etc.

**Mitigation:** The Traefik config above sets all headers. Here's a FastAPI alternative:

```python
# middleware/security_headers.py
from fastapi import FastAPI, Request
from fastapi.responses import Response
from starlette.middleware import Middleware

class SecurityHeadersMiddleware:
    """Adds security headers to all responses."""
    
    def __init__(self, app: FastAPI):
        app.add_middleware(self)
    
    async def __call__(self, request: Request, call_next):
        response = await call_next(request)
        
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), camera=(), gyroscope=(), magnetometer=(), "
            "microphone=(), payment=(), usb=()"
        )
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, "
                                           "max-age=0, proxy-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        
        return response
```

---

## 9. Secrets Management

**Threat:** Secrets committed to git, exposed in logs, or stored in plaintext env files.

**Mitigation:**

1. **Never commit `.env` files.** Add to `.gitignore`:
   ```
   .env
   .env.*
   *.pem
   *.key
   ```

2. **Use a secrets manager** (e.g., AWS Secrets Manager, HashiCorp Vault, or environment variables from a secrets manager).

3. **Scan for secrets** in CI:
   ```yaml
   # .github/workflows/security.yml
   - name: Check for secrets in code
     run: |
       if grep -r "password\|secret\|api_key" --include="*.py" --include="*.js" --include="*.toml" . 2>/dev/null | grep -v "test\|example"; then
         echo "Potential secrets found in code!"
         exit 1
       fi
   ```

---

## 10. Dependency Scanning

**Threat:** Vulnerable dependencies in the backend or frontend.

**Mitigation:**

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Python dependencies
      - name: Check Python dependencies
        run: |
          pip install bandit bandit-json2html
          bandit -r backend/
          
          # Check for known vulnerable packages
          pip install safety
          safety check backend/pyproject.toml
      
      # JavaScript dependencies
      - name: Check JavaScript dependencies
        run: |
          npm install npm audit
          npm audit --audit-level=high
      
      # Container scanning
      - name: Scan Docker images
        uses: aquasec/trivy-action@master
        with:
          image-ref: "turquoise-backend:latest"
          format: "table"
          exit-code: "1"
```

---

## 11. Monitoring & Alerting

**Threat:** An attack is happening but you don't know.

**Mitigation:** Set up monitoring for:

- **Rate limit violations** — alert on >1000 requests/minute from a single IP
- **Error rate spikes** — alert on >5% 5xx errors
- **Unusual patterns** — sudden spike in inference requests, unusual file uploads
- **Resource exhaustion** — CPU, memory, disk usage thresholds

```python
# middleware/logging.py
import logging
import json
from fastapi import Request
from fastapi.responses import Response
from datetime import datetime
import os

class StructuredLogger:
    """Logs structured JSON logs for easy analysis."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
    
    def log_request(self, request: Request, response: Response, duration: float):
        """Log a request with structured data."""
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "method": request.method,
            "path": request.url.path,
            "query": dict(request.query_params),
            "client_ip": request.client.host if request.client else "unknown",
            "user_agent": request.headers.get("user-agent", ""),
            "status_code": response.status_code,
            "duration_ms": round(duration * 1000, 2),
            "response_size": len(response.body) if hasattr(response, "body") else 0,
        }
        self.logger.info(json.dumps(log_data))

# Setup in main.py
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.handlers[0].formatter = logging.Formatter(
    "%(asctime)s %(levelname)s %(message)s"
)
```

---

## Remediation Roadmap

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| 1 | Add rate limiting middleware | 2h | 🔴 Critical |
| 2 | Add request size limits | 1h | 🔴 Critical |
| 3 | Add file upload validation | 4h | 🔴 Critical |
| 4 | Add ONNX file validation | 4h | 🔴 Critical |
| 5 | Add request timeouts | 2h | 🔴 Critical |
| 6 | Add JWT authentication | 8h | 🔴 Critical |
| 7 | Add security headers | 2h | 🟡 Medium |
| 8 | Enable HTTPS/TLS | 4h | 🔴 Critical |
| 9 | Add structured logging | 4h | 🟡 Medium |
| 10 | Add security scanning in CI | 4h | 🟡 Medium |

---

## References

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [CWE Top 25](https://cwe.mitre.org/top25/)

---

> **Disclaimer:** This is a reference implementation for educational purposes. Do not deploy to production without thorough security review and testing.