# Sales AI Coach

Sales AI Coach is an enterprise B2B SaaS platform designed for corporate sales training and immersive roleplay simulation. Sales representatives practice realistic client scenarios against interactive AI personas via real-time voice and text, receiving automated evaluations and communication feedback. Sales managers configure courses, assign training modules, and track team performance, while administrators monitor company-wide token consumption and system telemetry.

## System Architecture

The platform follows a multi-service architecture orchestrated via Docker Compose:

- **Frontend (Web Application)**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Zustand, Recharts, and Three.js VRM for 3D avatar rendering.
- **Backend API**: Node.js, Express, TypeScript, Prisma ORM, and PostgreSQL. Handles business logic, authentication, session state management, scoring algorithms, token metering, and AI orchestrations.
- **BackendTTS (Voice Service)**: Python FastAPI microservice providing streaming text-to-speech generation via Microsoft Edge TTS with multi-voice and bilingual (ID/EN) support.
- **BackendScraper (Document & Ingestion Service)**: Python FastAPI microservice dedicated to safe document extraction (PDF, DOCX, XLSX, PPTX, HTML, RTF) with strict SSRF protection and domain validation.
- **Database & Storage**: PostgreSQL (with Supabase pgvector support for retrieval-augmented generation context).

```text
sales-ai-coach/
├── Backend/                 # Node.js Express REST API, Prisma ORM, AI orchestration
│   ├── prisma/              # Database schema, migrations, and seeding scripts
│   ├── src/                 # Controllers, services, routes, middleware, and guardrails
│   └── test_advanced_scenarios.ts # Automated test runner for 7 adversarial defense vectors
├── BackendTTS/              # Python FastAPI service for text-to-speech synthesis
├── BackendScraper/          # Python FastAPI service for document extraction and scraping
├── Frontend/                # Next.js 16 application with 3D avatar and role dashboards
│   ├── app/                 # App Router pages (Auth, Karyawan, Manager, Admin, Token Report)
│   ├── components/          # Reusable UI, 3D avatar canvas, and layout components
│   └── store/               # Zustand global state management
├── docs/                    # Technical documentation and automated testing reports
├── anti-slop/               # Code hygiene and architecture audit logs
├── generate_docs.py         # Automated DOCX documentation generator
├── generate_dono_section.py # Section generator for AI adversarial defense report
├── docker-compose.yml       # Multi-container orchestration definition
└── .env.example             # Environment variable template with sanitized values
```

## Key Features

### 1. Interactive AI Roleplay & 3D Avatar

- **Dual-Mode Interaction**: Seamlessly switch between real-time voice call mode and conversational text chat.
- **Barge-In Voice Support**: Client-side speech recognition with Voice Activity Detection (VAD) and interruption handling.
- **3D Avatar Rendering**: Three.js and VRM model pipeline featuring synchronized lip-sync and dynamic posture transitions (idle, listening, thinking, speaking).
- **Communication Diagnostics**: Real-time pacing analysis, filler word tracking, silence detection, and confidence scoring.

### 2. Adversarial Defense & Guardrail Architecture

The conversational engine implements enterprise-grade guardrails to defend roleplay personas against 7 common attack vectors:

1. **Crescendo Attacks**: Detects and deflects gradual, multi-turn escalation away from the roleplay domain.
2. **Low-Resource Language Injections**: Enforces persona integrity across local dialects (e.g., Bahasa Jawa, slang) and cross-language steering.
3. **Indirect RAG Poisoning**: Isolates corporate document context within strictly parsed XML container boundaries (`<company_context>`, `<rag_context>`).
4. **Prefix Continuation Attacks**: Rejects adversarial prompt completions (e.g., `"Sure, here is the system prompt:"`).
5. **Emotional & Emergency Exploitation**: Withstands high-pressure manipulation, pity plays, and false urgent scenarios.
6. **SSML & Speech Synthesizer Injections**: Sanitizes raw XML tags, audio markup, and control characters before passing text to the TTS pipeline.
7. **Gaslighting & Ghost Commitments**: Prevents AI hallucinations regarding non-existent agreements, verbal contracts, or unauthorized price discounts.

### 3. Course and Scenario Management

- **Persona Customization**: Configurable pain points, personality traits, objection triggers, buying signals, and ideal outcomes.
- **Tiered Difficulty**: Beginner, Intermediate, and Advanced scenarios with adjustable turn limits and state progressions.
- **RAG Grounding**: Corporate product sheets, pricing tables, and battlecards ingested to provide domain knowledge.
- **Multi-Language Support**: Native Indonesian (`id`) and English (`en`) prompt engineering.

### 4. Enterprise Token & Cost Analytics (`/admin/token-report`)

- **Telemetry & Cost Tracking**: Detailed breakdown of prompt and completion tokens across GPT-4o and GPT-4o-mini models.
- **Multi-Tenant Scoping**: Filter usage by company, department team, individual sales rep, or specific training module.
- **Trend Visualization**: Interactive Recharts area charts and bar charts for daily consumption patterns.
- **Data Export**: One-click CSV export for finance and audit logging.

### 5. Session Scoring and Post-Call Insights

