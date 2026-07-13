FROM node:24-alpine AS builder

ARG PNPM_REGISTRY=https://registry.npmjs.org

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.11.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/ui-tokens/package.json packages/ui-tokens/package.json
RUN --mount=type=cache,id=siyu-pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && pnpm config set registry "$PNPM_REGISTRY" && \
    pnpm install --frozen-lockfile --fetch-timeout=600000 --network-concurrency=4

COPY apps/api apps/api
COPY packages packages
RUN pnpm --filter @siyu/api prisma:generate
RUN pnpm --filter @siyu/api build
RUN pnpm --filter @siyu/api deploy --prod --legacy /deploy
RUN source_client="$(readlink -f apps/api/node_modules/@prisma/client)" && \
    deploy_client="$(readlink -f /deploy/node_modules/@prisma/client)" && \
    cp -R "$(dirname "$(dirname "$source_client")")/.prisma" \
      "$(dirname "$(dirname "$deploy_client")")/.prisma"

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /deploy ./
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
