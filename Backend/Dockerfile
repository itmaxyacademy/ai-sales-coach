# ─────────────────────────────────────────────
# Stage 1: Builder
# ─────────────────────────────────────────────
# Pakai debian-slim (bukan alpine) karena onnxruntime-node butuh glibc
# Alpine pakai musl → ld-linux-aarch64.so.1 tidak ada → crash di ARM64 VPS
FROM node:22-slim AS builder

# Install build tools for native modules (e.g. @xenova/transformers)
RUN apt-get update && apt-get install -y python3 make g++ libvips-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDependencies for tsc)
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy the rest of the source code
COPY . .

# Compile TypeScript → dist/
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Runner
# ─────────────────────────────────────────────
FROM node:22-slim AS runner

# Install runtime libs needed by native bindings
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only what is needed at runtime
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose the application port (default 5000)
EXPOSE 5000

# Set NODE_ENV to production
ENV NODE_ENV=production

# Sync schema ke database lalu start server
# prisma migrate deploy: jalankan semua migration baru secara aman, lalu start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]

