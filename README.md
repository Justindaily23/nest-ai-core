# Nest AI Core (nest-ai-core)

A production-grade, highly resilient backend infrastructure engine designed for secure, multi-tenant enterprise AI integrations. Built using NestJS, TypeScript, PostgreSQL, and Redis.

---

## Architectural Core Intent

Most AI software integrations fail in production due to vendor lock-in, loose data governance, unmitigated token inflation, and fatal API fragility under high concurrent loads.

`nest-ai-core` is an **industrial blueprint** engineered specifically to resolve these production challenges for SMEs and high-growth startups. It decouples core business logic from volatile upstream AI providers, transforming raw artificial intelligence access into a predictable, highly safe, and cost-contained utility.

## System Architecture Pillars

```text
       [ Enterprise Client / Mobile API Traffic ]
                          │
                          ▼
            [ Interceptors & Auth Guards ]
         (RBAC Enforcement + Token Cost Audit)
                          │
                          ▼
                 [ NestJS Controllers ]
                          │
                          ▼
                [ Resilient Queue Layer ]
                  (Redis / BullMQ Buffer)
                          │
                          ▼
             [ Provider-Agnostic AI Layer ]
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
       [ OpenAI ]   [ Anthropic ]  [ Local Ollama ]
            │             │             │
            └─────────────┬─────────────┘
                          ▼
          [ PGVector RAG Knowledge Pipeline ]
```

### 1. Provider-Agnostic Orchestration

- **Engineering Reality:** The application infrastructure interfaces exclusively with a strict abstraction gateway (`AiProvider`).
- **Business Outcome:** Zero vendor lock-in. Upstream AI models can be hot-swapped dynamically via runtime configurations in milliseconds without modifications to application controllers or breaking downstream services.

### 2. Privacy-Centric, Access-Controlled RAG

- **Engineering Reality:** Ingested corporate knowledge files are deterministically chunked, transformed to vector coordinates, and mapped within an internal PostgreSQL database leveraging the `pgvector` extension. Retrieval engines enforce strict Role-Based Access Control (RBAC) prior to spatial search execution.
- **Business Outcome:** Complete compliance with local regulations (such as the Nigeria Data Protection Act - NDPA). Sensitive data is structurally cordoned off—unauthorized actors cannot manipulate prompt vectors to peek at privileged corporate records.

### 3. Industrial Shock Absorption & Cost Containment

- **Engineering Reality:** Long-running inference processes and payload streaming streams pass through a persistent Redis queue via `BullMQ`. Global interceptors evaluate token metrics pre- and post-execution, hard-capping transaction pipelines based on tenant configuration profiles.
- **Business Outcome:** Mitigates system failure under sudden spikes. If upstream providers drop off-network, requests back up safely in an internal queue executing structured exponential backoff retries rather than throwing fatal runtime execution boundaries to application end-users.

---

## System Reliability & Execution Boundaries

This system enforces hard operational guarantees at the transport and application layers to prevent silent failure modes common in AI-driven backends.

- **Fastify-native request timeouts** actively terminate stalled connections at the TCP level, preventing background execution leaks during long-running inference or vector search operations.
- **Structured system logging** is handled via `nestjs-pino`, separating baseline HTTP telemetry from higher-level business and AI metrics.
- **Global execution interceptors** track request lifecycles and execution latency without interfering with Fastify’s transport controls.
- **Centralized exception filtering** normalizes all runtime and transport errors into predictable API responses while preserving internal observability signals.

These boundaries ensure that dropped clients, upstream AI instability, or degraded dependencies cannot silently exhaust server resources.

## Execution Context & Trust Boundaries

_Inside of src/common/context_

All inbound requests — whether originating from HTTP controllers, internal services, background workers, or scheduled jobs — are executed under a strict, immutable `AppRequestContext`.

This context acts as the system’s execution passport and defines:

- Actor identity (human, system, or service)
- Tenant ownership and isolation boundaries
- Subscription tier and enforced hard limits
- Explicit system capabilities (feature and model access)
- Telemetry and audit metadata

No module is permitted to infer or fabricate execution context.
Context is propagated, narrowed, or enforced — never mutated.

This guarantees consistent authorization, billing enforcement, and observability across synchronous and asynchronous execution paths.

## Workers & Asynchronous Execution Model

Background workers are treated as first-class execution environments, not secondary pipelines.

Workers:

- Never bypass authorization, cost limits, or tenant isolation
- Always receive a serialized execution context alongside job payloads
- Execute the same provider-agnostic AI contracts as synchronous requests

This guarantees parity between real-time API traffic and deferred or long-running workloads.

## Tech Stack Foundations

- **Runtime:** Node.js (LTS) / TypeScript (Strict Mode Enforced)
- **Framework:** NestJS (Dependency Inversion, Strict Modularity)
- **Relational Storage:** PostgreSQL (System of Record)
- **In-Memory Buffer / Queue Manager:** Redis / BullMQ
- **Vector Engine:** PgVector Extension

---

## Local Development Orchestration

### Prerequisites

Ensure you have a cloud execution workspace running (e.g., GitHub Codespaces) or local installations of Node.js and Docker Compose.

### Environment Variables

Copy `.env.example`:

DATABASE_URL=
REDIS_URL=
AI_PROVIDER=
OPENAI_API_KEY=

### 1. Repository Provisioning

```bash
git clone https://github.com
cd nest-ai-core
npm install
```

### 2. Infrastructure Spin-up

Initialize isolated production containers for database and buffering pipelines cleanly in the background:

```bash
docker compose up -d
```

### 3. Execution Verification

Execute the local server application layout:

```bash
npm run start:dev
```

---

## 📄 License

Distributed under the MIT License. Review `LICENSE` inside the repository structure for explicit regulatory liability limitations.
