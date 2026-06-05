FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY target/quarkus-app/ /app/

EXPOSE 8080

ENV JAVA_OPTS="-Xms128m -Xmx512m"

ENTRYPOINT ["java", "-jar", "/app/quarkus-run.jar"]
