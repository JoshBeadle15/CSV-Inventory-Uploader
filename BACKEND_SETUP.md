# AIMSii API Integration Guide

## Overview

This document provides detailed information about integrating with the Tritech AIMSii API for automated inventory synchronization.

## AIMSii API Authentication

The AIMSii API uses Bearer token authentication:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.tritech.com/aimsii/api/inventory
```

## Required Environment Variables

```env
AIMSII_API_URL=https://api.tritech.com/aimsii
AIMSII_API_KEY=your_api_key_here
AIMSII_INVENTORY_ENDPOINT=/api/inventory
```

## API Endpoints

### Get Inventory Records

**Endpoint:** `GET /api/inventory`

**Headers:**
- `Authorization: Bearer {API_KEY}`
- `Content-Type: application/json`

**Query Parameters:**
- `since` (optional) - ISO 8601 timestamp to filter records created after this date
- `limit` (optional) - Maximum number of records to return
- `category` (optional) - Filter by product category

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_KEY" \
     "https://api.tritech.com/aimsii/api/inventory?since=2025-10-29T00:00:00Z&limit=100"
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "inv-12345",
      "sku": "PROD-001",
      "name": "Sample Product",
      "description": "Product description",
      "price": 29.99,
      "quantity": 100,
      "category": "Electronics",
      "brand": "BrandName",
      "imageUrl": "https://example.com/image.jpg",
      "created_at": "2025-10-30T10:00:00Z",
      "updated_at": "2025-10-30T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1
}
```

## Expected Data Structure

The script expects inventory records to have these fields (configurable via environment variables):

| Field | Type | Description | Mapped To (Shopify) |
|-------|------|-------------|---------------------|
| `sku` | string | Stock Keeping Unit | `variants.sku` |
| `name` | string | Product name | `title` |
| `description` | string | Product description | `body_html` |
| `price` | number | Product price | `variants.price` |
| `quantity` | number | Inventory quantity | `variants.inventory_quantity` |
| `category` | string | Product category | `product_type` |
| `brand` | string | Product brand/vendor | `vendor` |
| `imageUrl` | string | Product image URL | `images.src` |
| `created_at` | string | ISO 8601 timestamp | Used for filtering |

## Field Mapping Configuration

Customize field mapping in `.env` if your AIMSii fields have different names:

```env
# If your AIMSii uses 'product_name' instead of 'name'
AIMSII_FIELD_TITLE=product_name

# If your AIMSii uses 'stock_quantity' instead of 'quantity'
AIMSII_FIELD_QUANTITY=stock_quantity
```

## Category Filtering

Enable category filtering to sync only specific product types:

```env
FILTER_BY_CATEGORY=true
ALLOWED_CATEGORIES=Electronics,Accessories,Cables
```

The script will only process records where `category` matches one of the allowed categories (case-insensitive).

## Timestamp-Based Filtering

The script uses the `created_at` or `createdAt` field to identify new records:

- Default: Fetch records created in the last 24 hours
- Configurable: Set `LOOKBACK_HOURS` to change the time window

**Supported timestamp field names:**
- `created_at`
- `createdAt`
- `timestamp`
- `date_created`

## Testing AIMSii Connection

Test your AIMSii API connection:

```bash
# Using curl
curl -H "Authorization: Bearer YOUR_KEY" \
     "https://api.tritech.com/aimsii/api/inventory?limit=1"
```

## Rate Limiting

AIMSii API may have rate limits. The script includes:

- Automatic retry with exponential backoff (3 attempts)
- 1-second delay between processing each record
- Configurable retry settings

## Error Handling

Common errors and solutions:

### 401 Unauthorized
- Check `AIMSII_API_KEY` is correct
- Verify API key hasn't expired
- Contact AIMSii support to verify API access

### 404 Not Found
- Verify `AIMSII_API_URL` is correct
- Check `AIMSII_INVENTORY_ENDPOINT` path
- Confirm your AIMSii instance has API access enabled

### 429 Too Many Requests
- Increase `CHECK_INTERVAL_HOURS` to reduce frequency
- Add delays between records
- Contact AIMSii support about rate limits

### Network Errors
- Check firewall settings
- Verify Railway.com can access your AIMSii API
- Check if AIMSii API requires IP whitelisting

## Getting AIMSii API Access

To obtain API credentials:

1. Contact your AIMSii administrator
2. Request API access for inventory sync
3. Obtain:
   - API endpoint URL
   - API key/token
   - Documentation for your specific AIMSii version

## Support

For AIMSii API support, contact Tritech support with your AIMSii version number and API endpoint information.