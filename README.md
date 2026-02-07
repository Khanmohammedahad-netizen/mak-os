# MAK OS V2 - Complete System Documentation

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- (Optional) PostgreSQL or Docker

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Configure environment variables
uvicorn app.main:app --reload
```

API Docs: `http://localhost:8000/docs`

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Dashboard: `http://localhost:5173`

## Architecture

### Tech Stack
| Component | Technology |
|-----------|------------|
| Backend | FastAPI + Async SQLAlchemy |
| Database | PostgreSQL / SQLite |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Automation | n8n (webhooks) |

### Agent System

All agents inherit from `BaseAgent` which provides:
- ✅ Automatic logging to `agent_logs` table
- ✅ Async execution with proper error handling  
- ✅ Consistent result format

**Available Agents:**

1. **DiscoveryAgent** - Ingests leads from external sources
   - Deduplicates by website
   - Creates leads with status "new", vetting_status "pending"

2. **VettingAgent** - Applies business rules
   - Must have website (>= 4 chars)
   - Company name >= 3 chars
   - Sets vetting_status to "approved" or "rejected"

3. **TechDebtAgent** - Triggers website analysis via n8n
   - Finds approved leads without enrichment
   - Sends to n8n for tech analysis
   - n8n calls back with pain_points and score

### API Endpoints

#### Leads
- `POST /api/leads` - Create lead
- `GET /api/leads` - List leads (with filters)
- `GET /api/leads/{id}` - Get lead
- `PATCH /api/leads/{id}` - Update lead
- `DELETE /api/leads/{id}` - Delete lead

#### Agents
- `POST /api/agents/execute` - Trigger agent
  ```json
  {
    "agent_name": "discovery",
    "context": {"leads": [...]}
  }
  ```
- `GET /api/agents/logs` - Get execution logs

#### Webhooks (n8n Integration)
- `POST /api/webhooks/discovery` - Receive leads from n8n
- `PATCH /api/webhooks/enrichment/{lead_id}` - Receive analysis results

### n8n Integration

**Tech Debt Workflow:**
1. Backend triggers: `POST https://n8n.../webhook/enrichment-tech`
   ```json
   {"lead_id": 123, "website": "https://example.com"}
   ```

2. n8n analyzes website (speed, SEO, security)

3. n8n calls back: `PATCH .../api/webhooks/enrichment/123`
   ```json
   {
     "pain_points": {"slow_loading": true, "missing_ssl": false},
     "score": 65,
     "status": "enriched"
   }
   ```

**Import Workflow:**
- File: `n8n-workflow-tech-debt.json`
- Update webhook URL in node "Update Lead"

## Testing

### Unit Tests (Agents)
```bash
cd backend
python test_agents.py  # Tests Discovery + Vetting
python test_tech_debt.py  # Tests TechDebt + n8n integration
```

### Manual Testing
1. Start backend: `uvicorn app.main:app --reload`
2. Open Swagger UI: `http://localhost:8000/docs`
3. Execute agent:
   ```
   POST /api/agents/execute
   {"agent_name": "discovery", "context": {"leads": [...]}}
   ```
4. Check logs: `GET /api/agents/logs`

## Database Schema

```sql
-- Leads: Core CRM entity
CREATE TABLE leads (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255),
    website VARCHAR(500),
    region VARCHAR(100),
    status VARCHAR(50) DEFAULT 'new',
    vetting_status VARCHAR(50) DEFAULT 'pending',
    pain_points JSONB,  -- Flexible enrichment data
    score INTEGER DEFAULT 0,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- AgentLogs: Execution tracking
CREATE TABLE agent_logs (
    id SERIAL PRIMARY KEY,
    agent_name VARCHAR(100),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    status VARCHAR(50),  -- success, failed, partial
    leads_processed INTEGER,
    error_message TEXT
);
```

## Environment Variables

```bash
# Database
DATABASE_URL=sqlite+aiosqlite:///./mak_os.db
# Or: postgresql+asyncpg://user:pass@localhost:5432/mak_os

# n8n Integration
N8N_WEBHOOK_BASE=https://mak-n8n.onrender.com/webhook
N8N_BASIC_AUTH_USER=your_user  # Optional
N8N_BASIC_AUTH_PASSWORD=your_password  # Optional

# API Keys (for n8n workflows)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

## Development Guide

### Adding a New Agent

1. Create agent file:
```python
# backend/app/agents/my_agent.py
from app.agents.base import BaseAgent, AgentResult

class MyAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="My Agent")
    
    async def execute(self, context):
        # Your logic here
        return AgentResult(status='success', leads_processed=10)
```

2. Register in `app/agents/__init__.py`:
```python
from app.agents.my_agent import MyAgent
__all__ = [..., "MyAgent"]
```

3. Register in `app/api/agents.py`:
```python
AGENTS = {
    ...,
    "my_agent": MyAgent
}
```

### Database Migration (SQLite → PostgreSQL)

```bash
# 1. Export data from SQLite
sqlite3 mak_os.db .dump > backup.sql

# 2. Update DATABASE_URL in .env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/mak_os

# 3. Restart backend (tables auto-create)
uvicorn app.main:app --reload

# 4. Import data (requires conversion)
# ...or start fresh for clean architecture
```

## Production Deployment

### Backend (Render/Railway)
```bash
# Install command
pip install -r requirements.txt

# Start command
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Frontend (Vercel/Netlify)
```bash
# Build command
npm run build

# Output directory
dist/
```

### Environment Variables
Set on hosting platform:
- `DATABASE_URL` (PostgreSQL connection string)
- `N8N_WEBHOOK_BASE`
- `OPENAI_API_KEY` (if using AI features)

## Troubleshooting

**"database is locked"** → Migrate to PostgreSQL  
**"Agent not found"** → Check AGENTS registry in `api/agents.py`  
**n8n webhook 404** → Verify workflow is active and URL is correct  
**CORS errors** → Update `allow_origins` in `app/main.py`

## Next Steps

- [ ] Implement OutreachAgent (generate AI outreach messages)
- [ ] Build Kanban board frontend (drag-and-drop leads)
- [ ] Add real-time WebSocket for live agent logs
- [ ] Implement scheduled agent runs (cron-like)
- [ ] Add analytics dashboard (conversion funnel)
