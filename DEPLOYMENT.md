# Deployment Guide

## Render Deployment (Backend)

### Option 1: Using render.yaml (Recommended)

1. Push code to GitHub
2. Connect Render to your GitHub repository
3. Render will automatically detect `render.yaml` and configure the service

### Option 2: Manual Configuration

1. **Create New Web Service** on Render
2. **Connect Repository**: `https://github.com/Khanmohammedahad-netizen/mak-os`
3. **Settings:**
   - **Name**: `mak-backend`
   - **Region**: Oregon (or closest to you)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

4. **Environment Variables** (Add in Render Dashboard):
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/dbname
   N8N_WEBHOOK_BASE=https://your-n8n-instance.com/webhook
   N8N_BASIC_AUTH_USER=your_user
   N8N_BASIC_AUTH_PASSWORD=your_password
   OPENAI_API_KEY=sk-...
   ENVIRONMENT=production
   ```

5. **Deploy**

### Important Notes

- **Start Command**: Must be `uvicorn app.main:app` (not `uvicorn main:app`)
- **Database**: Use PostgreSQL for production (Render provides free PostgreSQL)
- **Free Tier**: Service spins down after 15 min of inactivity

## Vercel Deployment (Frontend)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   cd frontend
   vercel
   ```

3. **Environment Variables** (set in Vercel dashboard):
   ```
   VITE_API_URL=https://mak-backend.onrender.com
   ```

4. **Build Settings**:
   - **Framework**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

## Database Setup

### Render PostgreSQL (Free)

1. Create a new PostgreSQL database on Render
2. Copy the "Internal Database URL"
3. Add as `DATABASE_URL` environment variable in backend service
4. Tables will auto-create on first run

### Supabase (Alternative)

1. Create project at supabase.com
2. Get connection string from Settings → Database
3. Format: `postgresql+asyncpg://user:pass@host:5432/postgres`

## n8n Integration

1. Deploy n8n or use cloud version
2. Import `n8n-workflow-tech-debt.json`
3. Update "Update Lead" node with your backend URL:
   ```
   https://mak-backend.onrender.com/api/webhooks/enrichment/{lead_id}
   ```
4. Set `N8N_WEBHOOK_BASE` to your n8n webhook URL

## Testing After Deployment

1. **Backend Health Check**:
   ```bash
   curl https://mak-backend.onrender.com/docs
   ```

2. **Create Test Lead**:
   ```bash
   curl -X POST https://mak-backend.onrender.com/api/leads \
     -H "Content-Type: application/json" \
     -d '{"company_name": "Test Co", "website": "https://test.com"}'
   ```

3. **Trigger Agent**:
   ```bash
   curl -X POST https://mak-backend.onrender.com/api/agents/execute \
     -H "Content-Type: application/json" \
     -d '{"agent_name": "vetting"}'
   ```

## Troubleshooting

### "Could not import module 'main'"
- **Fix**: Update start command to `uvicorn app.main:app`

### Database connection errors
- **Fix**: Ensure `DATABASE_URL` is set correctly with `asyncpg` driver

### CORS errors
- **Fix**: Update `allow_origins` in `app/main.py` with your Vercel URL

## Cost Estimate

- **Render Backend**: Free (with sleep after inactivity)
- **Render PostgreSQL**: Free (limited storage)
- **Vercel Frontend**: Free (hobby plan)
- **n8n Cloud**: $20/month (or self-host for free)

**Total**: $0-20/month
