-- Per-table overrides for the two Overview gauge thresholds (data files / snapshots).
-- A NULL column means "inherit the global storage_health_thresholds default".

CREATE TABLE public.table_overview_thresholds (
    id bigint NOT NULL,
    catalog_id bigint NOT NULL,
    namespace character varying(255) NOT NULL,
    table_name character varying(255) NOT NULL,
    data_files_threshold integer,
    snapshot_count_threshold integer,
    updated_at timestamp(6) with time zone
);

CREATE SEQUENCE public.table_overview_thresholds_seq
    START WITH 1
    INCREMENT BY 50
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE ONLY public.table_overview_thresholds
    ADD CONSTRAINT table_overview_thresholds_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.table_overview_thresholds
    ADD CONSTRAINT table_overview_thresholds_uk UNIQUE (catalog_id, namespace, table_name);
