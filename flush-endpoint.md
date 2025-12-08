# Flush Endpoint Documentation

## Purpose
The `/flush` endpoint allows you to delete all tracking logs from the Cloudflare KV storage. This is useful for:
- Clearing test data
- Resetting analytics
- Starting fresh after development

## Security
The endpoint is password-protected to prevent unauthorized deletion of logs.

**Default Password:** `flush2025`

⚠️ **IMPORTANT:** Change this password in `backend.js` before deploying to production!

```javascript
// In backend.js, line ~161
const FLUSH_PASSWORD = "flush2025"; // Change this!
```

## Usage

### Basic Request
```bash
curl "https://backendcontent.d-braun1991.workers.dev/flush?password=flush2025"
```

### Browser
Simply visit:
```
https://backendcontent.d-braun1991.workers.dev/flush?password=flush2025
```

### Response (Success)
```json
{
  "success": true,
  "message": "All logs deleted successfully",
  "deleted": 42
}
```

### Response (No Logs)
```json
{
  "success": true,
  "message": "No logs to delete",
  "deleted": 0
}
```

### Response (Wrong Password)
```json
{
  "error": "Unauthorized",
  "message": "Invalid password. Use: /flush?password=YOUR_PASSWORD"
}
```

### Response (Error)
```json
{
  "error": "Flush failed",
  "message": "Error details here"
}
```

## How It Works

1. Validates the password parameter
2. Lists all keys in the KV store
3. Deletes all keys in parallel using `Promise.all()`
4. Returns count of deleted entries

## Security Best Practices

### 1. Change the Default Password
```javascript
const FLUSH_PASSWORD = "your-secure-password-here";
```

### 2. Use Environment Variables (Recommended)
Instead of hardcoding, use Wrangler secrets:

```bash
# Set the secret
wrangler secret put FLUSH_PASSWORD

# In backend.js, change to:
const FLUSH_PASSWORD = env.FLUSH_PASSWORD || "flush2025";
```

### 3. IP Whitelist (Advanced)
Add IP restriction to the handler:

```javascript
async function handleFlush(request, env) {
  const clientIP = request.headers.get("CF-Connecting-IP");
  const allowedIPs = ["YOUR.IP.ADDRESS.HERE"];
  
  if (!allowedIPs.includes(clientIP)) {
    return new Response("Forbidden", { status: 403 });
  }
  
  // ... rest of function
}
```

### 4. Disable in Production
Add environment check:

```javascript
async function handleFlush(request, env) {
  // Only allow in development
  if (env.ENVIRONMENT === "production") {
    return new Response("Not available in production", { status: 403 });
  }
  
  // ... rest of function
}
```

## Testing

### Test with curl
```bash
# Wrong password
curl "https://backendcontent.d-braun1991.workers.dev/flush?password=wrong"
# Returns 401 Unauthorized

# Correct password
curl "https://backendcontent.d-braun1991.workers.dev/flush?password=flush2025"
# Returns success with count

# Verify deletion
curl "https://backendcontent.d-braun1991.workers.dev/dashboard"
# Should show empty or very few entries
```

### Test with Browser DevTools
```javascript
// In browser console
fetch('https://backendcontent.d-braun1991.workers.dev/flush?password=flush2025')
  .then(r => r.json())
  .then(console.log);
```

## Deployment

After modifying `backend.js`:

```bash
# Deploy the updated worker
wrangler deploy

# Test the endpoint
curl "https://backendcontent.d-braun1991.workers.dev/flush?password=flush2025"
```

## Limitations

- **No Undo**: Once deleted, logs cannot be recovered
- **No Backup**: Make sure you don't need the data before flushing
- **Rate Limits**: Subject to Cloudflare Workers rate limits
- **Timeout**: May timeout if there are >10,000 keys (consider batch deletion)

## Alternative: Selective Deletion

To delete only specific logs, modify the handler:

```javascript
// Delete logs older than X days
const cutoffDate = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
const keysToDelete = keys.filter(key => {
  const timestamp = parseInt(key.name.split(':')[1]);
  return timestamp < cutoffDate;
});
```

Or delete by session:

```javascript
// Delete specific session
const sessionId = url.searchParams.get("session");
const keysToDelete = keys.filter(key => 
  key.metadata?.session === sessionId
);
```

## Support

If you encounter issues:
1. Check the dashboard first: `/dashboard`
2. Verify password is correct
3. Check Cloudflare Workers logs
4. Ensure KV namespace is bound correctly

---

**Remember:** Always change the default password before deploying to production!