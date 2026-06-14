ALTER TABLE public.storage_health_thresholds
    RENAME COLUMN small_file_size_mb TO small_file_size_kb;

UPDATE public.storage_health_thresholds
    SET small_file_size_kb = small_file_size_kb * 1024;
