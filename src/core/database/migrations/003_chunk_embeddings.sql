-- ---------------------------------------------------------------------------
--  CHUNK EMBEDDINGS TABLE: Model-Dependent Vector Projections
-- ---------------------------------------------------------------------------
-- Stores the isolated, high-dimensional floating-point coordinates.
-- This table is built to be volatile; vectors can be cleared and replaced anytime.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chunk_embeddings (
    -- Auto-generated identity key specific to the vector data matrix row.
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Strict tenant context validation anchor.
    tenant_id UUID NOT NULL,
    
    chunk_id TEXT NOT NULL,
    
    -- Stores specific AI generator names to allow multi-model side-by-side execution.
    model TEXT NOT NULL,
    
    -- 1,536 dimensions matches industry standards (OpenAI text-embedding-3-small).
    embedding vector(1536) NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Database-level tenant isolation safety circuit breaker.
    -- Binds directly to the uq_chunks_id_tenant composite key we just created.
    CONSTRAINT fk_chunk_embeddings_tenant_safety
        FOREIGN KEY (chunk_id, tenant_id)
        REFERENCES chunks(id, tenant_id)
        ON DELETE CASCADE
);

-- INDEXES: Vector Layer Optimization
-- Enforces customer isolation boundaries during high-recall mathematical sweeps.
CREATE UNIQUE INDEX idx_embeddings_tenant_chunk_model ON chunk_embeddings (tenant_id, chunk_id, model);

-- SCALING SEARCH INDEX (Configured here via IVFFlat for basic batch validation)
-- Note: Re-evaluate this into a CONCURRENT HNSW graph index during Phase 3.7 scale-up.
CREATE INDEX idx_embeddings_vector 
ON chunk_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);
