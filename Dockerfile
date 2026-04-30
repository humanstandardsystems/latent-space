FROM node:22-slim

# build tools needed for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# install pnpm, tsx, and node-gyp globally
RUN npm install -g pnpm tsx node-gyp

WORKDIR /app

# copy workspace manifests and lockfile (lockfile ensures exact versions are installed)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/

# install all dependencies (skip lifecycle scripts — we compile better-sqlite3 manually below)
RUN pnpm install --frozen-lockfile --ignore-scripts

# explicitly compile better-sqlite3 native addon for this platform
RUN cd /app/node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3 && node-gyp rebuild --release

# copy source
COPY . .

# build the web frontend (output goes to apps/web/dist, served by server)
RUN pnpm --filter @latent-space/web build

EXPOSE 3000

CMD ["tsx", "apps/server/src/index.ts"]
