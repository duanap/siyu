FROM node:24-alpine AS builder

ARG PNPM_REGISTRY=https://registry.npmjs.org

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.11.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/mobile-web/package.json apps/mobile-web/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY packages/ui-tokens/package.json packages/ui-tokens/package.json
RUN --mount=type=cache,id=siyu-pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && pnpm config set registry "$PNPM_REGISTRY" && \
    pnpm install --frozen-lockfile --fetch-timeout=600000 --network-concurrency=4

COPY apps/mobile-web apps/mobile-web
COPY apps/admin-web apps/admin-web
COPY packages/ui-tokens packages/ui-tokens
RUN pnpm --filter @siyu/mobile-web build
RUN pnpm --filter @siyu/admin-web build

FROM nginx:1.27-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/apps/mobile-web/dist /usr/share/nginx/html
COPY --from=builder /workspace/apps/admin-web/dist /usr/share/nginx/html/admin
EXPOSE 80
