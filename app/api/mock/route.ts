import { NextRequest } from "next/server";
import { decompressPayload, decryptPayload } from "../../lib/crypto";
import { MockConfig, MockParameter } from "../../lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ValidationError {
  parameter: string;
  error: string;
  message: string;
}

function validateQueryParams(paramsConfig: MockParameter[], searchParams: URLSearchParams): ValidationError | null {
  for (const p of paramsConfig) {
    if (!p.name) continue;
    const value = searchParams.get(p.name);

    // 1. Required Check
    if (p.required && (value === null || value === "")) {
      return {
        parameter: p.name,
        error: "Missing Required Parameter",
        message: `Query parameter '${p.name}' is required but was not provided.`
      };
    }

    if (value !== null && value !== "") {
      // 2. Type validation
      if (p.type === "number") {
        const num = Number(value);
        if (isNaN(num)) {
          return {
            parameter: p.name,
            error: "Invalid Type",
            message: `Query parameter '${p.name}' must be a valid number, but received '${value}'.`
          };
        }
        
        // Min/Max for number
        if (p.min !== undefined && num < p.min) {
          return {
            parameter: p.name,
            error: "Min Constraint Failed",
            message: `Query parameter '${p.name}' must be at least ${p.min}, but received ${num}.`
          };
        }
        if (p.max !== undefined && num > p.max) {
          return {
            parameter: p.name,
            error: "Max Constraint Failed",
            message: `Query parameter '${p.name}' must be at most ${p.max}, but received ${num}.`
          };
        }
      } else if (p.type === "boolean") {
        const lowered = value.toLowerCase();
        if (lowered !== "true" && lowered !== "false" && lowered !== "1" && lowered !== "0") {
          return {
            parameter: p.name,
            error: "Invalid Type",
            message: `Query parameter '${p.name}' must be a boolean ('true', 'false', '1', or '0'), but received '${value}'.`
          };
        }
      } else if (p.type === "string") {
        // Min/Max length for string
        if (p.min !== undefined && value.length < p.min) {
          return {
            parameter: p.name,
            error: "Min Length Constraint Failed",
            message: `Query parameter '${p.name}' length must be at least ${p.min} characters, but received length ${value.length} ('${value}').`
          };
        }
        if (p.max !== undefined && value.length > p.max) {
          return {
            parameter: p.name,
            error: "Max Length Constraint Failed",
            message: `Query parameter '${p.name}' length must be at most ${p.max} characters, but received length ${value.length} ('${value}').`
          };
        }
      }

      // 3. Enum validation
      if (p.enums) {
        const allowedValues = p.enums.split(",").map(val => val.trim());
        if (!allowedValues.includes(value)) {
          return {
            parameter: p.name,
            error: "Enum Match Failed",
            message: `Query parameter '${p.name}' must be one of [${allowedValues.join(", ")}], but received '${value}'.`
          };
        }
      }

      // 4. Regex pattern validation
      if (p.regex) {
        try {
          const reg = new RegExp(p.regex);
          if (!reg.test(value)) {
            return {
              parameter: p.name,
              error: "Regex Match Failed",
              message: `Query parameter '${p.name}' value '${value}' does not match the required pattern: ${p.regex}`
            };
          }
        } catch (e: any) {
          console.error(`Invalid regex pattern configured for parameter ${p.name}:`, e.message);
        }
      }
    }
  }
  return null;
}

