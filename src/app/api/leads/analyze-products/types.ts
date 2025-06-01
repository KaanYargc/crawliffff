// types.ts - Tip tanımlamaları

// Base product interface
export interface Product {
  productName: string;
  price: string;
  rating: string;
  businessName: string;
  description: string;
  reviewCount: string;
  url: string;
  imageUrl: string;
}

// Cache row interface for SQLite
export interface CacheRow {
  value: string;
  timestamp: number;
}

// API error interface
export interface ApiError extends Error {
  response?: {
    status: number;
    statusText: string;
    data: any;
  };
  code?: string;
  message: string;
}

// Website content interface
export interface WebsiteContent {
  content: string;
}