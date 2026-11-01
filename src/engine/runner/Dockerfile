# Image used as the sandbox for running untrusted submissions.
# Build: pnpm runner:build   (tag: oj-runner:latest)
FROM debian:bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      g++ gcc python3 openjdk-17-jdk-headless nodejs time coreutils \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /box
CMD ["sleep", "infinity"]
