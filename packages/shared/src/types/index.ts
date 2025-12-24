// ============================================
// Tenant / SaaS Customer Types
// ============================================

export interface Tenant {
  id: string;
  email: string;
  companyName: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  apiKey: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Widget Types
// ============================================

export interface Widget {
  id: string;
  tenantId: string;
  name: string;
  domain: string;
  isActive: boolean;
  config: WidgetConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetConfig {
  theme: WidgetTheme;
  welcomeMessage: string;
  aiInstructions: string;
  position: 'bottom-right' | 'bottom-left';
  showBranding: boolean;
}

export interface WidgetTheme {
  primaryColor: string;
  textColor: string;
  backgroundColor: string;
  fontFamily: string;
}

// ============================================
// Conversation Types
// ============================================

export interface Conversation {
  id: string;
  widgetId: string;
  visitorId: string;
  status: 'active' | 'closed' | 'archived';
  metadata: Record<string, unknown>;
  startedAt: Date;
  endedAt: Date | null;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokensUsed: number | null;
  createdAt: Date;
}

// ============================================
// Visitor Types
// ============================================

export interface Visitor {
  id: string;
  widgetId: string;
  fingerprint: string;
  metadata: VisitorMetadata;
  firstSeen: Date;
  lastSeen: Date;
}

export interface VisitorMetadata {
  userAgent?: string;
  referrer?: string;
  pageUrl?: string;
  country?: string;
  city?: string;
}

// ============================================
// WebSocket Event Types
// ============================================

export interface WsEvents {
  // Client -> Server
  'chat:join': { conversationId: string; visitorId: string };
  'chat:message': { conversationId: string; content: string };
  'chat:typing': { conversationId: string; isTyping: boolean };
  
  // Server -> Client
  'chat:message:received': Message;
  'chat:typing:update': { visitorId: string; isTyping: boolean };
  'chat:agent:streaming': { conversationId: string; chunk: string };
  'chat:agent:complete': { conversationId: string; messageId: string };
  'chat:error': { code: string; message: string };
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

