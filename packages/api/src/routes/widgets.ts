import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { createId } from '@chatwidget/shared';
import { eq, and } from 'drizzle-orm';

const createWidgetSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  config: z.object({
    theme: z.object({
      primaryColor: z.string().default('#6366f1'),
      textColor: z.string().default('#1f2937'),
      backgroundColor: z.string().default('#ffffff'),
      fontFamily: z.string().default('Inter, sans-serif'),
    }).optional(),
    welcomeMessage: z.string().default('Hi! How can I help you today?'),
    aiInstructions: z.string().default('You are a helpful customer support assistant.'),
    position: z.enum(['bottom-right', 'bottom-left']).default('bottom-right'),
    showBranding: z.boolean().default(true),
  }).optional(),
});

const updateWidgetSchema = createWidgetSchema.partial();

export const widgetRoutes: FastifyPluginAsync = async (app) => {
  // Auth middleware for all widget routes
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // List widgets
  app.get('/', async (request) => {
    const { tenantId } = request.user as { tenantId: string };

    const widgets = await db.query.widgets.findMany({
      where: eq(schema.widgets.tenantId, tenantId),
      orderBy: (widgets, { desc }) => [desc(widgets.createdAt)],
    });

    return { success: true, data: widgets };
  });

  // Create widget
  app.post('/', async (request) => {
    const { tenantId } = request.user as { tenantId: string };
    const body = createWidgetSchema.parse(request.body);

    const defaultConfig = {
      theme: {
        primaryColor: '#6366f1',
        textColor: '#1f2937',
        backgroundColor: '#ffffff',
        fontFamily: 'Inter, sans-serif',
      },
      welcomeMessage: 'Hi! How can I help you today?',
      aiInstructions: 'You are a helpful customer support assistant.',
      position: 'bottom-right' as const,
      showBranding: true,
    };

    const widget = {
      id: createId.widget(),
      tenantId,
      name: body.name,
      domain: body.domain,
      config: { ...defaultConfig, ...body.config },
    };

    await db.insert(schema.widgets).values(widget);

    return { success: true, data: widget };
  });

  // Get single widget
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string };
    const { id } = request.params;

    const widget = await db.query.widgets.findFirst({
      where: and(
        eq(schema.widgets.id, id),
        eq(schema.widgets.tenantId, tenantId)
      ),
    });

    if (!widget) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Widget not found' },
      });
    }

    return { success: true, data: widget };
  });

  // Update widget
  app.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string };
    const { id } = request.params;
    const body = updateWidgetSchema.parse(request.body);

    const existing = await db.query.widgets.findFirst({
      where: and(
        eq(schema.widgets.id, id),
        eq(schema.widgets.tenantId, tenantId)
      ),
    });

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Widget not found' },
      });
    }

    const updated = await db
      .update(schema.widgets)
      .set({
        ...body,
        config: body.config ? { ...existing.config as object, ...body.config } : undefined,
        updatedAt: new Date(),
      })
      .where(eq(schema.widgets.id, id))
      .returning();

    return { success: true, data: updated[0] };
  });

  // Delete widget
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string };
    const { id } = request.params;

    const existing = await db.query.widgets.findFirst({
      where: and(
        eq(schema.widgets.id, id),
        eq(schema.widgets.tenantId, tenantId)
      ),
    });

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Widget not found' },
      });
    }

    await db.delete(schema.widgets).where(eq(schema.widgets.id, id));

    return { success: true, data: { deleted: true } };
  });
};

