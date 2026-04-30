FROM node:22-slim

# build tools needed for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# install pnpm
RUN npm install -g pnpm tsx

WORKDIR /app

# copy workspace manifests first (better layer caching)
COPY package.json pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/

# install all dependencies
RUN pnpm install

# copy source
COPY . .

# build the web frontend (output goes to apps/web/dist, served by server)
RUN pnpm --filter @latent-space/web build

EXPOSE 3000

CMD ["tsx", "apps/server/src/index.ts"]
