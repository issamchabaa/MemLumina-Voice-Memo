# Cognitive Ledger System (CLS) - Design Description and Data Structures
Monday , May 11, 2026


## 1. Introduction

The Cognitive Ledger System (CLS) is a purpose-built architectural spine integrated into MemLumina. It acts as an immutable, append-only system of record for all user and assistant interactions. Instead of relying solely on raw conversational context, CLS extracts, structures, and projects semantic meaning into a trusted ledger. This enables deterministic memory retrieval, temporal reasoning, contradiction resolution, and robust multi-user scaling.

## 2. Core Architecture

The CLS architecture is built around four primary tenets:
1. **Append-Only Spine**: Data is ingested as raw conversational turns and processed into immutable ledger events. Historical facts are never overwritten; state changes occur via supersession and correction events.
2. **Scoped Data Boundary**: CLS data is strictly isolated per tenant/user at the backend layer to guarantee multi-user privacy and security.
3. **Derived Projections & Snapshots**: Operational surfaces (commitments, reminders, open loops) are rebuildable materialized views projected from the immutable event spine.
4. **Controlled Retrieval**: A Memory Crawler leverages semantic indexes, keyword tokens, and projection states to inject highly relevant context back into the LLM prompt without overflowing context windows.

### 2.1 Component Flow
1. **Ingestion**: The product server captures authenticated `RawTurns` and queues a `ClerkJob`.
2. **Clerk Extraction**: The Clerk Worker processes `RawTurns` using an LLM to extract semantic `LedgerEvents` (facts, decisions, commitments) and `LedgerRelations`.
3. **Preprocessing**: The Preprocessor Worker computes vector embeddings (`EmbeddingRecords`), search tokens, and specialized materialized views (topic maps, entity timelines).
4. **Projection**: The Projection Worker evaluates the stream of `LedgerEvents` to build and update deterministic `CommitmentProjections`, `ReminderProjections`, and `LedgerSnapshots`.
5. **Retrieval**: During generation, the Crawler queries the semantic index, search tokens, and projections to construct a tightly scoped `MemoryResponsePack` for the LLM.

## 3. Data Structures

The following data structures define the collections used by the CLS within Firestore. They reside under scoped paths (e.g., `users/{userId}/cls/root/...`).

### 3.1 Foundational Ingestion

#### `RawTurn`
The foundational unit of interaction. Immutable and sealed.
```typescript
export interface RawTurn {
  id: string;
  userId?: string;
  ledgerStreamId: string;
  conversationId: string;
  turnId: string;
  sequenceNumber: number;         // Ordering guarantee
  messages: Message[];            // Array of user/assistant/tool messages
  toolCalls: any[];
  attachments: any[];
  contentHash: string;            // Integrity check
  previousHash: string | null;    // Cryptographic link to previous turn
  createdAt: string; 
  sealed: boolean;                // Cannot be mutated once sealed
  schemaVersion: number;
  metadata?: Record<string, any>;
}
```

#### `ClerkJob`
Worker queue document for processing raw turns.
```typescript
export interface ClerkJob {
  id: string;
  userId?: string;
  rawTurnId: string;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}
```

### 3.2 The Ledger Spine

#### `LedgerEvent`
A semantic fact, commitment, or decision extracted from a turn.
```typescript
export interface LedgerEvent {
  id: string;
  userId?: string;
  rawTurnId: string;
  eventType: LedgerEventType;       // e.g., FACT_ASSERTED, COMMITMENT, CORRECTION
  epistemicStatus: EpistemicStatus; // EXPLICIT, INFERRED, CONFIRMED, UNCERTAIN
  lifecycleStatus: LifecycleStatus; // ACTIVE, SUPERSEDED, RESOLVED
  canonicalText: string;            // The extracted fact
  summary: string;
  sourceAuthority: SourceAuthority; // USER, ASSISTANT, INFERENCE
  certaintyScore: number;
  importanceScore: number;
  entities: string[];               // Tagged entities
  topics: string[];                 // Tagged topics
  projects: string[];
  proposedRelations: Array<{ targetId: string; relationType: RelationType }>;
  payloadJSON: string;              // Specific payload for event type
  createdAt: string;
  schemaVersion: number;
}
```

