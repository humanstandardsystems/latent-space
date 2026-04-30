import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyWs from '@fastify/websocket';
import { createDb, runMigrations } from '@latent-space/db';
import { env } from './env.js';
import { authRoutes } from './auth.js';
import { apiRoutes } from './routes/api.js';
import { wsRoutes } from './ws.js';
import { getAccountFromToken } from './sessions.js';

declare module 'fastify' {
  interface FastifyRequest {
    account: { id: string; email: string; isDj: boolean; createdAt: Date } | null;
  }
}

async function main() {
  const db = createDb(env.DATABASE_URL);

  runMigrations(db);
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

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`server listening on :${env.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
