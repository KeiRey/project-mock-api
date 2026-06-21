import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

async function handleEcho(request: NextRequest) {
  try {
    const url = new URL(request.url);
    
    // Extract query parameters
    const query: Record<string, string | string[]> = {};
    url.searchParams.forEach((value, key) => {
      if (query[key]) {
        if (Array.isArray(query[key])) {
          (query[key] as string[]).push(value);
        } else {
          query[key] = [query[key] as string, value];
        }
      } else {
        query[key] = value;
      }
    });

    // Extract headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Extract client IP
    const clientIp = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     "127.0.0.1";

    // Extract body content
    let body: any = null;
    let rawBody = "";
    const contentType = request.headers.get("content-type") || "";

    if (request.method !== "GET" && request.method !== "HEAD") {
      try {
        rawBody = await request.text();
        if (contentType.includes("application/json")) {
          body = JSON.parse(rawBody);
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          const params = new URLSearchParams(rawBody);
          const form: Record<string, string> = {};
          params.forEach((value, key) => {
            form[key] = value;
          });
          body = form;
        } else {
          body = rawBody;
        }
      } catch (err) {
        body = rawBody || null;
      }
    }

    const payload = {
      timestamp: new Date().toISOString(),
      method: request.method,
      url: request.url,
      path: url.pathname,
      clientIp,
      query,
      headers,
      body,
      rawBody: rawBody || undefined
    };

    return Response.json(payload, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
        "Access-Control-Allow-Headers": "*",
      }
    });
  } catch (error: any) {
    return Response.json(
      { error: "Echo Reflector Error", message: error.message },
      { 
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        }
      }
    );
  }
}

export async function GET(request: NextRequest) { return handleEcho(request); }
export async function POST(request: NextRequest) { return handleEcho(request); }
export async function PUT(request: NextRequest) { return handleEcho(request); }
export async function DELETE(request: NextRequest) { return handleEcho(request); }
export async function PATCH(request: NextRequest) { return handleEcho(request); }
export async function HEAD(request: NextRequest) { return handleEcho(request); }
export async function OPTIONS(request: NextRequest) { return handleEcho(request); }