async function handleRequest(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("d");
    
    // Extracted password from Query Param, X-Mock-Password header, or Bearer Token
    const password = searchParams.get("p") || 
                     request.headers.get("x-mock-password") || 
                     request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || 
                     "";

    if (!token) {
      return Response.json(
        {
          error: "Missing configuration token",
          message: "Please generate a mock URL using the MockFlow dashboard.",
        },
        { 
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
            "Access-Control-Allow-Headers": "*",
          }
        }
      );
    }

    let configText = token;
    let config: MockConfig;

    // Try decrypting if password is provided OR if decryption is needed
    if (password) {
      try {
        configText = await decryptPayload(token, password);
      } catch (err) {
        return Response.json(
          { error: "Decryption failed. Invalid password." },
          { 
            status: 401,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
              "Access-Control-Allow-Headers": "*",
            }
          }
        );
      }
    }

    // Decompress payload
    try {
      config = await decompressPayload(configText);
    } catch (err) {
      console.error("Decompression failed:", err);
      // If decompression fails and no password was provided, suggest encryption error
      if (!password) {
        return Response.json(
          {
            error: "Decompression failed. This mock endpoint might be password-protected.",
            message: "Provide the password via query param 'p', header 'X-Mock-Password', or 'Authorization: Bearer <password>'."
          },
          { 
            status: 401,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
              "Access-Control-Allow-Headers": "*",
            }
          }
        );
      }
      return Response.json(
        { error: "Failed to decompress configuration. Token might be corrupted or encrypted with a different password." },
        { 
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
            "Access-Control-Allow-Headers": "*",
          }
        }
      );
    }

    // Check if configuration is a collection
    let resolvedMock = config as any;
    const isCollection = config && Array.isArray((config as any).mocks);

    if (isCollection) {
      const requestPath = searchParams.get("path") || "";
      const cleanPath = (p: string) => p.toLowerCase().replace(/^\/+|\/+$/g, "");
      const normalizedReqPath = cleanPath(requestPath);

      // Handle OPTIONS preflight for collection endpoint
      if (request.method.toUpperCase() === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
            "Access-Control-Allow-Headers": "*",
          }
        });
      }

      if (!requestPath) {
        return Response.json(
          {
            error: "Missing 'path' query parameter to resolve mock from collection.",
            collection: (config as any).name,
            availableRoutes: (config as any).mocks.map((m: any) => ({
              name: m.name,
              endpoint: `${m.method} /api/mock?d=TOKEN&path=${m.path}`,
              method: m.method,
              path: m.path
            }))
          },
          {
            status: 400,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
              "Access-Control-Allow-Headers": "*",
            }
          }
        );
      }

      const matchedMock = (config as any).mocks.find((m: any) => {
        return cleanPath(m.path) === normalizedReqPath && m.method.toUpperCase() === request.method.toUpperCase();
      });

      if (!matchedMock) {
        return Response.json(
          {
            error: `Mock endpoint not found in collection for path '${requestPath}' and method '${request.method}'.`,
            collection: (config as any).name
          },
          {
            status: 404,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
              "Access-Control-Allow-Headers": "*",
            }
          }
        );
      }

      resolvedMock = matchedMock;
    }

    // Apply validation on query parameters if config exists
    if (resolvedMock.queryParams && Array.isArray(resolvedMock.queryParams)) {
      const validationError = validateQueryParams(resolvedMock.queryParams, searchParams);
      if (validationError) {
        return Response.json(
          {
            error: "Parameter Validation Error",
            message: validationError.message,
            details: validationError
          },
          {
            status: 400,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
              "Access-Control-Allow-Headers": "*",
            }
          }
        );
      }
    }

    // Apply delay (latency simulation)
    const delay = Number(searchParams.get("delay")) || resolvedMock.delay || 0;
    if (delay > 0) {
      const clampedDelay = Math.min(delay, 5000); // Clamped at 5s to avoid serverless gateway limits
      await sleep(clampedDelay);
    }

    // Prepare response headers
    const responseHeaders = new Headers();
    let hasContentType = false;
    let hasCors = false;

    if (resolvedMock.headers && Array.isArray(resolvedMock.headers)) {
      for (const h of resolvedMock.headers) {
        if (h.enabled && h.key && h.value) {
          responseHeaders.set(h.key, h.value);
          if (h.key.toLowerCase() === "content-type") hasContentType = true;
          if (h.key.toLowerCase() === "access-control-allow-origin") hasCors = true;
        }
      }
    }

    // Set fallback content-type
    if (!hasContentType) {
      try {
        if (resolvedMock.body) {
          JSON.parse(resolvedMock.body);
          responseHeaders.set("Content-Type", "application/json");
        } else {
          responseHeaders.set("Content-Type", "text/plain");
        }
      } catch {
        responseHeaders.set("Content-Type", "text/plain");
      }
    }

    // Set fallback CORS headers
    if (!hasCors) {
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD");
      responseHeaders.set("Access-Control-Allow-Headers", "*");
    }

    // Handle OPTIONS request pre-flight directly
    if (request.method.toUpperCase() === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: responseHeaders,
      });
    }

    // Prepare response body
    const bodyContent = resolvedMock.body || "";

    // Return simulated response
    return new Response(bodyContent, {
      status: resolvedMock.status || 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return Response.json(
      { error: "Internal Server Error", message: error.message },
      { 
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        }
      }
    );
  }
}

export async function GET(request: NextRequest) { return handleRequest(request); }
export async function POST(request: NextRequest) { return handleRequest(request); }
export async function PUT(request: NextRequest) { return handleRequest(request); }
export async function DELETE(request: NextRequest) { return handleRequest(request); }
export async function PATCH(request: NextRequest) { return handleRequest(request); }
export async function HEAD(request: NextRequest) { return handleRequest(request); }
export async function OPTIONS(request: NextRequest) { return handleRequest(request); }
