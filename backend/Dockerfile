# syntax=docker/dockerfile:1
#
# Slim backend image (no Spark). The Spark maintenance executor is unavailable here;
# use Dockerfile.spark for real rewrite_data_files. See Dockerfile.spark for the
# Spark-enabled variant.

# ── Stage 1: build the Quarkus app ──
# Pinned to the BUILD platform: the output is architecture-neutral bytecode, so a multi-arch
# build (linux/amd64 + linux/arm64) runs Maven once, natively, instead of once per target
# under QEMU. Only the runtime stage below is per-architecture.
FROM --platform=$BUILDPLATFORM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /build
COPY pom.xml .
RUN mvn -B -ntp -q dependency:go-offline || true
COPY src ./src
RUN mvn -B -ntp -DskipTests package

# ── Stage 2: runtime ──
FROM eclipse-temurin:25-jre-alpine
WORKDIR /app
COPY --from=builder /build/target/quarkus-app/ /app/

EXPOSE 8080
ENV JAVA_OPTS="-Xms128m -Xmx512m"

ENTRYPOINT ["java", "-jar", "/app/quarkus-run.jar"]
