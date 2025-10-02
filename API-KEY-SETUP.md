# 🔑 Riot Games API Key Setup

## Issue Identified
The current API key `RGAPI-3135fd4b-9af6-4efa-9a8b-0ec4729c36cd` is returning:
```json
{"status":{"message":"Unknown apikey","status_code":401}}
```

This indicates the API key is **expired, invalid, or revoked**.

## Solution: Get a New API Key

### Step 1: Create Riot Developer Account
1. Go to [https://developer.riotgames.com/](https://developer.riotgames.com/)
2. Click "Login" and sign in with your Riot Games account
3. If you don't have a Riot account, create one first

### Step 2: Generate Development API Key
1. After logging in, you'll see your dashboard
2. Look for "Development API Key" section
3. Click "Regenerate API Key" to get a fresh key
4. Copy the new API key (format: `RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### Step 3: Update Local Configuration
Replace the API key in `.env.local`:
```bash
RIOT_API_KEY=YOUR_NEW_API_KEY_HERE
```

### Step 4: Update Frontend Code
Update the API key in `frontend/src/app.js`:
```javascript
const API_CONFIG = {
    key: 'YOUR_NEW_API_KEY_HERE',
    // ... rest of config
};
```

### Step 5: Test the New Key
Run the test script:
```bash
./test-api-key.sh
```

You should see successful responses (status 200) instead of 401 errors.

## API Key Limitations

### Development Keys
- **Rate Limit**: 100 requests every 2 minutes
- **Expiration**: 24 hours (need to regenerate daily)
- **Usage**: Development and testing only

### Production Keys
For production deployment, you'll need to:
1. Register your application with Riot Games
2. Provide application details and use case
3. Get approval for a production API key
4. Production keys have higher rate limits and longer expiration

## Rate Limiting Best Practices
The application already implements:
- ✅ 1.2 second delay between requests
- ✅ Request caching (5 minutes)
- ✅ Error handling for rate limits (429 status)
- ✅ Automatic retry logic

## Troubleshooting

### Common Issues
1. **401 Unknown apikey**: Key is expired/invalid → Get new key
2. **403 Forbidden**: Key lacks permissions → Check key type
3. **429 Rate Limited**: Too many requests → Wait and retry
4. **404 Not Found**: Summoner doesn't exist → Valid error

### Debug Information
The application now logs detailed error information:
- Full error messages from Riot API
- HTTP status codes and headers
- Request URLs and parameters
- API key prefix for verification

### Testing Commands
```bash
# Test API key directly
./test-api-key.sh

# Test with curl
curl "https://na1.api.riotgames.com/lol/status/v4/platform-data?api_key=YOUR_KEY"

# Expected success response
{"id":"NA1","name":"North America","locales":["en_US"],"maintenances":[],"incidents":[]}
```

## Security Notes
- ✅ API key is stored in `.env.local` (not committed to git)
- ✅ Frontend code will be updated to use AWS Secrets Manager in production
- ✅ Rate limiting prevents API abuse
- ✅ Error handling prevents key exposure in logs

## Next Steps
1. Get a new API key from developer.riotgames.com
2. Update `.env.local` and `frontend/src/app.js`
3. Test with `./test-api-key.sh`
4. Deploy to AWS with Secrets Manager integration

---
**Note**: Development API keys expire every 24 hours and need to be regenerated regularly.
