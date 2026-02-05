-- Database initialization script
-- This runs automatically when the PostgreSQL container is first created

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ticket_platform TO postgres;

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE 'Database initialization completed at %', NOW();
END $$;
