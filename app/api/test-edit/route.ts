import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

async function handleEdit(request: NextRequest) {
  let body: any = null;
  try {
    body = await request.json();
  } catch (e) {
    body = null;
  }

  return NextResponse.json({
    status: "success",
    message: `${request.method} edit test endpoint is working successfully!`,
    timestamp: new Date().toISOString(),
    action: request.method,
    updatedData: body
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    }
  });
}

export async function PUT(request: NextRequest) { return handleEdit(request); }
export async function PATCH(request: NextRequest) { return handleEdit(request); }
export async function DELETE(request: NextRequest) { return handleEdit(request); }

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    }
  });
}
