# RepoKosha AI

RepoKosha AI is an AI-powered codebase knowledge engine that turns a software repository into a searchable engineering workspace. It helps developers ask questions about a codebase, inspect architecture, generate implementation plans, draft documentation, and scan for risk markers.

> Repo + Kosha means a repository knowledge storehouse.

## Why This Project

Software engineers often lose time understanding unfamiliar repositories before they can build confidently. RepoKosha AI solves that by indexing source files, retrieving the most relevant code context, and converting it into useful engineering outputs such as citations, module maps, documentation drafts, and feature plans.

## Features

- Codebase Q&A with file citations and snippets
- ZIP upload for repository indexing
- Public GitHub repository import
- Self-demo mode that analyzes RepoKosha AI itself
- Architecture overview with module responsibility mapping
- AI-style implementation planner with files to inspect, steps, risks, and citations
- Documentation draft generator
- Risk scanner for secrets, TODO/FIXME markers, debug statements, and silent failure patterns
- Polished developer dashboard built for placement demos

## Tech Stack

- Frontend: HTML, CSS, JavaScript SPA
- Backend: Node.js native HTTP server
- RAG Engine: TF-IDF style local retrieval over indexed code chunks
- Storage: Local JSON project store
- ZIP Processing: Custom ZIP parser using Node.js `zlib`

The project is intentionally dependency-light so it can run quickly on any evaluator machine without install failures. It can be extended later with OpenAI/Gemini embeddings, pgvector, authentication, and deployment infrastructure.

## Screens

- Ask: codebase chat with citations
- Map: architecture and module responsibility view
- Plan: feature implementation planner
- Docs: generated documentation draft
- Risks: maintainability and security marker scan

## Getting Started

### Prerequisites

- Node.js 20 or newer

### Run Locally

```bash
node server.js
```

Open:

```text
http://localhost:8080
```

RepoKosha AI has no external runtime dependencies for the MVP, so it can run directly with Node.js.

If you prefer npm scripts on your own machine:

```bash
npm run dev
```

## Demo Flow

1. Open the app.
2. Click **Run instant demo** or **Analyze RepoKosha**.
3. Ask:

```text
How does ZIP upload work?
```

4. Open **Map** to show architecture.
5. Open **Plan** and enter:

```text
Add authentication with GitHub login
```

6. Open **Docs** and **Risks** for generated engineering artifacts.

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/projects` | List indexed projects |
| POST | `/api/projects/scan-self` | Index RepoKosha AI itself |
| POST | `/api/projects/upload-zip` | Upload and index a ZIP codebase |
| POST | `/api/projects/github` | Import a public GitHub repository |
| GET | `/api/projects/:id` | Get indexed project details |
| POST | `/api/projects/:id/chat` | Ask a question about the codebase |
| GET | `/api/projects/:id/architecture` | Generate architecture view |
| POST | `/api/projects/:id/plan` | Generate feature implementation plan |
| GET | `/api/projects/:id/docs` | Generate documentation draft |
| GET | `/api/projects/:id/risks` | Generate risk report |

## System Design

```text
Codebase Input
  -> ZIP Parser / GitHub Import / Self Scan
  -> Source File Filter
  -> Chunking
  -> Tokenization
  -> TF-IDF Retrieval Index
  -> Chat, Architecture, Planner, Docs, Risk APIs
  -> Developer Dashboard
```

## Placement Resume Description

Built RepoKosha AI, a full-stack AI/RAG developer tool that indexes software repositories and provides codebase Q&A with citations, architecture insights, implementation planning, documentation drafts, and risk scanning. Implemented ZIP ingestion, GitHub import, local retrieval over source chunks, and a polished dashboard for engineering workflows.

## Application Form Description

RepoKosha AI is a full-stack AI/RAG platform for software engineers that converts any repository into an interactive knowledge base. It supports ZIP upload, GitHub import, codebase Q&A with citations, architecture mapping, implementation planning, documentation generation, and risk scanning through a polished developer dashboard.

## Future Improvements

- OpenAI or Gemini embeddings for semantic retrieval
- PostgreSQL with pgvector for scalable vector search
- GitHub OAuth and private repository import
- Pull request review assistant
- Background indexing queue
- Team workspaces and saved engineering decisions
- Deployment on Vercel/Render/Railway

## Author

Ram Roop Sharma
