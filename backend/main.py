# backend/main.py
import io
import os
import time
import json
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, List, Optional

import httpx
import numpy as np
import onnxruntime as ort
import pandas as pd
from fastapi import FastAPI, HTTPException, Header, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.exc import OperationalError
from sqlmodel import Field, Session, SQLModel, create_engine, select

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:secret123@db:5432/mvp_db"
    FRONTEND_URL: str = "http://localhost:8081"
    MODEL_DIR: str = "/app/models"
    MASTER_API_KEY: str = "sk_turquoise_prod_placeholder_token"

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local", "../.env.local"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
engine = create_engine(settings.DATABASE_URL, echo=False)

# String normalization maps for developer flexibility
INPUT_TYPE_MAP = {
    "csv_matrix": "tabular_csv",
    "tabular_csv": "tabular_csv",
    "canvas_28x28": "image_canvas_28x28",
    "image_canvas_28x28": "image_canvas_28x28",
    "text_prompt": "text_prompt"
}

OUTPUT_TYPE_MAP = {
    "numeric_array": "numeric_array",
    "label_class": "classification_label",
    "classification_label": "classification_label",
    "text_stream": "text_completion",
    "text_completion": "text_completion"
}

class ModelTable(SQLModel, table=True):
    __tablename__ = "models"
    id: str = Field(primary_key=True)
    name: str
    description: str
    owner_id: str = Field(default="system")
    category: str = Field(default="general")
    execution_type: str = Field(default="local_onnx")
    input_type: str = Field(default="tabular_csv")
    output_type: str = Field(default="numeric_array")
    worker_url: str = Field(default="local")
    node_status: str = Field(default="online")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UsageLog(SQLModel, table=True):
    __tablename__ = "usage_logs"
    id: Optional[int] = Field(default=None, primary_key=True)
    model_id: str
    caller_identity: str
    bytes_processed: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Wishlist(SQLModel, table=True):
    __tablename__ = "wishlist"
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

