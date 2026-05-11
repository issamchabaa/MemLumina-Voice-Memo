export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

export interface LedgerPayload {
  source: string;
  memoId: string;
  captureMode: string;
  audioStoragePath: string;
  transcriptText: string;
  transcriptProvider?: string;
  transcriptModel?: string;
  transcriptLanguage?: string;
  transcriptConfidence?: number | null;
  submittedFrom: string;
  reviewedByUser: boolean;
  capturedAt: string;
  submittedAt?: string;
}

export interface RawTurn {
  id: string;
  userId?: string;
  ledgerStreamId: string;
  conversationId: string;
  turnId: string;
  sequenceNumber: number;
  messages: Message[];
  toolCalls: any[];
  attachments: any[];
  contentHash: string;
  previousHash: string | null;
  createdAt: string; // ISO String
  sealed: boolean;
  schemaVersion: number;
  metadata?: Record<string, any>;
}

export interface ClerkJob {
  id: string;
  userId?: string;
  rawTurnId: string;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}
