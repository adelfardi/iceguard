-- Dedicated databases created on a fresh Postgres volume (docker-entrypoint-initdb.d).
--   polaris   — Apache Polaris relational-jdbc persistence
--   restcat   — REST catalog (JdbcCatalog backend) persistence
--   nessie    — real Nessie Catalog Server version store (JDBC persistence)
SELECT 'CREATE DATABASE polaris'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'polaris')\gexec
SELECT 'CREATE DATABASE restcat'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'restcat')\gexec
SELECT 'CREATE DATABASE nessie'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nessie')\gexec