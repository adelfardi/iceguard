CREATE TABLE public.storage_health_thresholds (
    id bigint NOT NULL,
    avg_vs_target_warn_percent integer NOT NULL,
    avg_vs_target_bad_percent integer NOT NULL,
    small_file_size_mb integer NOT NULL,
    small_files_warn_percent integer NOT NULL,
    small_files_bad_percent integer NOT NULL,
    delete_ratio_warn_percent integer NOT NULL,
    delete_ratio_bad_percent integer NOT NULL,
    compaction_target_ratio_percent integer NOT NULL,
    updated_at timestamp(6) with time zone
);

CREATE SEQUENCE public.storage_health_thresholds_seq
    START WITH 1
    INCREMENT BY 50
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE ONLY public.storage_health_thresholds
    ADD CONSTRAINT storage_health_thresholds_pkey PRIMARY KEY (id);
