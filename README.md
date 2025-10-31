# AIMSii to Shopify Product Sync

Automated script that monitors Tritech AIMSii inventory and creates product drafts in Shopify.

## Overview

This application automatically syncs inventory records from Tritech AIMSii to Shopify:

- **Polls AIMSii API** every 24 hours for new inventory records
- **Filters by category** (configurable)
- **Checks for duplicates** by SKU before creating
- **Uses OpenAI** to intelligently transform product data
- **Creates product drafts** in Shopify with retry logic
- **Logs everything** to files for monitoring and debugging

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Tritech       │      │   Node.js        │      │   Shopify       │
│   AIMSii API    │◄────►│   Sync Script    │─────►│   Admin API     │
│  (Inventory)    │ Poll │  (This App)      │      │  (Products)     │
└─────────────────┘      └────────┬─────────┘      └─────────────────┘
                                  │
                         ┌────────▼─────────┐
                         │    OpenAI API    │
                         │  (GPT-4o)        │
                         └──────────────────┘
```

## Prerequisites

- **Node.js** 18.0.0 or higher
- **Tritech AIMSii API** credentials (API key and endpoint)
- **Shopify Admin API** access token with product write permissions
- **OpenAI API** key (GPT-4o access)
- **Railway.com** account (for deployment)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

The `.env` file contains comprehensive inline instructions for all required credentials. Simply open `.env` and fill in your values following the detailed instructions provided.

Alternatively, you can copy from the template:

```bash
cp .env.example .env
```

The `.env` file includes step-by-step instructions for obtaining:

```env
# AIMSii Configuration
AIMSII_API_URL=https://api.tritech.com/aimsii
AIMSII_API_KEY=your_aimsii_api_key_here

# Shopify Configuration
SHOPIFY_STORE=your-store-name
SHOPIFY_ACCESS_TOKEN=your_shopify_admin_api_token

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Sync Settings
CHECK_INTERVAL_HOURS=24
LOOKBACK_HOURS=24
FILTER_BY_CATEGORY=true
ALLOWED_CATEGORIES=Electronics,Accessories
```

### 3. Configure Field Mapping

Update the field mapping in `.env` to match your AIMSii data structure:

```env
AIMSII_FIELD_TITLE=name
AIMSII_FIELD_DESCRIPTION=description
AIMSII_FIELD_VENDOR=brand
AIMSII_FIELD_TYPE=category
AIMSII_FIELD_PRICE=price
AIMSII_FIELD_SKU=sku
AIMSII_FIELD_QUANTITY=quantity
AIMSII_FIELD_IMAGE=imageUrl
```

## Getting API Credentials

### Tritech AIMSii API

Contact your AIMSii administrator or Tritech support to obtain:
- API endpoint URL
- API key/token
- Inventory endpoint path

### Shopify Admin API

1. Go to your Shopify admin: `https://your-store.myshopify.com/admin`
2. Navigate to **Settings** → **Apps and sales channels** → **Develop apps**
3. Click **Create an app**
4. Configure Admin API scopes:
   - `read_products`
   - `write_products`
5. Install the app and copy the **Admin API access token**

### OpenAI API

