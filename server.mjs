#!/usr/bin/env node
/**
 * MAK OS — Startup Script
 *
 * Auto-detects LAN IP and prints the mobile access URL.
 * Usage:
 *   node server.mjs            (dev server only)
 *   node server.mjs --tunnel   (dev server + Cloudflare tunnel)
 */

import { networkInterfaces } from 'os'
import { spawn } from 'child_process'

const PORT = process.env.PORT || 3000
const useTunnel = process.argv.includes('--tunnel')

// ─── Detect LAN IP ───────────────────────────────────────────────

function getLanIp() {
    const nets = networkInterfaces()
    for (const name of Object.keys(nets)) {
        for (const iface of nets[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address
            }
        }
    }
    return '127.0.0.1'
}

const lanIp = getLanIp()

// ─── Print Banner ────────────────────────────────────────────────

function printBanner(tunnelUrl) {
    console.log('')
    console.log('  ╔══════════════════════════════════════════════╗')
    console.log('  ║         MAK OS CONTROL PANEL                ║')
    console.log('  ╠══════════════════════════════════════════════╣')
    console.log(`  ║  Local:   http://localhost:${PORT}              ║`)
    console.log(`  ║  Network: http://${lanIp}:${PORT}        ║`)
    if (tunnelUrl) {
        console.log(`  ║  Remote:  ${tunnelUrl.padEnd(34)}║`)
    }
    console.log('  ╠══════════════════════════════════════════════╣')
    console.log('  ║  Mobile API:                                ║')
    console.log(`  ║    POST http://${lanIp}:${PORT}/api/mobile/run ║`)
    console.log('  ║    { "task": "find restaurants in Chicago" } ║')
    console.log('  ╚══════════════════════════════════════════════╝')
    console.log('')
}

// ─── Start Next.js Dev Server ────────────────────────────────────

const next = spawn('npx', ['next', 'dev', '-H', '0.0.0.0', '-p', String(PORT)], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env },
})

next.on('error', (err) => {
    console.error('Failed to start Next.js:', err.message)
    process.exit(1)
})

// Print banner after a short delay to let Next.js init
setTimeout(() => printBanner(null), 3000)

// ─── Optional Tunnel ─────────────────────────────────────────────

if (useTunnel) {
    setTimeout(() => {
        console.log('  [Tunnel] Starting Cloudflare quick tunnel...')
        const tunnel = spawn('npx', ['cloudflared', 'tunnel', '--url', `http://localhost:${PORT}`], {
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        let tunnelUrl = null

        const parseUrl = (data) => {
            const text = data.toString()
            const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
            if (match && !tunnelUrl) {
                tunnelUrl = match[0]
                console.log(`  [Tunnel] ✓ Remote URL: ${tunnelUrl}`)
            }
        }

        tunnel.stdout.on('data', parseUrl)
        tunnel.stderr.on('data', parseUrl)

        tunnel.on('error', () => {
            console.log('  [Tunnel] cloudflared not available. Install: npm i -g cloudflared')
        })

        process.on('exit', () => tunnel.kill())
    }, 5000)
}

// ─── Graceful Shutdown ───────────────────────────────────────────

process.on('SIGINT', () => {
    next.kill()
    process.exit(0)
})
process.on('SIGTERM', () => {
    next.kill()
    process.exit(0)
})
