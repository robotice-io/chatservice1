import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from './routes/auth.js';
import { widgetRoutes } from './routes/widgets.js';
import { conversationRoutes } from './routes/conversations.js';
import { embedRoutes } from './routes/embed.js';
import { healthRoutes } from './routes/health.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Register plugins
  await app.register(cors, {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Register routes
  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(widgetRoutes, { prefix: '/api/widgets' });
  await app.register(conversationRoutes, { prefix: '/api/conversations' });
  await app.register(embedRoutes, { prefix: '/api/embed' });

  return app;
}

