CREATE TABLE IF NOT EXISTS models (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    description VARCHAR NOT NULL,
    owner_id VARCHAR DEFAULT 'system',
    category VARCHAR DEFAULT 'general',
    execution_type VARCHAR DEFAULT 'local_onnx',
    input_type VARCHAR DEFAULT 'tabular_csv',
    output_type VARCHAR DEFAULT 'numeric_array',
    worker_url VARCHAR DEFAULT 'local',
    node_status VARCHAR DEFAULT 'online',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
