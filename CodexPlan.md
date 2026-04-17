
  # CodexPlan.md — AiMemory Next-Evolution Plan

  ## Summary

  This codebase is already materially better than upstream Claude-Mem in four verified ways:

  - It is no longer Claude-only in practice. The current tree has real integrations for Codex, Cursor, Gemini CLI,
    OpenCode, Windsurf, OpenClaw, and several MCP-only IDEs, while upstream positioning is still primarily Claude-
    centric.
  - It is cheaper by default. This fork defaults observation extraction to haiku, uses sonnet for summaries, and
    disables Chroma by default for simpler installs and lower cost.
  - It has cleaner provider architecture. Gemini and OpenRouter share a common REST-agent session loop, provider
    resolution is centralized, and OpenRouter assistant-history handling is fixed.
  - It is in strong mechanical health. Current local verification is 1376 pass / 79 skip / 0 fail on bun test, and bun
    run build succeeds.

  This project’s main weaknesses are now strategic and architectural, not basic correctness:

  - Branding, docs, and product framing still undersell the real system. The repo still presents as “Claude-Mem” even
    though the code is a broader multi-agent memory layer.
  - Cross-agent support is uneven. Some platforms have full capture plus context, some have transcript watching only,
    and MCP-only integrations provide search/context but no automatic capture.
  - Memory quality is still mostly “capture and retrieve,” not “canonicalize, evaluate, compress, and reason.” This is
    the biggest opportunity to beat the original decisively.
  - A few upstream pain points still appear live or high-risk in the current code:
      - Unix child-process cleanup still looks incomplete because getChildProcesses() returns [] outside Windows.
      - The Claude SDK startup race around “ProcessTransport not ready” still does not appear to have a retry wrapper.
      - Documentation drift remains real: README and several docs still describe a Claude-first product and historical
        architecture.

  Chosen direction for the roadmap

  - North star: local-first platform
  - Compatibility posture: hard fork
  - Product goal: make this the best local developer memory system for agent workflows, with lower token cost, higher
    recall/precision, and stronger cross-agent continuity than Claude-Mem

  ## Key Changes

  ### 1. Reposition the product as AiMemory, not “Claude-Mem but more”

  - Rebrand package, UI, docs, installer copy, viewer copy, API docs, and filesystem UX from claude-mem to AiMemory.
  - Move default data/config/runtime paths to ~/.aimemory, while shipping a one-time import/migration command that
    reads:
      - old SQLite data
      - old settings
      - old transcript-watch config
      - old integration registrations
  - Treat Claude-Mem compatibility as migration-only, not as a permanent architectural constraint.
  - Update README and docs so the product promise is explicit: shared memory across local AI tools, not only Claude
    Code.

  ### 2. Introduce a proper platform architecture with five explicit layers

  Build the project around these stable internal contracts:

  - Capture layer
      - Normalizes hooks, transcripts, plugins, and manual saves into one event format.
      - Add NormalizedEvent, AgentIdentity, WorkspaceIdentity, and CaptureAdapter interfaces.
  - Memory core
      - Stores raw events, extracted observations, summaries, and canonical memory entities separately.
      - Keep SQLite + FTS5 as the required local default.
      - Keep embeddings/vector search optional.
  - Retrieval layer
      - Produces context packs based on task type, budget, agent, workspace, and recency.
      - Add RetrievalPolicy and MemoryPack interfaces.
  - Context delivery layer
      - Converts memory packs into agent-native outputs such as AGENTS.md, CLAUDE.md, GEMINI.md, MCP responses, and
        viewer responses.
      - Add ContextAdapter interface so every client has one explicit writer/renderer contract.
  - Reasoning/quality layer
      - Scores, merges, deduplicates, compresses, and evaluates memory quality over time.
      - This is the largest functional differentiation from upstream.

  ### 3. Phase 1 roadmap: hard-fork cleanup and reliability baseline

  This phase makes the fork coherent and removes the highest-leverage regressions.

  - Rebrand and migrate paths to AiMemory, with a deliberate import path from ~/.claude-mem.
  - Fix or decisively close the remaining known reliability gaps:
      - implement Unix child-process enumeration and cleanup
      - add retry/backoff around Claude SDK startup for transport-readiness errors
      - audit cross-platform process-management paths and remove stale PM2-era assumptions from docs
  - Unify integration capability metadata:
      - every integration declares whether it supports capture, retrieval, context injection, streaming, and
        transcript replay
      - surface that status in UI and CLI
  - Replace current fragmented context-file logic with one workspace-scoped adapter model.
  - Add one source of truth for product/platform naming and supported integrations.

  ### 4. Phase 2 roadmap: memory-quality engine

  This is the most important step if the goal is to beat Claude-Mem on output quality rather than just feature
  breadth.

  - Split memory into four levels:
      - raw events
      - extracted observations
      - canonical facts/decisions/tasks/entities
      - session/project summaries
  - Add a canonicalization pass that merges repeated observations into stable memory units instead of storing every
    extraction as equally important.
  - Add confidence, freshness, provenance, and reuse counters to stored memory entities.
  - Add feedback hooks:
      - explicit keep/discard/edit for manual curation
      - implicit quality signals from repeated retrieval, reuse, or contradiction
  - Build a retrieval policy engine that chooses memory by:
      - token budget
      - current task type
      - agent/tool identity
      - workspace/project scope
      - freshness and confidence
  - Add “memory compaction” jobs that periodically:
      - merge near-duplicates
      - promote durable facts
      - demote noisy or stale fragments
      - generate higher-quality rolling summaries

  ### 5. Phase 3 roadmap: true cross-agent memory fabric

  Today the system supports many clients; the next step is making the memory itself portable and consistent across
  them.

  - Standardize session identity across platforms:
      - local agent session
      - workspace/project identity
      - human/user identity when applicable
      - memory graph identity
  - Store per-platform provenance but keep shared canonical memory cross-agent.
  - Add agent capability profiles so retrieval can differ by consumer:
      - Claude/Codex/Cursor/Gemini/OpenCode should not all receive identical context payloads
  - Build cross-agent “handoff packs”:
      - short structured summaries for when one agent should continue work started by another
      - include goals, decisions, touched files, unresolved risks, and confidence markers
  - Add agent-specific context rendering policies:
      - compact instruction-safe output for AGENTS/CLAUDE/GEMINI files
      - richer search/timeline output for MCP clients
      - viewer/debug output with provenance and scoring
  - Promote transcript replay from a side capability into a first-class capture mode with schema versioning and
    validation.

  ### 6. Phase 4 roadmap: product features that decisively exceed Claude-Mem

  These features should define the fork.

  - Memory debugger
      - explain why a memory item was retrieved
      - show token cost, score, freshness, source, and compression lineage
  - Task and decision graph
      - extract durable decisions, blockers, and next steps as first-class linked records
  - Project intelligence mode
      - build workspace corpora and answer project questions from memory without expensive full-context injection
  - Benchmarked retrieval
      - ship repeatable benchmark corpora and quality tests for recall, precision, contradiction rate, and token
        efficiency
  - Memory packs
      - export/import portable workspace memory bundles for local backup, machine transfer, and agent handoff
  - Active memory hygiene
      - identify stale, contradictory, or low-value memories and recommend cleanup
  - Budget-aware context generation
      - every retrieval path should operate against an explicit token budget, not only static count settings

  ### 7. Phase 5 roadmap: narrow the integration matrix into tiers

  Stop treating all integrations as equal.

  - Tier 1: full-fidelity platforms
      - platforms with automatic capture, context injection, search, and strong session identity
      - target Claude Code, Codex, Cursor, Gemini CLI, OpenCode
  - Tier 2: transcript-backed platforms
      - good capture and handoff, weaker real-time hooks
  - Tier 3: MCP-only platforms
      - search and context only, no automatic capture
  - Product decisions, docs, and tests should all reflect these tiers.
  - Only Tier 1 platforms should block core roadmap decisions.

  ## Public APIs / Interfaces / Types

  Introduce these as explicit internal contracts first, then expose selected endpoints:

  - NormalizedEvent
      - one canonical ingestion shape for hooks, transcripts, manual entries, and plugin events
  - AgentIdentity
      - { platform, provider, agentKind, agentVersion }
  - WorkspaceIdentity
      - { workspaceId, projectId, rootPath, branch?, worktree? }
  - CaptureAdapter
      - normalize(input) -> NormalizedEvent[]
  - ContextAdapter
      - render(memoryPack, target) -> string | structured payload
  - MemoryEntity
      - canonical fact/decision/task/entity with provenance, confidence, freshness, and usage metrics
  - RetrievalPolicy
      - { budgetTokens, taskType, targetAgent, scope, recencyBias, qualityThreshold }
  - MemoryPack
      - structured handoff/retrieval payload containing compact summary, selected evidence, open questions, and
        citations

  Add these new product-facing surfaces:

  - /api/memory/pack
      - build a budgeted handoff/context pack for a requested target agent
  - /api/memory/feedback
      - mark retrieved memory as useful, noisy, wrong, or obsolete
  - /api/memory/export and /api/memory/import
      - portable local memory bundle operations
  - /api/integrations/capabilities
      - machine-readable integration matrix
  - /api/evals/*
      - run retrieval/cost/quality benchmarks against fixture corpora

  ## Test Plan

  ### Core regression coverage

  - provider switching still preserves shared memory continuity across Claude, Gemini, and OpenRouter
  - Codex transcript ingestion still updates workspace-local AGENTS.md
  - folder context generation remains gated and budget-aware
  - migration from ~/.claude-mem to ~/.aimemory preserves data and settings

  ### Reliability coverage

  - Unix child-process cleanup works on Linux/macOS
  - SDK startup retry handles transport-readiness races without duplicate sessions
  - crash recovery does not lose or duplicate observations
  - transcript reprocessing is idempotent

  ### Memory-quality coverage

  - canonicalization merges duplicates without losing provenance
  - retrieval policy respects token budget
  - compacted summaries preserve key decisions and next steps
  - contradictory memories are detected and deprioritized
  - benchmark fixtures show improved recall/precision per token versus current behavior

  ### Integration coverage

  - each Tier 1 platform must have end-to-end tests for capture, storage, retrieval, and context rendering
  - each Tier 2 platform must have transcript-schema contract tests
  - each Tier 3 platform must have MCP contract tests
  - the UI must display integration capabilities and memory-debug reasoning consistently

  ## Assumptions and Defaults

  - The fork is now a hard fork under the AiMemory product direction.
  - Local-first remains non-negotiable: SQLite + FTS5 is the required baseline; vector search stays optional.
  - The roadmap optimizes first for single-user local developer workflows, not hosted team sync.
  - Claude-Mem backward compatibility is migration-only. Existing data should import cleanly, but future architecture
    should not be shaped around preserving old names or paths.
  - The primary KPI is useful context per token, not raw observation volume.
  - The main differentiation target is:
      1. lower token cost
      2. better context quality
      3. stronger cross-agent continuity
      4. broader but tiered integration support

  ## References

  - Upstream defaults and product framing:
    https://github.com/thedotmack/claude-mem/blob/main/src/shared/SettingsDefaultsManager.ts
  - Upstream logger/runtime behavior: https://github.com/thedotmack/claude-mem/blob/main/src/utils/logger.ts
  - Upstream worker tree for architecture comparison:
    https://github.com/thedotmack/claude-mem/tree/main/src/services/worker
  - Upstream OpenRouter implementation reference:
    https://github.com/thedotmack/claude-mem/blob/main/src/services/worker/OpenRouterAgent.ts
