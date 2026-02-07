# MAK OS V2 - Frontend

Modern React dashboard with Tailwind CSS v4.

## Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## Features

- **Dark Mode**: Beautiful dark theme with glassmorphism accents
- **Responsive**: Mobile-first design
- **Real-time**: Live updates from FastAPI backend
- **TypeScript**: Full type safety

## Architecture

- `src/components/`: Reusable UI components (Sidebar, etc.)
- `src/pages/`: Route pages (CommandCenter, Leads, Agents, Projects)
- `src/lib/`: Utilities (API client, helpers)
