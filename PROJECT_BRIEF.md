# RepoKosha AI Project Brief

## One-Line Pitch

RepoKosha AI is an AI-powered codebase knowledge engine that helps developers understand, navigate, document, and plan changes in unfamiliar repositories.

## Problem Statement

Developers waste significant time reading unfamiliar codebases before they can safely contribute. Existing tools often provide either plain search or generic chat without engineering artifacts. RepoKosha AI provides repository-aware answers with citations and converts codebase understanding into architecture summaries, implementation plans, documentation drafts, and risk reports.

## Core Modules

1. Codebase ingestion through ZIP upload, GitHub URL import, and self-scan demo.
2. Source filtering, chunking, tokenization, and retrieval index generation.
3. Codebase chat with cited files, line ranges, snippets, and relevance scores.
4. Architecture insight engine for module maps and responsibility detection.
5. Engineer OS tools for planning, docs, and risk scanning.
6. Developer dashboard for a recruiter-friendly demo flow.

## Backend Highlights

- Native Node.js HTTP APIs
- Custom ZIP parser using `zlib`
- Local TF-IDF style RAG retrieval
- Repository chunking and project persistence
- Separate insight services for chat, architecture, docs, plans, and risk reports

## Frontend Highlights

- Dark developer dashboard
- Sidebar project workspace
- Chat panel with citations
- Architecture map, docs, planner, and risk views
- Mobile-responsive layout

## Best Demo Questions

```text
How does ZIP upload work?
```

```text
Which files should I inspect to add authentication?
```

```text
Explain the backend architecture.
```

```text
Find risky areas in this codebase.
```

## Resume Bullet

Built RepoKosha AI, a full-stack AI/RAG developer platform that indexes repositories and provides codebase Q&A with citations, architecture insights, implementation planning, documentation drafts, and risk scanning using a custom Node.js retrieval pipeline.

## Submission Text

RepoKosha AI is an AI-powered software engineering platform that turns repositories into interactive knowledge bases. It supports codebase ingestion, RAG-based Q&A with citations, architecture mapping, implementation planning, documentation generation, and risk scanning through a polished full-stack dashboard.
