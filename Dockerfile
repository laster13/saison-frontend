FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

ENV NODE_ENV=production

ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown

RUN PACKAGE_VERSION="$(node -p "require('./package.json').version || '0.0.0'")" && \
    echo "{\"version\":\"${PACKAGE_VERSION}\",\"commit\":\"${GIT_SHA}\",\"buildDate\":\"${BUILD_DATE}\"}" > version.json

RUN npm run build

RUN npm prune --omit=dev


FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/version.json ./version.json

EXPOSE 3000

CMD ["node", "build"]