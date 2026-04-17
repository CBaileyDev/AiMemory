Project Analysis & Strategic Evolution Plan                                                                         │
│  ═══════════════════════════════════════════                                                                         │
│                                                                                                                      │
│  AiMemory (Claude-Mem v12.1.5) — The Next Generation                                                                 │
│                                                                                                                      │
│  Persona: Elon Musk, IQ 160, first-principles engineer.                                                              │
│  Mission: Reduce token costs by 10-100x and improve AI output quality through universal memory sharing across all A  │
│  I agents.                                                                                                           │
│  Core Belief: If memory is not instant, semantic, and cross-agent, it is broken.                                     │
│                                                                                                                      │
│  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────  │
│  1. Executive Summary                                                                                                │
│                                                                                                                      │
│  This project started as claude-mem — a simple context-persistence plugin for Claude Code. It has since evolved int  │
│  o a multi-platform memory operating system (v12.1.5) supporting Claude, Cursor, Gemini, Codex, Windsurf, OpenCode,  │
│  OpenClaw, and any MCP-compatible client. That is impressive. But we are currently building a distributed-adjacent   │
│  Rube Goldberg machine when we should be building a neural cache for AI.                                             │
│                                                                                                                      │
│  The good news: the team shipped real innovations — Knowledge Corpora, Smart Explore (tree-sitter AST parsing), Tie  │
│  r Routing (~52% cost reduction), and a 3-layer MCP search workflow that genuinely saves tokens.                     │
│  The bad news: the system is drowning in process-management hell, naive token math, dumb context injection, and arc  │
│  hitectural debt that threatens to collapse under its own weight. There are 1,429 tests, yet race conditions still   │
│  spawn 641 chroma-mcp zombie processes in 5 minutes. That is unacceptable.                                           │
│                                                                                                                      │
│  This plan details what is better, what is broken, and the ruthless, phased roadmap to transform this into a true u  │
│  niversal memory substrate for AI.                                                                                   │
│                                                                                                                      │
│  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────  │
│  2. What This Project Is (vs. Original Claude-Mem)                                                                   │
│                                                                                                                      │
│   Dimension           Original Claude-Mem    Current Project (v12.1.5)                                               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│   Scope               Claude Code only       Claude, Cursor, Gemini, Codex, Windsurf, OpenCode, OpenClaw, Kimi (MC   │
│                                              P)                                                                      │
│   Storage             SQLite flat file       SQLite + Chroma vector DB + Knowledge Corpora                           │
│   Search              Basic keyword search   3-layer MCP workflow (search → timeline → get_observations) + hybrid    │
│                                              semantic/FTS5                                                           │
│   Code Awareness      None                   Tree-sitter AST parsing (smart_search, smart_outline, smart_unfold)     │
│   Cost Optimization   None                   Tier Routing (~52% savings by routing simple queues to Haiku)           │
│   Sync                Local only             Multi-machine SSH/SCP bidirectional sync                                │
│   Agent Model         Inline processing      Worker service (Express) + queued agents (SDK/Gemini/OpenRouter)        │
│   Tests               Minimal                1,429 tests                                                             │
│                                                                                                                      │
│  In short: this is no longer a plugin. It is a memory middleware platform.                                           │
│                                                                                                                      │
│  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────  │
│  3. What Is Better (The Wins)                                                                                        │
│                                                                                                                      │
│  These are genuine competitive moats. Do not throw them away.                                                        │
│                                                                                                                      │
│  3.1 Multi-AI Provider Fallback Chain                                                                                │
│                                                                                                                      │
│  The agent-resolver.ts implements a real fallback chain: Claude SDK → Gemini → OpenRouter (100+ models). This is re  │
│  silient engineering. If one provider is down or expensive, the memory pipeline survives.                            │
│                                                                                                                      │
│  3.2 Knowledge Corpora (v12.1.0) — "AI Brains"                                                                       │
│                                                                                                                      │
│  This is the most important feature since the core observation pipeline. Users can build filtered corpora from obse  │
│  rvation history, prime them into an Agent SDK session, and query them conversationally. This turns raw memory into  │
│  structured, queryable expertise.                                                                                    │
│                                                                                                                      │
│  • 6 MCP tools + 8 HTTP endpoints                                                                                    │
│  • Auto-reprime on session expiry                                                                                    │
│  • Path-traversal hardened, injection-resistant system prompts                                                       │
│                                                                                                                      │
│  Elon's take: This is the seed of something huge. But it is currently a manual process. It should be auto-generated  │
│  and auto-maintained.                                                                                                │
│                                                                                                                      │
│  3.3 Smart Explore (v10.5.0) — Tree-Sitter Token Savior                                                              │
│                                                                                                                      │
│  Using tree-sitter AST parsing across 24 languages, the system can return folded structural views of code instead o  │
│  f full file reads. Claimed 6-12x token savings.                                                                     │
│                                                                                                                      │
│  Elon's take: This is exactly the right direction. File reads are the #1 token waste in coding agents. We need to e  │
│  xpand this to become the default read path, not an optional MCP tool.                                               │
│                                                                                                                      │
│  3.4 Progressive Disclosure / 3-Layer MCP Workflow                                                                   │
│                                                                                                                      │
│  Instead of dumping full observations into context, the MCP server returns:                                          │
│                                                                                                                      │
│  1. search — compact indexes (~50-100 tokens/result)                                                                 │
│  2. timeline — context around results                                                                                │
│  3. get_observations — full details only when needed                                                                 │
│                                                                                                                      │
│  This is genuinely 10x more token-efficient than naive memory injection.                                             │
│                                                                                                                      │
│  3.5 Crash Recovery (Claim-Confirm Pattern)                                                                          │
│                                                                                                                      │
│  All observations are written to pending_messages before processing and only deleted after successful atomic DB sto  │
│  rage. This is correct distributed systems thinking for a local-first architecture.                                  │
│                                                                                                                      │
│  3.6 Fail-Open Philosophy                                                                                            │
│                                                                                                                      │
│  Hooks return exit code 0 on failure. Worker unreachable? Context injection skips gracefully. This prevents the mem  │
│  ory system from blocking the user's actual work. Correct priority.                                                  │
│                                                                                                                      │
│  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────  │
│  4. Regressions & Critical Technical Debt                                                                            │
│                                                                                                                      │
│  This is where the project is bleeding. Fix these or the architecture will collapse.                                 │
│                                                                                                                      │
│  4.1 Zombie Process Apocalypse                                                                                       │
│                                                                                                                      │
│  The codebase contains hundreds of lines dedicated to killing orphaned Claude subprocesses and chroma-mcp spawn sto  │
│  rms. There is a documented bug where 641 chroma-mcp Python processes were spawned in ~5 minutes (v10.0.3).          │
│                                                                                                                      │
│  Root cause: Spawning a subprocess per session (SDKAgent) and per sync (Chroma) without a persistent process pool.   │
│                                                                                                                      │
│  First-principles fix: Stop spawning processes. Maintain a persistent agent pool and a persistent Chroma connection  │
│  .                                                                                                                   │
│                                                                                                                      │
│  4.2 Observation Duplication (Race Conditions)                                                                       │
│                                                                                                                      │
│  The changelog and GeminiPlan.md acknowledge race conditions causing 2-11x duplicate observations. This corrupts th  │
│  e memory corpus and wastes tokens on redundant context.                                                             │
│                                                                                                                      │
│  Root cause: The dual session ID system (contentSessionId vs memorySessionId) and lack of idempotency keys on obser  │
│  vation ingestion.                                                                                                   │
│                                                                                                                      │
│  4.3 Naive Token Math                                                                                                │
│                                                                                                                      │
│  The token calculator uses characters / 4. This is embarrassingly wrong for modern tokenizers (cl100k_base uses ~3.  │
│  2 chars/token for English code, but varies wildly for non-ASCII and special tokens). Without real token counting,   │
│  there is no way to enforce a context budget.                                                                        │
│                                                                                                                      │
│  4.4 Dumb Context Injection                                                                                          │
│                                                                                                                      │
│  The SessionStart hook injects the same formatted timeline of recent observations into every new session, regardles  │
│  s of what the user is actually asking. There is no query-adaptive ranking.                                          │
│                                                                                                                      │
│  Result: Token waste and irrelevant context noise.                                                                   │
│                                                                                                                      │
│  4.5 Fetch-All-Then-Slice Pattern                                                                                    │
│                                                                                                                      │
│  Multiple queries load thousands of observations into memory and then slice them in JS. This is O(n) memory bloat f  │
│  or no reason.                                                                                                       │
│                                                                                                                      │
│  4.6 No Context Caching                                                                                              │
│                                                                                                                      │
│  Identical context is regenerated from scratch on every session start. There is no memoization or warm cache.        │
│                                                                                                                      │
│  4.7 Chroma Sync Latency Spike                                                                                       │
│                                                                                                                      │
│  Chroma synchronization is serial per observation with no write-ahead buffer. Under heavy ingestion, this creates a  │
│  bottleneck.                                                                                                         │
│                                                                                                                      │
│  4.8 Orphaned Database Tables                                                                                        │
│                                                                                                                      │
│  Legacy tables (memories, overviews, diagnostics) still exist but are unused, creating schema confusion.             │
│                                                                                                                      │
│  4.9 Documentation Rot                                                                                               │
│                                                                                                                      │
│  The README badge still shows v6.5.0 while package.json is at v12.1.5. If the docs are this stale, users are operat  │
│  ing on false assumptions.                                                                                           │
│                                                                                                                      │
│  4.10 132 Documented Anti-Patterns                                                                                   │
│                                                                                                                      │
│  Code review tracking shows 132 anti-patterns, with the worst offenders being:                                       │
│                                                                                                                      │
│  • worker-service.ts: 36                                                                                             │
│  • SearchManager.ts: 28                                                                                              │
│  • SessionStore.ts: 18                                                                                               │
│                                                                                                                      │
│  4.11 The "No Escape Hatch" Problem                                                                                  │
│                                                                                                                      │
│  Everything must pass through the structured XML observation/summary pipeline. There is no way for a user or agent   │
│  to say: "Just store this raw text as a memory note." The system is over-opinionated.                                │
│                                                                                                                      │
│  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────  │
│  5. The Next Evolution: Strategic Pillars                                                                            │
│                                                                                                                      │
│  To make this MUCH better than the original, we must evolve from a memory logger to a cognitive cache layer. Here a  │
│  re the five strategic pillars:                                                                                      │
│                                                                                                                      │
│  Pillar 1: Zero-Process-Spawn Architecture                                                                           │
│                                                                                                                      │
│  Goal: Eliminate all subprocess-per-request patterns.                                                                │
│                                                                                                                      │
│  • Replace SDKAgent subprocess spawning with a persistent Claude Agent SDK connection pool (or HTTP SSE streaming).  │
│  • Replace chroma-mcp stdio bridge with a native Chroma HTTP client or embedded vector index (e.g., usearch, faiss,  │
│    r SQLite-vec).                                                                                                    │
│  • Expected outcome: Eliminate zombies, reduce latency by 500ms-2s per session, and remove 80% of process-managemen  │
│    code.                                                                                                             │
│                                                                                                                      │
│  Pillar 2: Real Token Budgeting & Context Economics                                                                  │
│                                                                                                                      │
│  Goal: Treat context tokens like watts in a battery — measure precisely and optimize ruthlessly.                     │
│                                                                                                                      │
│  • Integrate tiktoken (or provider-native tokenizers) for exact token counting on every injection, search result, a  │
│    observation.                                                                                                      │
│  • Implement a Context Budget Enforcer: SessionStart injection gets a strict token ceiling (e.g., 8k tokens). Rank   │
│    servations by relevance and time-decay, then truncate exactly at the budget.                                      │
│  • Replace fetch-all-then-slice with LIMIT/OFFSET SQL and relevance-ranked retrieval.                                │
│  • Add a Token Savings Dashboard in the web UI showing daily tokens saved vs. naive injection.                       │
│                                                                                                                      │
│  Pillar 3: Query-Adaptive, Hierarchical Memory                                                                       │
│                                                                                                                      │
│  Goal: The AI should only remember what is relevant right now.                                                       │
│                                                                                                                      │
│  • Short-term memory: Last 1-3 sessions, injected directly.                                                          │
│  • Medium-term memory: Relevant observations from the past 30 days, retrieved via RAG at UserPromptSubmit time.      │
│  • Long-term knowledge: Auto-distilled into Knowledge Corpora, queried on-demand via MCP.                            │
│                                                                                                                      │
│  Auto-Distillation Pipeline:                                                                                         │
│                                                                                                                      │
│  • Nightly (or on corpus size threshold), run a background job that clusters related observations and distills them  │
│    nto a higher-level "Insight" or "Decision" record.                                                                │
│  • These insights live in a separate insights table and are preferred over raw observations for long-term retrieval  │
│                                                                                                                      │
│  Pillar 4: Cross-Agent Memory Federation                                                                             │
│                                                                                                                      │
│  Goal: True memory sharing, not just memory duplication.                                                             │
│                                                                                                                      │
│  • Standardize a memory protocol: Define a lightweight, open spec (JSON-LD or MCP-native) for observation exchange   │
│    tween different AI systems.                                                                                       │
│  • Real-time sync bus: Replace SSH/SCP sync with a local-first CRDT or WebSocket hub so that when Claude writes an   │
│    servation, Cursor can read it within seconds.                                                                     │
│  • Agent identity tagging: Every observation is tagged with the agent that created it (claude, cursor, gemini, etc.  │
│    Future agents can filter by creator or learn from cross-agent consensus.                                          │
│                                                                                                                      │
│  Pillar 5: Smart Explore as Default Read Path                                                                        │
│                                                                                                                      │
│  Goal: Make file reads 10x cheaper by default.                                                                       │
│                                                                                                                      │
│  • When any AI agent requests a file read, the system should first return a smart_outline or smart_unfold of the re  │
│    vant symbols.                                                                                                     │
│  • Only expand to full file content on explicit agent request.                                                       │
│  • Integrate this at the hook level (e.g., intercept ReadFile tool calls) rather than as an optional MCP tool.       │
│                                                                                                                      │
│  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────  │
│  6. Detailed Roadmap                                                                                                 │
│                                                                                                                      │
│  Phase 1: Stop the Bleeding (Weeks 1-4)                                                                              │
│                                                                                                                      │
│  Theme: Kill zombies, fix math, and enforce budgets.                                                                 │
│                                                                                                                      │
│   Task                                Details                                Impact                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│   1.1 Replace subprocess spawning     Convert SDKAgent to use persistent H   Eliminates zombies, -500ms-2s latency   │
│                                       TTP/SSE connections to the Claude Ag   per request.                            │
│                                       ent SDK instead of spawn() per sessi                                           │
│                                       on.                                                                            │
│   1.2 Embedded vector search          Replace Chroma MCP bridge with sqlit   Removes Python process dependency, si   │
│                                       e-vec or a native Chroma HTTP client   mplifies deployment.                    │
│                                       .                                                                              │
│   1.3 Real token counting             Integrate tiktoken or js-tiktoken ac   Enables accurate budgeting and honest   │
│                                       ross ContextBuilder, SearchManager,    token-savings metrics.                  │
│                                       and CorpusRenderer.                                                            │
│   1.4 Context budget enforcer         Cap SessionStart injection at 8k tok   Prevents context overflow and reduces   │
│                                       ens (configurable). Rank by relevanc   noise.                                  │
│                                       e_score * time_decay and hard-trunca                                           │
│                                       te.                                                                            │
│   1.5 Fix observation deduplication   Add SHA-256 hash or idempotency key    Eliminates 2-11x duplicates.            │
│                                       (tool_name + input_hash + timestamp_                                           │
│                                       bucket) to observation ingestion.                                              │
│   1.6 Delete legacy tables            Drop memories, overviews, diagnostic   Reduces schema confusion.               │
│                                       s after migration validation.                                                  │
│                                                                                                                      │
│  Phase 2: Intelligent Memory Hierarchy (Weeks 5-10)                                                                  │
│                                                                                                                      │
│  Theme: Make memory relevant, not just recent.                                                                       │
│                                                                                                                      │
│   Task                                Details                                 Impact                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│   2.1 Implement memory tiers          Create short_term, medium_term, and l   Query-adaptive context.                │
│                                       ong_term retrieval paths in ContextBu                                          │
│                                       ilder.                                                                         │
│   2.2 Auto-distillation worker        Nightly job that clusters observation   Compresses long-term memory 10-100x.   │
│                                       s by semantic similarity (using embed                                          │
│                                       dings) and prompts a cheap model (e.g                                          │
│                                       ., Haiku) to synthesize insights.                                              │
│   2.3 Insight-first retrieval         Prefer insights over raw observations   Higher signal-to-noise ratio.          │
│                                       for contexts > 7 days old.                                                     │
│   2.4 Observation feedback loop       Use the currently-empty observation_f   Self-improving memory relevance.       │
│                                       eedback table. Allow agents to upvote                                          │
│                                       /downvote observation relevance. Feed                                          │
│                                       this into the ranking algorithm.                                               │
│   2.5 Query-aware context injection   At UserPromptSubmit, embed the user's   Massive token savings for large proj   │
│                                       prompt and retrieve only top-k releva   ects.                                  │
│                                       nt observations from Chroma, rather t                                          │
│                                       han injecting a fixed timeline.                                                │
│                                                                                                                      │
│  Phase 3: Cross-Agent Federation (Weeks 11-16)                                                                       │
│                                                                                                                      │
│  Theme: Memory should flow between AIs like electricity flows between grids.                                         │
│                                                                                                                      │
│   Task                                Details                                 Impact                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│   3.1 Agent identity tagging          Add source_agent column to observatio   Enables cross-agent analytics and fi   │
│                                       ns table. Tag every observation with    ltering.                               │
│                                       claude, cursor, gemini, codex, kimi,                                           │
│                                       etc.                                                                           │
│   3.2 Open memory protocol            Publish a lightweight JSON spec for o   Interoperability with any future AI    │
│                                       bservation exchange. Make the worker    tool.                                  │
│                                       service expose a /federation/ingest a                                          │
│                                       nd /federation/query endpoint.                                                 │
│   3.3 Real-time sync bus              Implement a local WebSocket or MQTT b   No more stale context when switching   │
│                                       us so that all connected AI clients r   between Claude and Cursor.             │
│                                       eceive new observations within second                                          │
│                                       s.                                                                             │
│   3.4 Cross-agent consensus scoring   If Claude and Cursor both make the sa   Crowd-sourced memory prioritization.   │
│                                       me observation about a file, boost it                                          │
│                                       s relevance score.                                                             │
│                                                                                                                      │
│  Phase 4: Smart Explore as Infrastructure (Weeks 17-22)                                                              │
│                                                                                                                      │
│  Theme: Token-optimal code understanding by default.                                                                 │
│                                                                                                                      │
│   Task                                  Details                               Impact                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│   4.1 Hook-level file-read intercepti   Intercept ReadFile / PostToolUse fo   6-12x token reduction on code reads.   │
│   on                                    r file reads and return smart_outli                                          │
│                                         ne + relevant smart_unfold sections                                          │
│                                         instead of full content.                                                     │
│   4.2 Agent-expandable views            Return folded AST with "expand" mar   Preserves correctness while minimizi   │
│                                         kers. The agent can request full sy   ng tokens.                             │
│                                         mbol bodies on demand via a new MCP                                          │
│                                         tool.                                                                        │
│   4.3 Tree-sitter grammar auto-instal   Remove the manual burden of 24 gram   Better UX, fewer dependencies.         │
│   l                                     mar packages. Auto-detect language                                           │
│                                         and lazy-install the required gramm                                          │
│                                         ar on first use.                                                             │
│                                                                                                                      │
│  Phase 5: The Escape Hatch & Developer Experience (Weeks 23-26)                                                      │
│                                                                                                                      │
│  Theme: Power users need power tools.                                                                                │
│                                                                                                                      │
│   Task                           Details                                   Impact                                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│   5.1 Raw memory notes           Allow users and agents to store unstruc   Fixes the "over-opinionated" problem.     │
│                                  tured memory_notes that bypass the XML                                              │
│                                  observation pipeline entirely.                                                      │
│   5.2 Token savings dashboard    Web UI page showing: tokens injected to   Motivation and transparency for users.    │
│                                  day, tokens saved vs. naive approach, c                                             │
│                                  ost equivalent in dollars.                                                          │
│   5.3 README/docs regeneration   Auto-sync README version badge. Regener   Eliminates documentation rot.             │
│                                  ate all CLAUDE.md and installation docs                                             │
│                                  from source.                                                                        │
│   5.4 Binary distribution        Ship a single static binary (e.g., via    One-command install, zero dependency he   │
│                                  bun build --compile or Deno compile) co   ll.                                       │
│                                  ntaining the worker, MCP server, and UI                                             │
│                                  .                                                                                   │
│                                                                                                                      │
│  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────  │
│  7. Success Metrics                                                                                                  │
│                                                                                                                      │
│  How do we know we won?                                                                                              │
│                                                                                                                      │
│   Metric                                  Current                Target (6 months)                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                  │
│   Zombie processes per day                641 (worst case)       0                                                   │
│   Token counting accuracy                 ~70% (chars/4)         99.5% (tiktoken)                                    │
│   SessionStart injection tokens           Unbounded              Hard-capped at 8k                                   │
│   Observation duplicates                  2-11x                  <1%                                                 │
│   Context regeneration latency            200-500ms              <50ms (cached)                                      │
│   Active memory agents supported          7                      12+                                                 │
│   Tests passing                           1429/1440 (11 flaky)   1500+ / 0 flaky                                     │
│   User-reported "memory was irrelevant"   Unknown                <5%                                                 │
│                                                                                                                      │
│  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────  │
│  8. Conclusion                                                                                                       │
│                                                                                                                      │
│  This project has already achieved what the original claude-mem never could: genuine cross-platform, multi-agent me  │
│  mory persistence. But it is currently a complex, process-spawning, token-guessing middleware platform that happens  │
│  to save some tokens.                                                                                                │
│                                                                                                                      │
│  The next evolution is not more features. It is ruthless simplification combined with cognitive architecture upgrad  │
│  es:                                                                                                                 │
│                                                                                                                      │
│  1. Kill the subprocesses.                                                                                           │
│  2. Count the tokens correctly.                                                                                      │
│  3. Make memory hierarchical and query-adaptive.                                                                     │
│  4. Federate across agents in real-time.                                                                             │
│  5. Make smart code exploration the default.                                                                         │
│                                                                                                                      │
│  Do this, and this project becomes the de facto memory substrate for every AI coding assistant on the planet — not   │
│  just an improved Claude plugin.                                                                                     │
│                                                                                                                      │
│  First principles demand nothing less.  
