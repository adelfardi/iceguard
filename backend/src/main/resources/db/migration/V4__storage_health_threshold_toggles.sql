ALTER TABLE public.storage_health_thresholds
    ADD COLUMN avg_vs_target_enabled boolean NOT NULL DEFAULT true,
    ADD COLUMN small_files_enabled   boolean NOT NULL DEFAULT true,
    ADD COLUMN delete_ratio_enabled  boolean NOT NULL DEFAULT true,
    ADD COLUMN compaction_enabled    boolean NOT NULL DEFAULT true;