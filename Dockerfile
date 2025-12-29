# BE_core Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies with retry for network issues
RUN yarn install --frozen-lockfile --network-timeout 600000 || \
    yarn install --frozen-lockfile --network-timeout 600000

# Copy source code
COPY . .

# Build TypeScript
RUN yarn build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install fonts for PDF generation (Liberation fonts = Times New Roman compatible)
RUN apk add --no-cache \
    fontconfig \
    font-liberation \
    && fc-cache -f

# Copy package files
COPY package.json yarn.lock ./

# Install production dependencies only
RUN yarn install --frozen-lockfile --production --network-timeout 600000 || \
    yarn install --frozen-lockfile --production --network-timeout 600000

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy proto files (needed at runtime for gRPC)
COPY --from=builder /app/src/proto ./dist/proto

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/main.js"]
