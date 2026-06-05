CREATE TABLE spark_cluster_config (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    master_url VARCHAR(1024) NOT NULL,
    description VARCHAR(1024),
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
