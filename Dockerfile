FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build


FROM node:20-alpine AS runtime

RUN apk add --no-cache bash jq curl

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8001

WORKDIR /app

COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/version.json ./version.json

RUN ln -sfn /app /saison-frontend

EXPOSE 8001

CMD ["node", "build"]