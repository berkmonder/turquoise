# Turquoise Ecosystem Migrations

## Purpose

This directory contains SQL migration scripts that are applied to the PostgreSQL database on startup.

## Migration Files

Migrations are named with a numeric prefix and executed in alphabetical order:

- `001_create_models.sql` — Creates the `models` table

## How It Works

The backend runs migrations on startup via the `migrations.py` module. Each migration file is a self-contained SQL script that can be:
- Applied to a fresh database
- Re-applied safely (idempotent migrations use `IF NOT EXISTS`)

## Running Migrations Manually

```bash
cd backend
python -m migrations
```

## Adding a New Migration

1. Create a new file: `migrations/002_create_something.sql`
2. Write your SQL (use `IF NOT EXISTS` for tables)
3. Restart the backend

## Schema Reference

| Table | Columns |
|-------|---------|
| `models` | id, name, description, owner_id, category, execution_type, input_type, output_type, worker_url, node_status, created_at |
| `usage_logs` | id, model_id, caller_identity, bytes_processed, timestamp |
| `wishlist` | id, email, timestamp |

## Notes

- All migrations are **idempotent** — they can be safely re-run.
- The `models` table is the core table; all others are derived from it.
