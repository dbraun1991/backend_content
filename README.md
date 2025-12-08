# Backend Content - Cloudflare Workers Tracking Backend

A lightweight tracking and analytics backend built on Cloudflare Workers with KV storage. Provides pixel tracking, custom event logging, and a simple dashboard for monitoring user interactions.

## Architecture

**Runtime:** Cloudflare Workers (Edge Computing)  
**Storage:** Cloudflare KV (Key-Value Store)  
**Language:** JavaScript (ES Modules)

Worker URL: [Link to the worker](https://backendcontent.d-braun1991.workers.dev)

### Structure

```
.
├── backendREADME.md        # This file
├── src
│   └── backend.js
└── wrangler.toml           # Cloudflare deployment
```


## Endpoints

### 1. `GET /pixel`
**Purpose:** Invisible pixel tracking for page views and email opens

**Response:** 1×1 transparent GIF image

**Captured Data:**
- Timestamp (ISO format)
- Client IP (via CF-Connecting-IP header)
- User-Agent string
- Referer URL

**Frontend Usage:**
```html
<img src="https://your-worker.workers.dev/pixel" width="1" height="1" alt="" style="display:none">
```

### 2. `POST /log`
**Purpose:** Custom event logging from JavaScript applications

**CORS:** Enabled for allowed origins (configured in wrangler.toml)

**Request Format:**
```javascript
fetch('https://your-worker.workers.dev/log', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'button_click',
    data: { button_id: 'subscribe', timestamp: Date.now() }
  })
});
```

**Captured Data:**
- Timestamp
- Client IP
- User-Agent
- Referer
- Origin header
- Custom JSON payload

### 3. `GET /dashboard`
**Purpose:** Simple HTML dashboard to view all logged events

[Link to the dashboard](https://backendcontent.d-braun1991.workers.dev/dashboard)

**Access:** Returns HTML page with all stored logs in reverse chronological order

## Configuration

### wrangler.toml
- **KV Namespace:** `DEMO_LOGS` (binding for log storage)
- **Allowed Origins:** Configure CORS-enabled domains in `ALLOWED_ORIGINS` variable
- **Compatibility Date:** 2024-01-01

## Storage Structure

Logs are stored in KV with keys formatted as:
```
log:1234567890123
```

Each entry contains:
```json
{
  "type": "pixel" | "js",
  "time": "2024-01-01T12:00:00.000Z",
  "ip": "1.2.3.4",
  "ua": "Mozilla/5.0...",
  "referer": "https://example.com",
  "origin": "https://example.com",
  "body": { /* custom data for js logs */ }
}
```

## Frontend Integration Patterns

### Basic Page Tracking
```html
<!-- Add to any HTML page -->
<img src="https://your-worker.workers.dev/pixel" width="1" height="1" alt="">
```

### Custom Event Tracking
```javascript
// Track user interactions
async function trackEvent(eventName, eventData) {
  await fetch('https://your-worker.workers.dev/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: eventName, ...eventData })
  });
}

// Usage
document.getElementById('submit').addEventListener('click', () => {
  trackEvent('form_submit', { form: 'contact', timestamp: Date.now() });
});
```

### SPA Route Tracking
```javascript
// Track route changes in single-page apps
window.addEventListener('popstate', () => {
  trackEvent('route_change', { 
    path: window.location.pathname,
    hash: window.location.hash 
  });
});
```

## Deployment

```bash
# Deploy to Cloudflare Workers
npm install -g wrangler
wrangler login
wrangler deploy
```

## Current Limitations / TODOs

- `getCorsHeaders()` function is referenced but not implemented in index.js
- No authentication on dashboard endpoint
- No data retention policy (KV storage grows indefinitely)
- No query/filter capabilities on dashboard
- No export functionality for analytics

## Development Context

This backend serves as the data collection layer for frontend applications. It's designed to be:
- **Minimal:** Single file, no dependencies
- **Fast:** Edge-deployed via Cloudflare Workers
- **Flexible:** Accepts custom JSON payloads for any tracking needs
- **Privacy-aware:** Stores only necessary metadata

Perfect for prototyping analytics, A/B testing, user behavior tracking, or monitoring frontend applications without complex analytics platforms.