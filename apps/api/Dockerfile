# Build stage
FROM node:22-slim AS builder
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/api-zod/package.json packages/api-zod/
COPY packages/api-client-react/package.json packages/api-client-react/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
WORKDIR /workspace/apps/web
ARG VITE_CLERK_PUBLISHABLE_KEY=pk_test_placeholder
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
RUN pnpm build
WORKDIR /workspace/apps/api
RUN pnpm build
RUN cp -R /workspace/apps/web/dist/public ./dist/public


# Runtime stage
FROM node:22-slim AS runtime
WORKDIR /usr/src/app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=builder /workspace/apps/api/dist ./dist
COPY --from=builder /workspace/apps/api/node_modules ./node_modules
COPY --from=builder /workspace/apps/api/package.json ./package.json
EXPOSE 4000
ENV NODE_ENV=production
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
