# Fast Single-Stage Dockerfile for HackHub
FROM eclipse-temurin:21-jdk-alpine

WORKDIR /app

# Copy Maven wrapper & project files
COPY pom.xml mvnw ./
COPY .mvn .mvn
COPY src src

# Make Maven wrapper executable and build executable jar
RUN chmod +x mvnw
RUN ./mvnw clean package -DskipTests

# Expose port and start
EXPOSE 8085
CMD ["java", "-jar", "target/hackhub-1.0.0.jar"]
