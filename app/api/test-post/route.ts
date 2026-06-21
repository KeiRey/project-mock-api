import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function POST(request: NextRequest) {
  let body: any = null;
  try {
    body = await request.json();
  } catch (e) {
    body = "No JSON payload or invalid JSON received";
  }

  return NextResponse.json({
    status: "created",
    message: "POST test endpoint is working successfully!",
    timestamp: new Date().toISOString(),
    receivedData: body
  }, {
    status: 201,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    }
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    }
  });
}
