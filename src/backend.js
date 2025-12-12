export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/pixel") {
      return handlePixel(request, env);
    }
    if (url.pathname === "/log") {
      return handleLog(request, env);
    }
    if (url.pathname === "/dashboard") {
      return renderDashboard(env);
    }
    if (url.pathname === "/flush") {
      return handleFlush(request, env);
    }

    return new Response("OK", { status: 200 });
  }
};

// ---------------------------
// CORS Headers Function
// ---------------------------
function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = [
    "https://dbraun1991.github.io",
    "http://localhost",
    "http://127.0.0.1",
    "null" // file:// protocol
  ];

  // Check if origin matches any allowed pattern
  let allowOrigin = "*";
  if (origin) {
    // Exact match or localhost/127.0.0.1 with any port
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed === "null" && origin === "null") return true;
      if (origin === allowed) return true;
      if (allowed.includes("localhost") && origin.startsWith("http://localhost")) return true;
      if (allowed.includes("127.0.0.1") && origin.startsWith("http://127.0.0.1")) return true;
      return false;
    });
    
    if (isAllowed) {
      allowOrigin = origin;
    }
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

// ---------------------------
// Berlin Timestamp Function
// ---------------------------
function getBerlinTimestamp() {
  const date = new Date();

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short"
  });

  return formatter.format(date).replace(",", "");
}

// ---------------------------
// 1. Pixel endpoint
// ---------------------------
async function handlePixel(request, env) {
  const url = new URL(request.url);
  
  // Extract query parameters
  const session = url.searchParams.get("session") || "unknown";
  const section = url.searchParams.get("section") || null;
  const action = url.searchParams.get("action") || null;

  const logEntry = {
    type: "pixel",
    time: getBerlinTimestamp(),
    ip: request.headers.get("CF-Connecting-IP"),
    ua: request.headers.get("User-Agent"),
    referer: request.headers.get("Referer"),
    session: session,
    section: section,
    action: action
  };

  await storeLog(env, logEntry);

  // 1×1 transparent GIF
  const gif = Uint8Array.from([
    71,73,70,56,57,97,1,0,1,0,128,0,0,
    0,0,0,255,255,255,33,249,4,1,0,0,
    1,0,44,0,0,0,0,1,0,1,0,0,2,2,
    68,1,0,59
  ]);

  return new Response(gif, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store",
      ...getCorsHeaders(request, env)
    }
  });
}

// ---------------------------
// 2. JS log endpoint
// ---------------------------
async function handleLog(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: getCorsHeaders(request, env)
    });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await request.json().catch(() => ({}));

  const logEntry = {
    type: "js",
    time: getBerlinTimestamp(),
    ip: request.headers.get("CF-Connecting-IP"),
    ua: request.headers.get("User-Agent"),
    referer: request.headers.get("Referer"),
    origin: request.headers.get("Origin"),
    body
  };

  await storeLog(env, logEntry);

  return new Response("logged", {
    headers: getCorsHeaders(request, env)
  });
}

// ---------------------------
// 3. KV storage helpers
// ---------------------------
async function storeLog(env, entry) {
  const key = `log:${Date.now()}`;
  await env.DEMO_LOGS.put(key, JSON.stringify(entry));
}

// ---------------------------
// 4. Dashboard
// ---------------------------
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------------------------
// FLUSH Handler - Delete all logs
// ---------------------------
async function handleFlush(request, env) {
  const url = new URL(request.url);
  const password = url.searchParams.get("password");
  
  // Simple password protection
  const FLUSH_PASSWORD = "flush2025";
  
  if (password !== FLUSH_PASSWORD) {
    return new Response(JSON.stringify({
      error: "Unauthorized",
      message: "Invalid password. Use: /flush?password=YOUR_PASSWORD"
    }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders(request, env)
      }
    });
  }

  try {
    // List all keys
    const list = await env.DEMO_LOGS.list();
    const keys = list.keys;
    
    if (keys.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No logs to delete",
        deleted: 0
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders(request, env)
        }
      });
    }

    // Delete all keys
    const deletePromises = keys.map(key => env.DEMO_LOGS.delete(key.name));
    await Promise.all(deletePromises);

    return new Response(JSON.stringify({
      success: true,
      message: "All logs deleted successfully",
      deleted: keys.length
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders(request, env)
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: "Flush failed",
      message: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders(request, env)
      }
    });
  }
}

