FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# resvg needs real fonts on disk; without these, text renders as blank glyphs
RUN apk add --no-cache fontconfig font-dejavu
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
USER node
ENTRYPOINT ["node", "dist/index.js"]
