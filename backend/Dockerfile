# syntax=docker/dockerfile:1
#
# Slim backend image (no Spark). The Spark maintenance executor is unavailable here;
# use Dockerfile.spark for real rewrite_data_files. See Dockerfile.spark for the
# Spark-enabled variant.

# ── Stage 1: build the Quarkus app ──
FROM maven:3.9-eclipse-temurin-21 AS builder
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
