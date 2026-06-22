-- Global Spark session tuning (driver / executor), applied to every Spark maintenance run
-- and overridable per cluster. Singleton row.
CREATE TABLE public.spark_settings (
    id bigint NOT NULL,
    driver_memory character varying(64),
    executor_memory character varying(64),
    executor_cores integer,
    executor_instances integer,
    extra_conf text DEFAULT '{}'::text NOT NULL,
    updated_at timestamp(6) with time zone
);

CREATE SEQUENCE public.spark_settings_seq
    START WITH 1
    INCREMENT BY 50
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE ONLY public.spark_settings
    ADD CONSTRAINT spark_settings_pkey PRIMARY KEY (id);
