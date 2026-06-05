-- IceGuard schema baseline — generated from the JPA entities via Hibernate DDL
-- (authoritative: matches the entity mappings, so hibernate validate passes).

CREATE TABLE public.alert_event (
    current_value double precision,
    notified boolean,
    threshold double precision NOT NULL,
    created_at timestamp(6) with time zone,
    id bigint NOT NULL,
    resolved_at timestamp(6) with time zone,
    rule_id bigint,
    triggered_at timestamp(6) with time zone,
    metric character varying(255),
    operator character varying(255),
    rule_name character varying(255),
    status character varying(255),
    table_ref character varying(255)
);
CREATE SEQUENCE public.alert_event_seq
    START WITH 1
    INCREMENT BY 50
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE TABLE public.alert_rule (
    check_interval_minutes integer,
    enabled boolean NOT NULL,
    last_value double precision,
    threshold double precision NOT NULL,
    catalog_id bigint,
    created_at timestamp(6) with time zone NOT NULL,
    id bigint NOT NULL,
    last_checked_at timestamp(6) with time zone,
    updated_at timestamp(6) with time zone NOT NULL,
    emails text,
    last_status character varying(255),
    metric character varying(255),
    name character varying(255),
    namespace character varying(255),
    operator character varying(255),
    table_name character varying(255)
);
CREATE SEQUENCE public.alert_rule_seq
    START WITH 1
    INCREMENT BY 50
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE TABLE public.catalog_config (
    created_at timestamp(6) with time zone NOT NULL,
    id bigint NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    auth_type character varying(50),
    uri character varying(1024) NOT NULL,
    warehouse character varying(1024),
    credentials text,
    name character varying(255) NOT NULL,
    properties text,
    CONSTRAINT catalog_config_auth_type_check CHECK (((auth_type)::text = ANY ((ARRAY['NONE'::character varying, 'BEARER'::character varying, 'OAUTH2'::character varying, 'BASIC'::character varying])::text[])))
);
CREATE SEQUENCE public.catalog_config_seq
    START WITH 1
    INCREMENT BY 50
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE TABLE public.execution_history (
    catalog_id bigint NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    finished_at timestamp(6) with time zone,
    id bigint NOT NULL,
    schedule_id bigint,
    started_at timestamp(6) with time zone NOT NULL,
    status character varying(50) NOT NULL,
    action_type character varying(100) NOT NULL,
    namespace character varying(512) NOT NULL,
    table_name character varying(512) NOT NULL,
    error_message text,
    result text,
    CONSTRAINT execution_history_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'RUNNING'::character varying, 'SUCCESS'::character varying, 'FAILED'::character varying, 'CANCELLED'::character varying])::text[])))
);
CREATE SEQUENCE public.execution_history_seq
    START WITH 1
    INCREMENT BY 50
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE TABLE public.maintenance_schedule (
    enabled boolean NOT NULL,
    catalog_id bigint NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    id bigint NOT NULL,
    next_run timestamp(6) with time zone,
    updated_at timestamp(6) with time zone NOT NULL,
    action_type character varying(100) NOT NULL,
    cron_expression character varying(100) NOT NULL,
    namespace character varying(512),
    table_name character varying(512),
    parameters text
);
CREATE SEQUENCE public.maintenance_schedule_seq
    START WITH 1
    INCREMENT BY 50
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE TABLE public.pipeline (
    enabled boolean NOT NULL,
    catalog_id bigint NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    id bigint NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    cron_expression character varying(100),
    namespace character varying(512),
    table_name character varying(512),
    description character varying(255),
    name character varying(255) NOT NULL
);
CREATE TABLE public.pipeline_run (
    created_at timestamp(6) with time zone NOT NULL,
    finished_at timestamp(6) with time zone,
    id bigint NOT NULL,
    pipeline_id bigint NOT NULL,
    started_at timestamp(6) with time zone,
    status character varying(50) NOT NULL,
    triggered_by character varying(50),
    CONSTRAINT pipeline_run_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'RUNNING'::character varying, 'SUCCESS'::character varying, 'FAILED'::character varying, 'CANCELLED'::character varying])::text[])))
);
CREATE SEQUENCE public.pipeline_run_seq
    START WITH 1
    INCREMENT BY 50
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.pipeline_seq
    START WITH 1
    INCREMENT BY 50
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE TABLE public.pipeline_task (
    order_index integer NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    id bigint NOT NULL,
    pipeline_id bigint NOT NULL,
    action_type character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    parameters text
);
CREATE TABLE public.pipeline_task_run (
    order_index integer NOT NULL,
    finished_at timestamp(6) with time zone,
    id bigint NOT NULL,
    run_id bigint NOT NULL,
    started_at timestamp(6) with time zone,
    task_id bigint NOT NULL,
    status character varying(50) NOT NULL,
    error_message text,
    result text,
    CONSTRAINT pipeline_task_run_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'RUNNING'::character varying, 'SUCCESS'::character varying, 'FAILED'::character varying, 'SKIPPED'::character varying])::text[])))
);
CREATE SEQUENCE public.pipeline_task_run_seq
    START WITH 1
    INCREMENT BY 50
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.pipeline_task_seq
    START WITH 1
    INCREMENT BY 50
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE TABLE public.smtp_config (
    enabled boolean NOT NULL,
    port integer NOT NULL,
    tls boolean NOT NULL,
    id bigint NOT NULL,
    updated_at timestamp(6) with time zone,
    from_address character varying(255),
    host character varying(255),
    password text,
    username character varying(255)
);
CREATE SEQUENCE public.smtp_config_seq
    START WITH 1
    INCREMENT BY 50
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE TABLE public.spark_cluster_config (
    created_at timestamp(6) with time zone NOT NULL,
    id bigint NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    description character varying(1024),
    master_url character varying(1024) NOT NULL,
    name character varying(255) NOT NULL,
    properties text
);
CREATE SEQUENCE public.spark_cluster_config_seq
    START WITH 1
    INCREMENT BY 50
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER TABLE ONLY public.alert_event
    ADD CONSTRAINT alert_event_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.alert_rule
    ADD CONSTRAINT alert_rule_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.catalog_config
    ADD CONSTRAINT catalog_config_name_key UNIQUE (name);
