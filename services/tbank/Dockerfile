FROM rust:1.83-slim-bookworm AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y pkg-config libssl-dev curl && rm -rf /var/lib/apt/lists/*
RUN rustup default nightly

# Copy workspace files
COPY Cargo.toml ./
COPY shared ./shared
COPY tbank-integration ./tbank-integration

RUN cargo build --release --package tbank-integration

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM debian:bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y ca-certificates libssl3 curl tzdata && rm -rf /var/lib/apt/lists/*

ENV TZ=Europe/Moscow
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

COPY --from=builder /app/target/release/tbank-integration /app/billing-svc

RUN useradd -r -s /bin/false billing && chown -R billing:billing /app
USER billing

EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8090/health || exit 1

CMD ["./billing-svc"]
