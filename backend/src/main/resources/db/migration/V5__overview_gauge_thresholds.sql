ALTER TABLE public.storage_health_thresholds
    ADD COLUMN data_files_threshold     integer NOT NULL DEFAULT 100,
    ADD COLUMN snapshot_count_threshold integer NOT NULL DEFAULT 50;