ALTER TABLE ONLY public.catalog_config
    ADD CONSTRAINT catalog_config_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.execution_history
    ADD CONSTRAINT execution_history_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.maintenance_schedule
    ADD CONSTRAINT maintenance_schedule_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.pipeline
    ADD CONSTRAINT pipeline_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.pipeline_run
    ADD CONSTRAINT pipeline_run_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.pipeline_task
    ADD CONSTRAINT pipeline_task_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.pipeline_task_run
    ADD CONSTRAINT pipeline_task_run_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.smtp_config
    ADD CONSTRAINT smtp_config_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.spark_cluster_config
    ADD CONSTRAINT spark_cluster_config_name_key UNIQUE (name);
ALTER TABLE ONLY public.spark_cluster_config
    ADD CONSTRAINT spark_cluster_config_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.alert_event
    ADD CONSTRAINT fk1sehn6mpxtshf781kyly6ecre FOREIGN KEY (rule_id) REFERENCES public.alert_rule(id);
ALTER TABLE ONLY public.pipeline_run
    ADD CONSTRAINT fk2lsd1s3vpylu2opv2c5dfddco FOREIGN KEY (pipeline_id) REFERENCES public.pipeline(id);
ALTER TABLE ONLY public.pipeline
    ADD CONSTRAINT fk78nrlvux9vlhtuqhuwky528dl FOREIGN KEY (catalog_id) REFERENCES public.catalog_config(id);
ALTER TABLE ONLY public.execution_history
    ADD CONSTRAINT fka2j6cyw0lyshvyoqw39muw145 FOREIGN KEY (schedule_id) REFERENCES public.maintenance_schedule(id);
ALTER TABLE ONLY public.execution_history
    ADD CONSTRAINT fkax6u491okgyfsjgfrv2l2agjf FOREIGN KEY (catalog_id) REFERENCES public.catalog_config(id);
ALTER TABLE ONLY public.maintenance_schedule
    ADD CONSTRAINT fkbxen4cvwxapcvxdc1plei2b7g FOREIGN KEY (catalog_id) REFERENCES public.catalog_config(id);
ALTER TABLE ONLY public.alert_rule
    ADD CONSTRAINT fkd4ibyx2a1ojh2gmhdtsurfyyg FOREIGN KEY (catalog_id) REFERENCES public.catalog_config(id);
ALTER TABLE ONLY public.pipeline_task_run
    ADD CONSTRAINT fkegm0yubx7pm2vtx82he72fgpq FOREIGN KEY (task_id) REFERENCES public.pipeline_task(id);
ALTER TABLE ONLY public.pipeline_task
    ADD CONSTRAINT fksrbrj88yw2br3yop7pkk0cy87 FOREIGN KEY (pipeline_id) REFERENCES public.pipeline(id);
ALTER TABLE ONLY public.pipeline_task_run
    ADD CONSTRAINT fkt92c5vw3t1td8n33w0sa9vs2n FOREIGN KEY (run_id) REFERENCES public.pipeline_run(id);
