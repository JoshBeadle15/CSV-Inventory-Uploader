
export interface AimsiiProduct {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  category: string;
  brand: string;
  imageUrl: string;
}

export interface ShopifyProductData {
  product: {
    title: string;
    body_html: string;
    vendor: string;
    product_type: string;
    tags: string;
    variants: Array<{
      price: string;
      sku: string;
      inventory_quantity: number;
      option1: string;
    }>;
    images: Array<{
      src: string;
    }>;
  };
}

export type ProcessingStatus = 'pending' | 'generating' | 'creating' | 'success' | 'error';

export interface ProcessedProduct {
  id: string; // Will use SKU or row index
  status: ProcessingStatus;
  sourceData: Record<string, any>; // The original row from the AIMSii CSV
  shopifyData?: ShopifyProductData;
  errorMessage?: string;
  shopifyId?: number;
}

// FIX: Add ActivityLogEntry and ActivityLogType to be exported and used in ActivityLog.tsx
export type ActivityLogType = 'POLL' | 'DETECT' | 'GENERATE' | 'CREATE' | 'STATUS' | 'ERROR';

export interface ActivityLogEntry {
  id: string;
  type: ActivityLogType;
  message: string;
  timestamp: string;
}


// A mapping from a target Shopify header to a source AIMSii header.
// e.g., { 'Title': 'product_name', 'Variant SKU': 'sku' }
export type ColumnMapping = Record<string, string | null>;