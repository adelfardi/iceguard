ALTER TABLE catalog_config
    ADD COLUMN tags text NOT NULL DEFAULT '[]';
