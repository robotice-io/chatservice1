import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { setupChatHandlers } from './handlers/chat.js';

const PORT = parseInt(process.env.WS_PORT || '3001', 10);

async function start() {
  const httpServer = createServer();
  
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Setup Redis adapter for horizontal scaling
  if (process.env.REDIS_URL) {
    const pubClient = new Redis(process.env.REDIS_URL);
    const subClient = pubClient.duplicate();
    
    io.adapter(createAdapter(pubClient, subClient));
    console.log('📡 Redis adapter connected');
  }

  // Setup handlers
  setupChatHandlers(io);

  // Start server
  httpServer.listen(PORT, () => {
    console.log(`🔌 WebSocket server running on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Shutting down WebSocket server...');
    io.close();
    httpServer.close();
    process.exit(0);
  });
}

start().catch(console.error);