async function renderDashboard(env) {
  const list = await env.DEMO_LOGS.list();
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Tracking Dashboard</title>
      <style>
        body { font-family: Arial; background: #0B132E; color: #B7BECD; padding: 20px; margin: 0; }
        h1 { color: #FFFFFF; margin: 0 0 10px 0; }
        
        .dashboard-header {
          position: sticky;
          top: 0;
          background: #0B132E;
          padding: 20px 0;
          z-index: 100;
          border-bottom: 2px solid #1E3278;
          margin-bottom: 20px;
        }
        
        .search-container {
          margin: 15px 0;
          display: flex;
          gap: 10px;
          align-items: center;
        }
        
        .search-input {
          flex: 1;
          padding: 12px 16px;
          background: rgba(30, 50, 120, 0.3);
          border: 2px solid #1E3278;
          border-radius: 8px;
          color: #FFFFFF;
          font-size: 16px;
          transition: all 0.3s;
        }
        
        .search-input:focus {
          outline: none;
          border-color: #FF5A00;
          box-shadow: 0 0 0 3px rgba(255, 90, 0, 0.1);
        }
        
        .search-input::placeholder {
          color: #B7BECD;
          opacity: 0.6;
        }
        
        .clear-button {
          padding: 12px 20px;
          background: #FF5A00;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.3s;
        }
        
        .clear-button:hover {
          background: #ff6a10;
          transform: translateY(-2px);
        }
        
        .stats-bar {
          display: flex;
          gap: 20px;
          margin: 10px 0;
          font-size: 14px;
        }
        
        .stat-item {
          padding: 8px 12px;
          background: rgba(30, 50, 120, 0.3);
          border-radius: 6px;
        }
        
        .stat-number {
          color: #FF5A00;
          font-weight: bold;
          font-size: 18px;
        }
        
        .log-entry { 
          margin: 10px 0; 
          padding: 15px; 
          border: 1px solid #1E3278; 
          border-radius: 8px;
          background: rgba(30, 50, 120, 0.2);
          transition: all 0.3s;
        }
        
        .log-entry.hidden {
          display: none;
        }
        
        .log-entry:hover {
          border-color: #9BAEEE;
          background: rgba(30, 50, 120, 0.3);
        }
        
        .log-type { 
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .type-pixel { background: #FF5A00; color: white; }
        .type-js { background: #9BAEEE; color: #0B132E; }
        .log-detail { margin: 4px 0; font-size: 14px; }
        .session-id { color: #FF5A00; font-family: monospace; }
        .section-tag { color: #9BAEEE; font-weight: bold; }
        .action-tag { color: #FFD700; font-weight: bold; }
        pre { background: #0B132E; padding: 10px; border-radius: 4px; overflow-x: auto; }
        
        .no-results {
          text-align: center;
          padding: 40px;
          color: #B7BECD;
          font-size: 18px;
          display: none;
        }
        
        .no-results.show {
          display: block;
        }
        
        mark {
          background: #FFD700;
          color: #0B132E;
          padding: 2px 4px;
          border-radius: 3px;
        }
      </style>
    </head>
    <body>
      <div class="dashboard-header">
        <h1>Tracking Dashboard</h1>
        
        <div class="stats-bar">
          <div class="stat-item">
            Total: <span class="stat-number" id="totalCount">${list.keys.length}</span>
          </div>
          <div class="stat-item">
            Showing: <span class="stat-number" id="visibleCount">${list.keys.length}</span>
          </div>
        </div>
        
        <div class="search-container">
          <input 
            type="text" 
            id="searchInput" 
            class="search-input" 
            placeholder="Filter by session, section, action, IP, time, or any text..."
            autocomplete="off"
          >
          <button class="clear-button" id="clearButton">Clear</button>
        </div>
      </div>
      
      <div id="logsContainer">
  `;

  // Check if logs are completely empty
  if (list.keys.length === 0) {
    html += `
      <div style="text-align: center; padding: 60px 20px; color: #B7BECD;">
        <h2 style="color: #FFFFFF; margin-bottom: 10px;">No Tracking Logs Yet</h2>
        <p style="font-size: 16px; max-width: 500px; margin: 0 auto; line-height: 1.6;">
          Logs will appear here once visitors access the portfolio website. 
          Each navigation click will be tracked automatically.
        </p>
        <div style="margin-top: 30px; padding: 20px; background: rgba(30, 50, 120, 0.3); border-radius: 8px; max-width: 500px; margin: 30px auto 0;">
          <p style="margin: 0; font-size: 14px;">
            <strong style="color: #FF5A00;">Tip:</strong> Visit your portfolio at 
            <a href="https://dbraun1991.github.io/diffcomparison/" style="color: #FF5A00; text-decoration: underline;" target="_blank">
              dbraun1991.github.io/diffcomparison
            </a> to generate test logs.
          </p>
        </div>
      </div>
    `;
  }

  for (const item of list.keys.reverse()) {
    const data = await env.DEMO_LOGS.get(item.name, "json");
    
    // Create searchable text from all fields
    const searchableText = [
      data.type || '',
      data.time || '',
      data.session || '',
      data.action || '',
      data.section || '',
      data.ip || '',
      data.ua || '',
      data.referer || '',
      data.origin || '',
      data.body ? JSON.stringify(data.body) : ''
    ].join(' ').toLowerCase();

    html += `
      <div class="log-entry" data-searchable="${escapeHtml(searchableText)}">
        <span class="log-type type-${data.type}">${data.type.toUpperCase()}</span>
        <div class="log-detail"><strong>Time:</strong> ${data.time}</div>
        <div class="log-detail"><strong>Session:</strong> <span class="session-id">${data.session || 'N/A'}</span></div>
        ${data.action ? `<div class="log-detail"><strong>Action:</strong> <span class="action-tag">${data.action}</span></div>` : ''}
        ${data.section ? `<div class="log-detail"><strong>Section:</strong> <span class="section-tag">${data.section}</span></div>` : ''}
        <div class="log-detail"><strong>User-Agent:</strong> ${data.ua}</div>
        ${data.referer ? `<div class="log-detail"><strong>Referer:</strong> ${data.referer}</div>` : ''}
        ${data.body ? `<pre>${JSON.stringify(data.body, null, 2)}</pre>` : ""}
      </div>
    `;
  }

  html += `
      </div>
      
      <div class="no-results" id="noResults">
        No entries match your search
      </div>
      
      <script>
        const searchInput = document.getElementById('searchInput');
        const clearButton = document.getElementById('clearButton');
        const logEntries = document.querySelectorAll('.log-entry');
        const visibleCount = document.getElementById('visibleCount');
        const noResults = document.getElementById('noResults');
        
        function filterLogs() {
          const searchTerm = searchInput.value.toLowerCase().trim();
          let count = 0;
          
          logEntries.forEach(entry => {
            const searchableText = entry.getAttribute('data-searchable') || '';
            
            if (searchTerm === '' || searchableText.includes(searchTerm)) {
              entry.classList.remove('hidden');
              count++;
            } else {
              entry.classList.add('hidden');
            }
          });
          
          visibleCount.textContent = count;
          
          if (count === 0 && searchTerm !== '') {
            noResults.classList.add('show');
          } else {
            noResults.classList.remove('show');
          }
        }
        
        searchInput.addEventListener('input', filterLogs);
        
        clearButton.addEventListener('click', () => {
          searchInput.value = '';
          filterLogs();
          searchInput.focus();
        });
        
        // Keyboard shortcut: Ctrl/Cmd + K to focus search
        document.addEventListener('keydown', (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
          }
          
          // ESC to clear search
          if (e.key === 'Escape' && document.activeElement === searchInput) {
            searchInput.value = '';
            filterLogs();
          }
        });
        
        console.log('%cDashboard loaded with ${list.keys.length} entries', 'color: #FF5A00; font-weight: bold;');
        console.log('%cTip: Press Ctrl+K (Cmd+K) to focus search', 'color: #9BAEEE;');
        
        // Debug: Check if searchable attributes are loaded
        console.log('%cDebug: First entry searchable text:', 'color: #FFD700;', logEntries[0]?.getAttribute('data-searchable')?.substring(0, 100));
      </script>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: { "Content-Type": "text/html" }
  });
}