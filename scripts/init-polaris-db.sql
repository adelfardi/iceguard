-- Dedicated database for Apache Polaris relational-jdbc persistence.
-- Runs only on a fresh Postgres volume (docker-entrypoint-initdb.d).
SELECT 'CREATE DATABASE polaris'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'polaris')\gexec
