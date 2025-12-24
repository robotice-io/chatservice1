import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { db, schema } from '../db/index.js';
import { createId } from '@chatwidget/shared';
import { eq } from 'drizzle-orm';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Register new tenant
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

    // Check if email exists
    const existing = await db.query.tenants.findFirst({
      where: eq(schema.tenants.email, body.email),
    });

    if (existing) {
      return reply.status(400).send({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'Email already registered' },
      });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const tenant = {
      id: createId.tenant(),
      email: body.email,
      passwordHash,
      companyName: body.companyName,
      apiKey: createId.apiKey(),
      plan: 'free' as const,
    };

    await db.insert(schema.tenants).values(tenant);

    const token = app.jwt.sign({ tenantId: tenant.id });

    return {
      success: true,
      data: {
        token,
        tenant: {
          id: tenant.id,
          email: tenant.email,
          companyName: tenant.companyName,
          plan: tenant.plan,
          apiKey: tenant.apiKey,
        },
      },
    };
  });

  // Login
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.email, body.email),
    });

    if (!tenant) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    const validPassword = await bcrypt.compare(body.password, tenant.passwordHash);
    if (!validPassword) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    const token = app.jwt.sign({ tenantId: tenant.id });

    return {
      success: true,
      data: {
        token,
        tenant: {
          id: tenant.id,
          email: tenant.email,
          companyName: tenant.companyName,
          plan: tenant.plan,
          apiKey: tenant.apiKey,
        },
      },
    };
  });

  // Get current tenant (requires auth)
  app.get('/me', {
    onRequest: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    }],
  }, async (request) => {
    const { tenantId } = request.user as { tenantId: string };
    
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, tenantId),
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    return {
      success: true,
      data: {
        id: tenant.id,
        email: tenant.email,
        companyName: tenant.companyName,
        plan: tenant.plan,
        apiKey: tenant.apiKey,
      },
    };
  });
};

