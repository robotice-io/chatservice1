import { FastifyPluginAsync } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';

export const embedRoutes: FastifyPluginAsync = async (app) => {
  // Get widget config for embedding (public endpoint, validated by API key)
  app.get<{ Params: { widgetId: string }; Querystring: { apiKey: string } }>(
    '/:widgetId',
    async (request, reply) => {
      const { widgetId } = request.params;
      const { apiKey } = request.query;

      if (!apiKey) {
        return reply.status(401).send({
          success: false,
          error: { code: 'MISSING_API_KEY', message: 'API key required' },
        });
      }

      // Find widget
      const widget = await db.query.widgets.findFirst({
        where: eq(schema.widgets.id, widgetId),
      });

      if (!widget) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Widget not found' },
        });
      }

      // Verify API key belongs to widget's tenant
      const tenant = await db.query.tenants.findFirst({
        where: eq(schema.tenants.id, widget.tenantId),
      });

      if (!tenant || tenant.apiKey !== apiKey) {
        return reply.status(401).send({
          success: false,
          error: { code: 'INVALID_API_KEY', message: 'Invalid API key' },
        });
      }

      if (!widget.isActive) {
        return reply.status(403).send({
          success: false,
          error: { code: 'WIDGET_INACTIVE', message: 'Widget is not active' },
        });
      }

      // Return public widget config (no sensitive data)
      return {
        success: true,
        data: {
          id: widget.id,
          name: widget.name,
          config: widget.config,
        },
      };
    }
  );

  // Generate embed script
  app.get<{ Params: { widgetId: string } }>(
    '/:widgetId/script',
    {
      onRequest: [async (request, reply) => {
        try {
          await request.jwtVerify();
        } catch (err) {
          reply.send(err);
        }
      }],
    },
    async (request, reply) => {
      const { tenantId } = request.user as { tenantId: string };
      const { widgetId } = request.params;

      const widget = await db.query.widgets.findFirst({
        where: eq(schema.widgets.id, widgetId),
      });

      if (!widget || widget.tenantId !== tenantId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Widget not found' },
        });
      }

      const tenant = await db.query.tenants.findFirst({
        where: eq(schema.tenants.id, tenantId),
      });

      const baseUrl = process.env.WIDGET_CDN_URL || 'https://cdn.yourwidget.com';
      const wsUrl = process.env.WS_PUBLIC_URL || 'wss://ws.yourwidget.com';

      const embedScript = `
<!-- ChatWidget Embed Code -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['ChatWidget']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','cw','${baseUrl}/widget.js'));
  cw('init', {
    widgetId: '${widget.id}',
    apiKey: '${tenant?.apiKey}',
    wsUrl: '${wsUrl}'
  });
</script>
<!-- End ChatWidget Embed Code -->
      `.trim();

      return {
        success: true,
        data: {
          script: embedScript,
          widgetId: widget.id,
        },
      };
    }
  );
};

