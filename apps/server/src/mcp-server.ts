// MCP entry point — starts Fastify (logging to stderr) + MCP server on stdio
// Usage: tsx src/mcp-server.ts
// Claude MCP config: { "command": "tsx", "args": ["src/mcp-server.ts"], "env": { "SESSION_TOKEN": "..." } }
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
import { startMcpServer } from './mcp.js';

declare module 'fastify' {
  interface FastifyRequest {
    account: { id: string; email: string; isDj: boolean; createdAt: Date } | null;
  }
}

async function main() {
  const db = createDb(env.DATABASE_URL);
  runMigrations(db);

  // Log to stderr so stdout stays clean for MCP protocol
  const app = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino/file',
        options: { destination: 2 },
      },
    },
  });

  await app.register(fastifyCors, { origin: env.CLIENT_URL, credentials: true });
  await app.register(fastifyCookie, { secret: env.SESSION_SECRET });
  await app.register(fastifyWs);

  app.addHook('preHandler', async (req) => {
    const token = req.cookies['session'];
    req.account = token ? await getAccountFromToken(token, db) : null;
  });

  await authRoutes(app, db);
  await apiRoutes(app, db);
  await wsRoutes(app, db);
  app.get('/health', async () => ({ ok: true }));

  await app.listen({ port: env.PORT, host: '0.0.0.0' });

  // Start MCP server on stdio (stdout/stdin)
  await startMcpServer(db);
}

main().catch((err) => {
  process.stderr.write(String(err) + '\n');
  process.exit(1);
});
