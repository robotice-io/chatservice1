import { FastifyPluginAsync } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq, and, desc } from 'drizzle-orm';

export const conversationRoutes: FastifyPluginAsync = async (app) => {
  // Auth middleware
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // List conversations for tenant's widgets
  app.get('/', async (request) => {
    const { tenantId } = request.user as { tenantId: string };

    // Get tenant's widgets first
    const widgets = await db.query.widgets.findMany({
      where: eq(schema.widgets.tenantId, tenantId),
    });

    const widgetIds = widgets.map((w) => w.id);

    if (widgetIds.length === 0) {
      return { success: true, data: [] };
    }

    // Get conversations for those widgets
    const conversations = await db.query.conversations.findMany({
      where: (conversations, { inArray }) => inArray(conversations.widgetId, widgetIds),
      orderBy: [desc(schema.conversations.startedAt)],
      limit: 50,
    });

    return { success: true, data: conversations };
  });

  // Get single conversation with messages
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string };
    const { id } = request.params;

    const conversation = await db.query.conversations.findFirst({
      where: eq(schema.conversations.id, id),
    });

    if (!conversation) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    // Verify ownership through widget
    const widget = await db.query.widgets.findFirst({
      where: and(
        eq(schema.widgets.id, conversation.widgetId),
        eq(schema.widgets.tenantId, tenantId)
      ),
    });

    if (!widget) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
    }

    // Get messages
    const messages = await db.query.messages.findMany({
      where: eq(schema.messages.conversationId, id),
      orderBy: (messages, { asc }) => [asc(messages.createdAt)],
    });

    return {
      success: true,
      data: {
        ...conversation,
        messages,
      },
    };
  });

  // Close conversation
  app.post<{ Params: { id: string } }>('/:id/close', async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string };
    const { id } = request.params;

    const conversation = await db.query.conversations.findFirst({
      where: eq(schema.conversations.id, id),
    });

    if (!conversation) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    // Verify ownership
    const widget = await db.query.widgets.findFirst({
      where: and(
        eq(schema.widgets.id, conversation.widgetId),
        eq(schema.widgets.tenantId, tenantId)
      ),
    });

    if (!widget) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
    }

    const updated = await db
      .update(schema.conversations)
      .set({ status: 'closed', endedAt: new Date() })
      .where(eq(schema.conversations.id, id))
      .returning();

    return { success: true, data: updated[0] };
  });
};

