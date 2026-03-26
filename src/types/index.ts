// src/types/index.ts

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  photo: string | null;
}

// PDF related types
export interface PDF {
  id: number;
  filename: string;
  original_name: string;
  upload_date: string;
  page_range_start: number;
  page_range_end: number | null;
  chunk_count: number;
  chat_active: boolean;
  last_chat_at: string | null;
  message_count: number;
  has_chat_history: boolean;
}

// Chat message types
export interface ChatMessage {
  id: number;
  pdf_id: number;
  message_type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources_used?: number;
  context_used?: boolean;
}

// API response types
export interface DatabaseStatusResponse {
  success: boolean;
  has_data: boolean;
  message: string;
  error?: string;
  system_type?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface UploadPDFResponse {
  success: boolean;
  message: string;
  filename: string;
  pdf_id: number;
  chunk_count: number;
  chat_ready: boolean;
  page_range: string;
  error?: string;
}

export interface ChatResponse {
  success: boolean;
  response: string;
  context_used: boolean;
  sources_count: number;
  pdf_name: string;
  debug_info?: {
    question_embedding_obtained: boolean;
    total_context_parts: number;
    search_method: string;
  };
  error?: string;
}

export interface PDFListResponse {
  success: boolean;
  pdfs: PDF[];
  error?: string;
}

export interface ChatHistoryResponse {
  success: boolean;
  messages: ChatMessage[];
  message_count: number;
  error?: string;
}

export interface DeletePDFResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface ClearChatResponse {
  success: boolean;
  message: string;
  deleted_count: number;
  error?: string;
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface ForgotPasswordForm {
  email: string;
}

export interface ForgotUsernameForm {
  recoveryMethod: 'email' | 'phone';
  value: string;
}

export interface UploadForm {
  file: any;
  startPage: string;
  endPage: string;
}

// Navigation types (these will be imported in App.tsx)
export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  ForgotUsername: undefined;
};

export type MainStackParamList = {
  Home: undefined;
  FileUpload: undefined;
  PDFLibrary: undefined;
  Chat: { pdf: PDF };
};

export type TabParamList = {
  HomeTab: undefined;
  UploadTab: undefined;
  LibraryTab: undefined;
};

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
}

// Constants
export const API_ENDPOINTS = {
  BASE_URL: 'http://192.168.0.18:5000',
  HEALTH: '/api/health',
  DATABASE_STATUS: '/api/database-status',
  INIT_DB: '/api/init-db',
  CLEAR_DB: '/api/clear-db',
  UPLOAD_PDF: '/api/upload-pdf',
  PDFS: '/api/pdfs',
  CHAT: '/api/chat',
  MESSAGES: '/api/pdf',
} as const;

export const STORAGE_KEYS = {
  USER_TOKEN: '@user_token',
  USER_DATA: '@user_data',
  LAST_PDF_ID: '@last_pdf_id',
} as const;

export const COLORS = {
  primary: '#2563eb',
  secondary: '#64748b',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#1f2937',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
} as const;