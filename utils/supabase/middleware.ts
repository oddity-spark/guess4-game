import { NextResponse, type NextRequest } from "next/server";

// Simplified middleware - no longer using Supabase auth
// Just pass through all requests
export async function updateSession(request: NextRequest) {
  return NextResponse.next({
    request,
  });
}
