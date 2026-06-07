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
    
    -- Link back to target text. Deleting text automatically clears vector records.
    chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    
    -- Stores specific AI generator names to allow multi-model side-by-side execution.
    model TEXT NOT NULL,
    
    -- 1,536 dimensions matches industry standards (OpenAI text-embedding-3-small).
    embedding vector(1536) NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES: Vector Layer Optimization
-- Enforces customer isolation boundaries during high-recall mathematical sweeps.
CREATE INDEX idx_embeddings_tenant ON chunk_embeddings (tenant_id);

-- Links database text fetches cleanly back to vector targets.
CREATE INDEX idx_embeddings_chunk ON chunk_embeddings (chunk_id);

-- Prevent duplicate embeddings for the same chunk + model pair
CREATE UNIQUE INDEX idx_embeddings_chunk_model
  ON chunk_embeddings (chunk_id, model);

-- SCALING SEARCH INDEX (Configured here via IVFFlat for basic batch validation)
-- Note: Re-evaluate this into a CONCURRENT HNSW graph index during Phase 3.7 scale-up.
CREATE INDEX idx_embeddings_vector 
ON chunk_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);
