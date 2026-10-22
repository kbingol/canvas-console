FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
RUN npx --yes npm@10.9.8 ci

COPY tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api
RUN npm run build --workspace @canvas-console/api

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    APP_MODE=firebase \
    HOST=0.0.0.0 \
    PORT=8080

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/package.json
RUN npx --yes npm@10.9.8 ci --omit=dev --workspace @canvas-console/api --include-workspace-root=false

COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
USER node
EXPOSE 8080
CMD ["node", "apps/api/dist/index.js"]
