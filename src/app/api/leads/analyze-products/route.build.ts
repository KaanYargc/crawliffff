// Special build-time version of the route file
// This file is used only during build time to avoid errors with native modules
// The real implementation will be used at runtime

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // During build time, return a simple response
  return NextResponse.json({
    success: false,
    message: "This is a build-time placeholder. The actual API route will be available after deployment."
  });
}

// We need to export GET as well to ensure Next.js doesn't complain during build
export async function GET(req: NextRequest) {
  return NextResponse.json({
    success: false,
    message: "This is a build-time placeholder. The actual API route will be available after deployment."
  });
}