def verify_api_access(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed security token specification.")
    token = authorization.split(" ")[1]
    if token != settings.MASTER_API_KEY:
        raise HTTPException(status_code=403, detail="Provided access token credentials invalid.")
    return "authorized_developer"

async def monitor_compute_nodes():
    while True:
        await asyncio.sleep(30)
        with Session(engine) as session:
            models = session.exec(select(ModelTable)).all()
            async with httpx.AsyncClient(timeout=3.0) as client:
                for model in models:
                    if model.execution_type == "local_onnx":
                        model.node_status = "online"
                        continue
                    try:
                        response = await client.get(f"{model.worker_url}/health")
                        model.node_status = "online" if response.status_code == 200 else "offline"
                    except Exception:
                        model.node_status = "offline"
            session.commit()

def init_db():
    os.makedirs(settings.MODEL_DIR, exist_ok=True)
    for i in range(10):
        try:
            SQLModel.metadata.create_all(engine)
            break
        except OperationalError:
            time.sleep(2)

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    loop = asyncio.get_event_loop()
    monitor_task = loop.create_task(monitor_compute_nodes())
    yield
    monitor_task.cancel()

app = FastAPI(title="Turquoise Ecosystem Engine", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UniversalExecutionRequest(BaseModel):
    payload: Any

class WishlistRequest(BaseModel):
    email: str

@app.get("/api/v1/models", response_model=List[ModelTable])
def list_ecosystem_models():
    with Session(engine) as session:
        return session.exec(select(ModelTable)).all()

@app.post("/api/wishlist")
def request_developer_access(req: WishlistRequest):
    if "@" not in req.email:
        raise HTTPException(status_code=400, detail="Invalid email address format.")
    with Session(engine) as session:
        existing = session.exec(select(Wishlist).where(Wishlist.email == req.email)).first()
        if existing:
            return {"message": "Email is already registered on the developer waitlist."}
        session.add(Wishlist(email=req.email))
        session.commit()
        return {"message": "Developer access request recorded. You will be notified upon onboarding."}

# Flexible Publishing Endpoint
@app.post("/api/v1/models/publish", response_model=ModelTable)
async def publish_model(
    id: str = Form(...),
    name: str = Form(...),
    description: str = Form(...),
    category: str = Form("general"),
    execution_type: str = Form("local_onnx"),
    input_type: str = Form("tabular_csv"),
    output_type: str = Form("numeric_array"),
    worker_url: str = Form("local"),
    onnx_file: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    caller: str = Depends(verify_api_access)
):
    upload_file = onnx_file or file

    norm_input = INPUT_TYPE_MAP.get(input_type, "tabular_csv")
    norm_output = OUTPUT_TYPE_MAP.get(output_type, "numeric_array")

    with Session(engine) as session:
        existing = session.get(ModelTable, id)
        if existing:
            raise HTTPException(status_code=400, detail=f"Model ID '{id}' is already registered.")

        if execution_type == "local_onnx":
            if not upload_file:
                raise HTTPException(status_code=400, detail="Local ONNX execution requires an attached .onnx file.")
            file_path = os.path.join(settings.MODEL_DIR, f"{id}.onnx")
            content = await upload_file.read()
            with open(file_path, "wb") as f:
                f.write(content)

        new_model = ModelTable(
            id=id,
            name=name,
            description=description,
            owner_id=caller,
            category=category,
            execution_type=execution_type,
            input_type=norm_input,
            output_type=norm_output,
            worker_url=worker_url,
            node_status="online" if execution_type == "local_onnx" else "offline"
        )
        session.add(new_model)
        session.commit()
        session.refresh(new_model)
        return new_model

@app.get("/api/v1/download/{model_id}")
def download_model_file(model_id: str):
    model_path = os.path.join(settings.MODEL_DIR, f"{model_id}.onnx")
    if not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail=f"Static ONNX asset '{model_id}.onnx' not hosted on server.")
    return FileResponse(path=model_path, filename=f"{model_id}.onnx", media_type="application/octet-stream")

# Agnostic Execution Pipeline with LLM Streaming
@app.post("/api/v1/execute/{model_id}")
async def execute_model_inference(model_id: str, request: UniversalExecutionRequest):
    with Session(engine) as session:
        model = session.get(ModelTable, model_id)
        if not model:
            raise HTTPException(status_code=404, detail="Target model mapping unavailable.")
        if model.node_status == "offline":
            raise HTTPException(status_code=503, detail="Target computing node cluster is currently offline.")

    # 1. OpenAI Compatible Remote LLM Stream (e.g. llama-server)
    if model.execution_type == "openai_proxy":
        # Strip any trailing slashes from worker_url to avoid double-slash 404s
        target_url = f"{model.worker_url.rstrip('/')}/v1/chat/completions"

        async def event_stream_generator():
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    async with client.stream(
                        "POST",
                        target_url,
                        json={
                            "model": "gemma4-e2b",
                            "messages": [{"role": "user", "content": str(request.payload)}],
                            "temperature": 0.7,
                            "stream": True
                        }
                    ) as response:
                        if response.status_code != 200:
                            # Read raw response body to expose exact llama-server error
                            err_bytes = await response.aread()
                            err_msg = err_bytes.decode("utf-8", errors="ignore")
                            yield f"data: {json.dumps({'error': f'Remote worker {response.status_code}: {err_msg}'})}\n\n"
                            return

                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                raw_data = line[6:].strip()
                                if raw_data == "[DONE]":
                                    break
                                try:
                                    chunk = json.loads(raw_data)
                                    token = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                    if token:
                                        yield f"data: {json.dumps({'token': token})}\n\n"
                                except Exception:
                                    pass
            except Exception as e:
                yield f"data: {json.dumps({'error': f'Proxy routing exception: {str(e)}'})}\n\n"

        return StreamingResponse(event_stream_generator(), media_type="text/event-stream")

    # 2. Local ONNX Engine
    elif model.execution_type == "local_onnx":
        model_path = os.path.join(settings.MODEL_DIR, f"{model_id}.onnx")
        if not os.path.exists(model_path):
            raise HTTPException(status_code=404, detail=f"ONNX asset file '{model_id}.onnx' missing from server storage.")
        
        try:
            ort_session = ort.InferenceSession(model_path)
            input_info = ort_session.get_inputs()[0]
            input_name = input_info.name
            expected_shape = input_info.shape

            if isinstance(request.payload, str) and model.input_type == "tabular_csv":
                df = pd.read_csv(io.StringIO(request.payload.strip()), header=None)
                try:
                    float(df.iloc[0, 0])
                except ValueError:
                    df = pd.read_csv(io.StringIO(request.payload.strip()))
                raw_matrix = df.to_numpy(dtype=np.float32)
            else:
                raw_matrix = np.array(request.payload, dtype=np.float32)

            if len(expected_shape) == 2:
                tensor_input = raw_matrix.reshape(1, -1) if raw_matrix.ndim != 2 else raw_matrix
            elif len(expected_shape) == 4:
                tensor_input = raw_matrix.reshape(1, 1, 28, 28) if raw_matrix.ndim != 4 else raw_matrix
            else:
                tensor_input = raw_matrix

            execution_outputs: Any = ort_session.run(None, {input_name: tensor_input})
            raw_predictions = execution_outputs[0]

            if model.output_type == "classification_label":
                output_data = int(np.argmax(raw_predictions[0]))
            else:
                output_data = getattr(raw_predictions, "tolist")()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Local ONNX runtime execution crash: {str(e)}")

        return {"model_id": model_id, "timestamp": time.time(), "output": output_data}

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported execution_type '{model.execution_type}'.")


@app.delete("/api/v1/models/{model_id}")
def delete_model(model_id: str, caller: str = Depends(verify_api_access)):
    """Deletes a registered model and removes its ONNX file asset from disk."""
    with Session(engine) as session:
        model = session.get(ModelTable, model_id)
        if not model:
            raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found.")

        # Clean up stored ONNX file from disk if local
        if model.execution_type == "local_onnx":
            file_path = os.path.join(settings.MODEL_DIR, f"{model_id}.onnx")
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"Warning: Could not remove file {file_path}: {e}")

        session.delete(model)
        session.commit()
        return {"message": f"Model '{model_id}' successfully unassigned and unlinked."}
