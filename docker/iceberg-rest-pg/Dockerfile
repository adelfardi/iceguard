# Iceberg REST Catalog fixture, backed by PostgreSQL (persistent) instead of the
# default in-container SQLite (which lives in /tmp and is lost on container recreate).
#
# The upstream image bundles ONLY the SQLite JDBC driver and starts with
# `java -jar iceberg-rest-adapter.jar` (an uber-jar with no Class-Path manifest entry,
# so external jars are invisible). We therefore add the PostgreSQL driver and start the
# same main class via an explicit classpath so the driver is picked up.
FROM apache/iceberg-rest-fixture:latest

ARG PG_DRIVER_VERSION=42.7.7
# --chmod makes the driver world-readable: ADD defaults to 0600/root, but the fixture
# runs as a non-root user that must read the jar (and the build user can't chmod it).
ADD --chmod=0644 https://repo1.maven.org/maven2/org/postgresql/postgresql/${PG_DRIVER_VERSION}/postgresql-${PG_DRIVER_VERSION}.jar \
    /usr/lib/iceberg-rest/postgresql.jar

WORKDIR /usr/lib/iceberg-rest
CMD ["java", "-cp", "iceberg-rest-adapter.jar:postgresql.jar", "org.apache.iceberg.rest.RESTCatalogServer"]