#### `LedgerRelation`
Represents graph relationships between events.
```typescript
export interface LedgerRelation {
  id: string;
  userId?: string;
  sourceId: string;
  targetId: string;
  relationType: RelationType;       // e.g., SUPPORTS, CONTRADICTS, SUPERSEDES
  createdAt: string;
}
```

### 3.3 Ontology & Registries

#### `Entity` & `Topic`
Canonical registries for concepts and named entities.
```typescript
export interface Entity {
  id: string;
  userId?: string;
  canonicalName: string;
  aliases: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Topic {
  id: string;
  userId?: string;
  canonicalName: string;
  aliases: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
```

### 3.4 Indexes and Search

#### `EmbeddingRecord`
Stores Gemini vector embeddings for semantic retrieval.
```typescript
export interface EmbeddingRecord {
  id: string;
  userId?: string;
  nodeType: 'LedgerEvent' | 'Entity' | 'Topic' | 'RawTurn';
  nodeId: string;
  modelName: string;
  vector: number[];                 // High-dimensional vector
  chunkText: string;
  createdAt: string;
}
```

#### `SearchTokenRecord`
Keyword token sets for fast, exact-match retrieval filtering.
```typescript
export interface SearchTokenRecord {
  id: string;
  userId?: string;
  eventId: string;
  tokens: string[];
  createdAt: string;
}
```

### 3.5 Materialized Projections

Projections represent the "current active state" of mutable concepts without breaking the append-only invariant.

#### `CommitmentProjection` & `ReminderProjection` & `OpenLoopProjection`
```typescript
export interface CommitmentProjection {
  id: string;
  userId?: string;
  sourceEventIds: string[];         // Events forming this commitment
  latestEventId: string;
  lastRebuiltAt: string;
  projectionVersion: number;
  schemaVersion: number;
  description: string;
  status: string;
}

export interface ReminderProjection {
  id: string;
  userId?: string;
  sourceEventIds: string[];
  latestEventId: string;
  lastRebuiltAt: string;
  projectionVersion: number;
  schemaVersion: number;
  remindAt: string;                 // ISO time
  condition: string;                // Trigger condition
  status: string;
}

export interface OpenLoopProjection {
  id: string;
  userId?: string;
  sourceEventIds: string[];
  latestEventId: string;
  lastRebuiltAt: string;
  projectionVersion: number;
  schemaVersion: number;
  description: string;
  status?: string;
}
```

#### `LedgerSnapshot`
A point-in-time state of a given ledger scope, used to dramatically reduce crawler rebuild times for long-running contexts.
```typescript
export interface LedgerSnapshot {
  id: string;
  userId?: string;
  scopeType: string;
  scopeId: string;
  sourceEventIds: string[];
  latestEventId: string;
  lastRebuiltAt: string;
  projectionVersion: number;
  schemaVersion: number;
  snapshotData: Record<string, any>; // Flattened state tree
}
```

### 3.6 Background & Auditing

#### `ProcessingReceipt` & specialized Maps (`ProjectIndex`, `EntityTimeline`, `TopicMap`)
```typescript
export interface ProcessingReceipt {
  id: string;
  userId?: string;
  eventId: string;
  processorId: string;
  version: string;
  processedAt: string;
}
```

#### `ScrubberJob` & `ReviewQueueEntry`
Background tasks for consistency checks and resolving conflicting beliefs.
```typescript
export interface ScrubberJob {
  id: string;
  userId?: string;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  passes: ('INTEGRITY' | 'DEDUPLICATION' | 'CONTRADICTION' | 'SUPERSESSION')[];
  results?: {
    prunedEmbeddingCount?: number;
    mergedEventCount?: number;
    flaggedContradictionCount?: number;
    updatedProjectionCount?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ReviewQueueEntry {
  id: string;
  userId?: string;
  type: 'CONTRADICTION' | 'LOW_CONFIDENCE' | 'AMBIGUOUS_SUPERSESSION';
  subjectIds: string[];
  description: string;
  resolutionStatus: 'OPEN' | 'RESOLVED' | 'IGNORED';
  reasons?: Array<string>;
  confidenceBand?: 'high' | 'medium' | 'low' | 'critical';
  severity?: 'info' | 'warning' | 'critical';
  provisional?: boolean;
  certaintyScore?: number;
  resolvedByEventId?: string;
  createdAt: string;
  updatedAt: string;
}
```
