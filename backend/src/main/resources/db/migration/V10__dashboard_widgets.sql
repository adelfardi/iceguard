-- Widgets pinned to the dashboard. Each renders live data by re-fetching from the referenced
-- table (or globally); widget_type keys into the frontend widget registry.
CREATE TABLE dashboard_widget (
    id bigint NOT NULL,
    title character varying(255) NOT NULL,
    widget_type character varying(64) NOT NULL,
    catalog_id bigint,
    namespace character varying(512),
    table_name character varying(512),
    params text DEFAULT '{}'::text NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) with time zone
);

CREATE SEQUENCE dashboard_widget_seq
    START WITH 1
    INCREMENT BY 50
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE ONLY dashboard_widget
    ADD CONSTRAINT dashboard_widget_pkey PRIMARY KEY (id);
