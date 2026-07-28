FROM rust:1.83-slim-bookworm as builder
WORKDIR /app
RUN apt-get update && apt-get install -y pkg-config libssl-dev curl && rm -rf /var/lib/apt/lists/*
# Установка nightly для поддержки edition2024
RUN rustup default nightly
COPY Cargo.toml Cargo.lock ./
COPY shared ./shared
COPY challenge-engine ./challenge-engine
COPY erir-integration ./erir-integration
COPY billing-engine ./billing-engine
COPY tbank-integration ./tbank-integration
COPY api-export-tool ./api-export-tool
RUN cargo build --release --package tbank-integration

FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y ca-certificates libssl3 curl tzdata && rm -rf /var/lib/apt/lists/*
# Установка московского времени
ENV TZ=Europe/Moscow
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
COPY --from=builder /app/target/release/tbank-integration /app/tbank-integration
RUN useradd -r -s /bin/false tbank && chown -R tbank:tbank /app
USER tbank
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 CMD curl -f http://localhost:8080/health || exit 1
EXPOSE 8080
CMD ["./tbank-integration"]
