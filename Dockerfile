# Multi-stage Docker build for HackHub Spring Boot Application
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app

# Copy maven wrapper & pom.xml
COPY pom.xml .
COPY .mvn .mvn
COPY mvnw .

# Download dependencies
RUN ./mvnw dependency:go-offline -B || true

# Copy source code and build package
COPY src src
RUN ./mvnw clean package -DskipTests

# Stage 2: Runtime Image
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Copy compiled jar from builder
COPY --from=builder /app/target/hackhub-1.0.0.jar app.jar

# Create uploads directory
RUN mkdir -p uploads/posters

EXPOSE 8085
ENTRYPOINT ["java", "-jar", "app.jar"]
