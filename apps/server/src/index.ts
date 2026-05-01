import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyWs from '@fastify/websocket';
import { createDb, runMigrations, seedSubstances } from '@latent-space/db';
import { fileURLToPath } from 'url';
import { dirname, resolve, extname } from 'path';
import { createReadStream, existsSync, statSync } from 'fs';
import { env } from './env.js';

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};
import { authRoutes } from './auth.js';
import { apiRoutes } from './routes/api.js';
import { wsRoutes } from './ws.js';
import { startEarnLoop } from './earn.js';
import { getAccountFromToken } from './sessions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

declare module 'fastify' {
  interface FastifyRequest {
    account: { id: string; email: string; isDj: boolean; createdAt: Date } | null;
  }
}

async function main() {
  const db = createDb(env.DATABASE_URL);

  runMigrations(db);
  await seedSubstances(db);
  console.log('db ready');

  const app = Fastify({ logger: { level: 'info' } });

  await app.register(fastifyCors, {
    origin: env.CLIENT_URL,
    credentials: true,
  });

  await app.register(fastifyCookie, {
    secret: env.SESSION_SECRET,
  });

  await app.register(fastifyWs);

  // session middleware — attach account to every request
  app.addHook('preHandler', async (req) => {
    const token = req.cookies['session'];
    req.account = token ? await getAccountFromToken(token, db) : null;
  });

  // routes
  await authRoutes(app, db);
  await apiRoutes(app, db);
  await wsRoutes(app, db);

  // health
  app.get('/health', async () => ({ ok: true }));

  // serve web frontend in production (no @fastify/static needed)
  const webDist = resolve(__dirname, '../../web/dist');
  if (existsSync(webDist)) {
    app.setNotFoundHandler(async (req, reply) => {
      const reqPath = req.url.split('?')[0];
      const candidate = resolve(webDist, reqPath.replace(/^\//, ''));
      const isFile = candidate.startsWith(webDist) && existsSync(candidate) && statSync(candidate).isFile();
      const target = isFile ? candidate : resolve(webDist, 'index.html');
      reply.type(MIME[extname(target)] ?? 'application/octet-stream');
      return reply.send(createReadStream(target));
    });
  }

  startEarnLoop(db);

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`server listening on :${env.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
