# Sales AI Coach

Sales AI Coach is a B2B SaaS platform designed for corporate sales training and roleplay simulation. Sales representatives practice realistic client scenarios against interactive AI personas via voice and text, receiving automated evaluations and communication feedback. Sales managers configure courses, assign training modules, and track team performance through analytical dashboards.

## System Architecture

The platform follows a multi-service architecture orchestrated via Docker Compose:

- **Frontend (Web Application)**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Zustand, Recharts, and Three.js VRM for 3D avatar rendering.
- **Backend API**: Node.js, Express, TypeScript, Prisma ORM, and PostgreSQL. Handles business logic, authentication, session state management, scoring algorithms, and AI orchestrations.
- **BackendTTS (Voice Service)**: Python FastAPI microservice providing streaming text-to-speech generation via Microsoft Edge TTS with multi-voice support.
- **BackendScraper (Document & Ingestion Service)**: Python FastAPI microservice dedicated to safe document extraction (PDF, DOCX, XLSX, PPTX, HTML, RTF) with strict SSRF protection and domain validation.
- **Database & Storage**: PostgreSQL (with Supabase pgvector support for retrieval-augmented generation context).

```text
sales-ai-coach/
├── Backend/          # Node.js Express REST API, Prisma ORM, AI orchestration
├── BackendTTS/       # Python FastAPI service for text-to-speech synthesis
├── BackendScraper/   # Python FastAPI service for document extraction and scraping
├── Frontend/         # Next.js 16 application with Three.js avatar and role dashboards
├── docs/             # Technical documentation and automated testing reports
├── anti-slop/        # Code hygiene and architecture audit logs
├── docker-compose.yml# Multi-container orchestration definition
└── .env.example      # Environment variable template with sanitized values
```

## Key Features

### 1. Interactive AI Roleplay

- Dual-mode interaction supporting both real-time voice and text chat.
- Client-side speech recognition with voice activity detection and interruption (barge-in) support.
- 3D avatar visualization using Three.js and VRM models with synchronized lip-sync and expressive states.
- Real-time communication feedback, including speech filler detection and confidence indicators.

### 2. Course and Scenario Management

- Comprehensive customer personas with defined pain points, objection triggers, and buying signals.
- Configurable difficulty tiers (Beginner, Intermediate, Advanced) and conversational parameters.
- Multi-dimensional scoring rubrics tailored to specific product lines or negotiation contexts.
- Document ingestion pipeline supporting corporate playbooks and competitor sheets for grounded AI context.

### 3. Session Scoring and Post-Call Insights

- Automated transcript scoring across configured rubric dimensions.
- Conversational timeline replay highlighting key moments, objections, and trust shifts.
- Analytical breakdown of communication pacing, filler word frequency, and conversational balance.

### 4. Role-Based Access Control (RBAC)

- **Sales Representative (Karyawan)**: Access assigned courses, conduct roleplay sessions, review feedback reports, track personal leaderboard standings, and view training history.
- **Team Manager**: Monitor team progress, assign required courses, inspect individual session replays, and review aggregate team metrics.
- **Company Administrator**: Manage organizational structure, user provisioning, team leaders, company-wide course catalogs, and token usage reports.
- **Super Administrator**: System-level administration, global platform monitoring, and tenant management.

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

1. Copy the example environment file to create your local `.env`:

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

## Security and Operational Safeguards

- **SSRF Protection**: The document scraper implements strict outbound URL validation. Private, loopback, and local network IP ranges are blocked via DNS resolution checks before requests are initiated.
- **Rate Limiting**: In-memory fixed-window rate limiters protect authentication, text-to-speech, and AI completion routes from abuse.
- **Tenant Isolation**: Database queries enforce company-level and team-level scoping to ensure strict multi-tenant boundary compliance.
- **Sanitized Configurations**: Sensitive credentials and environment files (`.env`, `.env.production`, `.env.local`) are excluded by `.gitignore`.

## Quality Assurance and Automated Testing

- **End-to-End Testing**: Implemented with Playwright covering authentication, navigation, roleplay session lifecycle, manager reviews, and admin workflows under `Frontend/e2e/`.
- **API Security Verification**: Security test scripts validate route protection, authorization boundaries, and rate limits.
- **Code Standards**: Type safety enforced via strict TypeScript configurations across frontend and backend services.

## License

Proprietary and confidential. All rights reserved by MAXY Academy.
