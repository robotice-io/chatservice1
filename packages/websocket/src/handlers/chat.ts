import { Server, Socket } from 'socket.io';
import { OpenAI } from 'openai';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Validation schemas
const joinSchema = z.object({
  widgetId: z.string(),
  visitorId: z.string(),
  conversationId: z.string().optional(),
});

const messageSchema = z.object({
  conversationId: z.string(),
  content: z.string().min(1).max(4000),
});

const typingSchema = z.object({
  conversationId: z.string(),
  isTyping: z.boolean(),
});

interface SocketData {
  widgetId: string;
  visitorId: string;
  conversationId: string | null;
}

export function setupChatHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    const socketData: SocketData = {
      widgetId: '',
      visitorId: '',
      conversationId: null,
    };

    // Join a chat room
    socket.on('chat:join', async (data: unknown) => {
      try {
        const parsed = joinSchema.parse(data);
        
        socketData.widgetId = parsed.widgetId;
        socketData.visitorId = parsed.visitorId;
        socketData.conversationId = parsed.conversationId || `cnv_${Date.now()}`;

        // Join the conversation room
        socket.join(socketData.conversationId);
        
        socket.emit('chat:joined', {
          conversationId: socketData.conversationId,
          status: 'connected',
        });

        console.log(`Visitor ${parsed.visitorId} joined conversation ${socketData.conversationId}`);
      } catch (error) {
        socket.emit('chat:error', {
          code: 'INVALID_DATA',
          message: 'Invalid join data',
        });
      }
    });

    // Handle incoming messages
    socket.on('chat:message', async (data: unknown) => {
      try {
        const parsed = messageSchema.parse(data);
        
        if (!socketData.conversationId) {
          socket.emit('chat:error', {
            code: 'NOT_JOINED',
            message: 'Must join a conversation first',
          });
          return;
        }

        // Broadcast user message to room (for operator dashboards)
        io.to(parsed.conversationId).emit('chat:message:received', {
          id: `msg_${Date.now()}`,
          conversationId: parsed.conversationId,
          role: 'user',
          content: parsed.content,
          createdAt: new Date().toISOString(),
        });

        // Get AI response with streaming
        await streamAIResponse(socket, parsed.conversationId, parsed.content);

      } catch (error) {
        console.error('Message error:', error);
        socket.emit('chat:error', {
          code: 'MESSAGE_ERROR',
          message: 'Failed to process message',
        });
      }
    });

    // Typing indicators
    socket.on('chat:typing', (data: unknown) => {
      try {
        const parsed = typingSchema.parse(data);
        
        // Broadcast to others in the room
        socket.to(parsed.conversationId).emit('chat:typing:update', {
          visitorId: socketData.visitorId,
          isTyping: parsed.isTyping,
        });
      } catch (error) {
        // Silently ignore invalid typing events
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}

async function streamAIResponse(
  socket: Socket,
  conversationId: string,
  userMessage: string
) {
  try {
    // Signal that AI is "typing"
    socket.emit('chat:typing:update', {
      visitorId: 'assistant',
      isTyping: true,
    });

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful customer support assistant. Be concise, friendly, and helpful.',
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      stream: true,
      max_tokens: 500,
    });

    let fullResponse = '';
    const messageId = `msg_${Date.now()}`;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        
        // Stream chunk to client
        socket.emit('chat:agent:streaming', {
          conversationId,
          messageId,
          chunk: content,
        });
      }
    }

    // Signal completion
    socket.emit('chat:typing:update', {
      visitorId: 'assistant',
      isTyping: false,
    });

    // Send complete message
    socket.emit('chat:agent:complete', {
      conversationId,
      messageId,
    });

    // Also emit as regular message for consistency
    socket.emit('chat:message:received', {
      id: messageId,
      conversationId,
      role: 'assistant',
      content: fullResponse,
      createdAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('AI streaming error:', error);
    
    socket.emit('chat:typing:update', {
      visitorId: 'assistant',
      isTyping: false,
    });

    socket.emit('chat:error', {
      code: 'AI_ERROR',
      message: 'Failed to get AI response',
    });
  }
}

