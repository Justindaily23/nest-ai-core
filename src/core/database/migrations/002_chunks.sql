-- ---------------------------------------------------------------------------
-- 2. CHUNKS TABLE: Deterministic Structural Truth Layer
-- ---------------------------------------------------------------------------
-- Stores the text units emitted by the hierarchical token chunker.
-- Acts as the physical target for both parent context windows and child nodes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chunks (
    -- Deterministic text string hash mapping absolute position offsets.
    id TEXT PRIMARY KEY,
    
    -- Re-enforces tenant boundary isolation rules directly on data slices.
    tenant_id UUID NOT NULL,
    
    -- Hard reference to source file. Deleting a document instantly wipes its chunks.
    source_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    
    -- System discriminator role checking semantic assignments.
    role TEXT NOT NULL CHECK (role IN ('PARENT', 'CHILD')),
    
    -- The raw un-truncated text segment passed to vector models or LLM windows.
    content TEXT NOT NULL,
    
    -- Precise token metrics gathered via the tiktoken compilation layer.
    token_count INTEGER NOT NULL,
    
    -- Zero-based index counter preserving original file chronological flow.
    position INTEGER NOT NULL,
    
    -- Self-referencing link tying high-precision child rows back to parent context frames.
    parent_chunk_id TEXT REFERENCES chunks(id),
    
    -- Generic field bag storing local parent page maps or document tables headers.
    metadata JSONB,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

       -- Exposes the composite key required by the downstream embedding layer.
    CONSTRAINT uq_chunks_id_tenant UNIQUE (id, tenant_id)
    
);

-- INDEXES: Chunk Layer Optimization
-- High-speed data isolation filter index.
CREATE INDEX idx_chunks_tenant ON chunks (tenant_id);

CREATE INDEX idx_chunks_content_fts 
ON chunks USING GIN (to_tsvector('english', content));

-- Optimizes hierarchical context lookups by sorting matching text slices instantly.
CREATE INDEX idx_chunks_source ON chunks (source_id, role, position);

-- Optimizes child-to-parent graph lookup scans while ignoring parent rows.
CREATE INDEX idx_chunks_parent ON chunks (parent_chunk_id) WHERE parent_chunk_id IS NOT NULL;

