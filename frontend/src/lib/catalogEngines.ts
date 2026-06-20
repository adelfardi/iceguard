import type { CreateCatalogRequest } from '@/types';

export type CatalogEngine = 'rest' | 'nessie' | 'polaris' | 'unity' | 'other';

export interface EngineMeta {
  id: CatalogEngine;
  label: string;
  /** Real project logo served from /public/logos; null → render a generic icon. */
  logo: string | null;
  description: string;
  uriPlaceholder: string;
  warehousePlaceholder: string;
  defaultAuth: NonNullable<CreateCatalogRequest['authType']>;
}

export const CATALOG_ENGINES: EngineMeta[] = [
  {
    id: 'rest',
    label: 'Iceberg REST',
    logo: '/logos/iceberg.png',
    description: 'Apache Iceberg REST Catalog (reference / JDBC-backed)',
    uriPlaceholder: 'http://host:8181',
    warehousePlaceholder: 's3://bucket/warehouse',
    defaultAuth: 'NONE',
  },
  {
    id: 'nessie',
    label: 'Nessie',
    logo: '/logos/nessie.svg',
    description: 'Project Nessie — Git-like versioning for the lakehouse',
    uriPlaceholder: 'http://host:19120/iceberg',
    warehousePlaceholder: 's3://bucket/warehouse',
    defaultAuth: 'NONE',
  },
  {
    id: 'polaris',
    label: 'Polaris',
    logo: '/logos/polaris.png',
    description: 'Apache Polaris — catalog-as-a-service (OAuth2)',
    uriPlaceholder: 'http://host:8181/api/catalog',
    warehousePlaceholder: 'polaris-warehouse (catalog name)',
    defaultAuth: 'OAUTH2',
  },
  {
    id: 'unity',
    label: 'Unity Catalog',
    logo: '/logos/unity-catalog.svg',
    description: 'Unity Catalog (Databricks / OSS) — Iceberg REST API',
    uriPlaceholder: 'https://<workspace>/api/2.1/unity-catalog/iceberg-rest',
    warehousePlaceholder: 'unity_catalog_name',
    defaultAuth: 'BEARER',
  },
  {
    id: 'other',
    label: 'Other / Custom',
    logo: null,
    description: 'Any Iceberg REST-compatible catalog',
    uriPlaceholder: 'http://host:port',
    warehousePlaceholder: 's3://bucket/warehouse',
    defaultAuth: 'NONE',
  },
];

export function engineMeta(id: CatalogEngine): EngineMeta {
  return CATALOG_ENGINES.find((e) => e.id === id) ?? CATALOG_ENGINES[CATALOG_ENGINES.length - 1];
}
