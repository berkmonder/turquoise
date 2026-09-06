# === DOKPLOY CONFIGURATION ===
# This file contains Dokploy-specific settings
# Separate from infrastructure config for clarity

# Dokploy Project Settings
dokploy_project_name     = "turquoise"
dokploy_project_key      = "turquoise"
dokploy_project_key_env  = "TURQUOISE_API_KEY"
dokploy_project_desc     = "Turquoise Ecosystem - Model Marketplace Platform"

# Dokploy Environment Variables
dokploy_env_DOKPLOY_DB_HOST     = "db.turquoise.internal"
dokploy_env_DOKPLOY_DB_PORT     = "5432"
dokploy_env_DOKPLOY_DB_NAME     = "turquoise"
dokploy_env_DOKPLOY_DB_USER     = "turquoise"
dokploy_env_DOKPLOY_DB_PASS     = "TurquoiseDB_S3cr3t_!"
dokploy_env_DOKPLOY_REDIS_HOST = "redis.turquoise.internal"
dokploy_env_DOKPLOY_REDIS_PORT = "6379"

# Dokploy Secrets (sensitive - use terraform.tfvars for actual values)
dokploy_secret_MASTER_API_KEY  = "sk_turquoise_prod_placeholder_token"
dokploy_secret_ADMIN_EMAIL     = "admin@turquoise.berkmonder.com"
