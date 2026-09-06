"""
Migration runner for Turquoise Ecosystem.
Runs migrations in order of filename (001_create_models.sql, etc.)
"""
import os
import sys
from pathlib import Path
from psycopg2 import sql, OperationalError, sqlerrors
from psycopg2.extensions import adapt

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

# Import all model tables to get their metadata
from main import ModelTable, UsageLog, Wishlist

BASE_DIR = Path(__file__).parent
MIGRATIONS_DIR = BASE_DIR / "migrations"

def get_migrations():
    """Get sorted list of migration files."""
    if not MIGRATIONS_DIR.exists():
        return []
    
    migrations = []
    for f in sorted(MIGRATIONS_DIR.glob("*.sql")):
        migrations.append(f)
    return migrations

def get_tables(engine):
    """Get all SQLModel table names."""
    with Session(engine) as session:
        tables = [m.__tablename__ for m in SQLModel.metadata.tables.keys()]
    return tables

def run_migration(engine, migration_file: Path):
    """Apply a single migration file."""
    with open(migration_file, "r") as f:
        sql_script = f.read()
    
    # Parse the SQL script into individual statements
    statements = []
    current_stmt = ""
    for line in sql_script.split("\n"):
        stripped = line.strip()
        if stripped and not stripped.startswith("--"):
            if stripped.endswith(";"):
                current_stmt += stripped[:-1] + ";"
                if current_stmt.strip():
                    statements.append(current_stmt.strip())
                    current_stmt = ""
            else:
                current_stmt += stripped
    
    if current_stmt.strip():
        statements.append(current_stmt.strip())
    
    with Session(engine) as session:
        for stmt in statements:
            try:
                session.execute(sql.text(stmt))
            except sqlerrors.SQLError as e:
                print(f"Migration error: {e}")
                raise

def run_migrations(engine):
    """Run all pending migrations."""
    migrations = get_migrations()
    existing_tables = get_tables(engine)
    
    print(f"Existing tables: {existing_tables}")
    
    for migration_file in migrations:
        print(f"Checking migration: {migration_file.name}")
        
        # Check if table already exists
        with Session(engine) as session:
            existing = get_tables(engine)
            table_name = migration_file.stem
        
        if table_name in existing:
            print(f"  Skipping {migration_file.name} — table already exists")
            continue
        
        try:
            run_migration(engine, migration_file)
            print(f"  ✓ Applied {migration_file.name}")
        except OperationalError as e:
            print(f"  ✗ Failed to apply {migration_file.name}: {e}")
            raise

@sqlmodel.session_ascontextmanager
def get_session():
    """Context manager for database sessions."""
    from main import engine
    with Session(engine) as session:
        yield session

if __name__ == "__main__":
    from main import engine
    
    print("=== Turquoise Ecosystem Migration Runner ===")
    print(f"Database: {engine.url}")
    print()
    
    try:
        run_migrations(engine)
        print("\n✓ All migrations applied successfully.")
    except OperationalError as e:
        print(f"\n✗ Failed to connect to database: {e}")
        print("  Ensure the database is running and accessible.")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        sys.exit(1)