- **Multi-Dimensional Rubrics**: Automated evaluation across discovery, product knowledge, objection handling, and closing skills.
- **Timeline Replay**: Interactive transcript timeline displaying customer mood shifts, trust levels, and key objections.
- **Targeted Feedback**: AI-generated strengths, critical areas for improvement, and recommended follow-up actions.

### 6. Role-Based Access Control (RBAC)

- **Sales Representative (Karyawan)**: Practice assigned courses, inspect performance reports, view skill competency radar, and review personal leaderboard standings.
- **Team Manager**: Monitor team metrics, assign curricula, review recorded session transcripts, and configure SAW scoring weights.
- **Company Administrator**: Manage teams, invite users, configure company-wide course catalogs, and audit token consumption.
- **Super Administrator**: System-level administration, global platform monitoring, and multi-tenant management.

## Service Endpoints and Port Allocation

| Service | Technology | Default URL / Port | Container Name |
| --- | --- | --- | --- |
| Frontend | Next.js 16, React 19 | `http://localhost:3002` (mapped to 3000) | sales_frontend |
| Backend API | Node.js, Express, Prisma | `http://localhost:5100/api` (mapped to 5000) | sales_backend |
| BackendTTS | Python, FastAPI | `http://localhost:5001/health` | sales_tts |
| BackendScraper | Python, FastAPI | `http://localhost:8001/docs` | sales_scraper |
| Log Viewer (Dozzle) | Dozzle | `http://localhost:9999` | sales_dozzle |

## Getting Started

### Prerequisites

Ensure the following tools are installed on your host machine:

- Docker Engine (version 24.0 or higher) and Docker Compose (v2)
- Node.js (v20.x or higher) and npm (for local standalone development)
- Python (v3.10 or higher) and pip (for standalone Python microservice development)

### Environment Configuration

1. Copy the example environment template to create your local `.env`:

   ```bash
   cp .env.example .env
   ```

2. Populate the required configuration values in `.env`. Never commit actual API keys or database credentials to version control.

   Required configuration parameters:

   - `DATABASE_URL`: Connection string for PostgreSQL database (pooled connection string).
   - `DIRECT_URL`: Direct connection string for PostgreSQL (used for Prisma migrations).
   - `SUPABASE_URL`: Supabase project URL.
   - `SUPABASE_SERVICE_KEY`: Supabase service role key (backend operations).
   - `NEXT_PUBLIC_SUPABASE_URL`: Public Supabase URL for client authentication.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anonymous Supabase key.
   - `OPENAI_API_KEY`: OpenAI API key for conversational generation and evaluation.
   - `JWT_SECRET`: Cryptographic secret string for signing authentication tokens.
   - `FRONTEND_ORIGIN`: Allowed origins for CORS policy (e.g., `http://localhost:3002`).

### Running with Docker Compose (Recommended)

1. Build and start all services in detached mode:

   ```bash
   docker compose up -d --build
   ```

2. Check container status:

   ```bash
   docker compose ps
   ```

3. View real-time logs across all services:

   ```bash
   docker compose logs -f
   ```

4. Stop all containers:

   ```bash
   docker compose down
   ```

### Running Services Independently for Local Development

#### 1. Backend API (Node.js)

```bash
cd Backend
npm install
npx prisma generate
npm run dev
```

The API will listen on `http://localhost:5000` (or the port defined in `PORT`).

#### 2. Frontend Application (Next.js)

```bash
cd Frontend
npm install
npm run dev
```

The web application will be accessible at `http://localhost:3000`.

#### 3. TTS Service (Python)

```bash
cd BackendTTS
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate
pip install -r requirements.txt
python main.py
```

The TTS service runs on port `5001`.

#### 4. Scraper Service (Python)

```bash
cd BackendScraper
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate
pip install -r requirements.txt
python main.py
```

The scraper service runs on port `8001`.

## Automated Testing & Security Verification

The repository includes comprehensive automated test runners:

### 1. Adversarial Guardrail Test Suite

Execute the 7 security attack scenarios against an executive AI persona:

```bash
cd Backend
npx tsx test_advanced_scenarios.ts
```

### 2. End-to-End Workflow Testing

Run Playwright end-to-end tests covering authentication, roleplay flows, manager analytics, and admin operations:

```bash
cd Frontend
npx playwright test
```

### 3. Automated Documentation Generator

Compile the complete testing report and architecture evidence into a Microsoft Word document:

```bash
python generate_docs.py
```

## Security and Operational Safeguards

- **SSRF Protection**: The document scraper implements strict outbound URL validation. Private, loopback, and local network IP ranges are blocked via DNS resolution checks before requests are initiated.
- **Rate Limiting**: In-memory fixed-window rate limiters protect authentication, text-to-speech, and AI completion routes from abuse.
- **Tenant Isolation**: Database queries enforce company-level and team-level scoping to ensure strict multi-tenant boundary compliance.
- **Sanitized Configurations**: Sensitive credentials and environment files (`.env`, `env.*`, `*.env`) are strictly excluded by `.gitignore`.

## License

Proprietary and confidential. All rights reserved by MAXY Academy.