1. Go to [platform.openai.com](https://platform.openai.com)
2. Navigate to **API Keys**
3. Create a new API key
4. Ensure you have GPT-4o access

## Running Locally

**Important:** The application consists of two parts that work together:
1. **Main sync script** (`index.js`) - Monitors AIMSii and creates Shopify products
2. **Backend server** (`server.js`) - Handles OpenAI API calls securely

When you run the commands below, **both will start automatically**. The sync script communicates with the backend server to transform product data using OpenAI.

### Run Continuous Sync (24-hour schedule)

```bash
npm start
```
Starts both the sync script and backend server. Runs every 24 hours.

### Run Once and Exit

```bash
npm run sync:once
```
Runs a single sync cycle and exits. Useful for testing.

### Dry Run (Test without creating products)

```bash
npm run sync:dry-run
```
Tests the entire flow without actually creating products in Shopify. Great for validation.

### Development Mode

```bash
npm run dev
```
Same as `npm start` but with development logging.

## Deployment to Railway.com

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click **New Project** → **Empty Project**
3. Click **+ New** → **GitHub Repo** and select this repository

### Step 2: Configure Environment Variables

In Railway project settings, add all environment variables from `.env`:

**Required:**
```
AIMSII_API_URL=...
AIMSII_API_KEY=...
SHOPIFY_STORE=...
SHOPIFY_ACCESS_TOKEN=...
OPENAI_API_KEY=...
```

**Optional (with defaults):**
```
CHECK_INTERVAL_HOURS=24
LOOKBACK_HOURS=24
FILTER_BY_CATEGORY=true
ALLOWED_CATEGORIES=Electronics,Accessories
BACKEND_API_URL=http://localhost:5001
PORT=5001
```

### Step 3: Deploy

Railway will automatically:
- Detect `railway.json` configuration
- Install dependencies (including `concurrently` to run both processes)
- Start both the sync script and backend server with `npm start`
- Both processes run together using `concurrently`

### Step 4: Monitor Logs

View logs in Railway dashboard to monitor sync operations.

## Configuration Options

### Sync Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `CHECK_INTERVAL_HOURS` | How often to run sync (hours) | 24 |
| `LOOKBACK_HOURS` | Fetch records from last N hours | 24 |
| `FILTER_BY_CATEGORY` | Enable category filtering | false |
| `ALLOWED_CATEGORIES` | Comma-separated list of categories | (empty) |

### Retry Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `RETRY_MAX_ATTEMPTS` | Max retry attempts | 3 |
| `RETRY_INITIAL_DELAY` | Initial delay (ms) | 1000 |
| `RETRY_MAX_DELAY` | Max delay (ms) | 10000 |

### Additional Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `CREATE_AS_DRAFT` | Create as draft or published | true |
| `RUN_ONCE` | Run once and exit | false |
| `DRY_RUN` | Test mode (no actual creation) | false |

## Logs

Logs are stored in the `logs/` directory:

- **`logs/success.log`** - All successful operations
- **`logs/errors.log`** - All errors and warnings
- **`logs/failed-products.json`** - Products that failed to sync (for manual review)

## Monitoring

### Check Sync Status

View logs in real-time:

```bash
tail -f logs/success.log
```

### Check Failed Products

```bash
cat logs/failed-products.json | jq
```

### Railway Dashboard

Monitor the application in Railway:
- View deployment logs
- Check resource usage
- Monitor uptime

## Troubleshooting

### "Missing required environment variables"

Ensure all required variables are set in `.env`:
- `AIMSII_API_KEY`
- `AIMSII_API_URL`
- `SHOPIFY_STORE`
- `SHOPIFY_ACCESS_TOKEN`
- `OPENAI_API_KEY`

### "Failed to connect to AIMSii API"

- Verify `AIMSII_API_URL` and `AIMSII_API_KEY`
- Check network connectivity
- Contact AIMSii support for API status

### "Product already exists in Shopify"

This is normal. The script checks for existing SKUs before creating to avoid duplicates.

### OpenAI Rate Limits

If you hit OpenAI rate limits:
- Reduce `CHECK_INTERVAL_HOURS` to spread out requests
- Upgrade your OpenAI plan
- Add delays between products in `index.js`

## Development

### Project Structure

```
.
├── index.js                    # Main entry point (automated sync script)
├── config.js                   # Configuration management
├── server.js                   # Backend API for OpenAI calls (required)
├── services/
│   ├── aimsiiApiService.js    # AIMSii API integration
│   ├── shopifyService.ts      # Shopify API with SKU checking
│   └── openaiService.ts       # OpenAI transformation
├── utils/
│   ├── logger.js              # File logging
│   └── retry.js               # Retry logic
├── logs/                      # Log files (generated)
├── railway.json               # Railway deployment config
└── .env                       # Environment variables (self-documenting)
```

## Support

For issues or questions:

1. Check logs in `logs/` directory
2. Review Railway deployment logs
3. Verify all API credentials are correct
4. Test with `npm run sync:dry-run` first

## License

Private - Internal use only
