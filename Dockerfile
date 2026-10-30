# syntax=docker/dockerfile:1

# 1) Build: instala as dependencias e gera o site estatico em /app/dist
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# 2) Servidor: Node sem dependencias (site + login + API + SQLite embutido no Node)
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DB_PATH=/data/controle.db
COPY --from=build /app/dist ./dist
COPY server/index.mjs server/banco.mjs server/usuarios.mjs ./server/
RUN mkdir -p /data && chown node:node /data
USER node
# O banco (usuarios e dados) mora aqui: monte um volume, senao tudo some quando o container for trocado.
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "server/index.mjs"]
