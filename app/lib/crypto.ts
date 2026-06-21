import { MockConfig } from "./types";

// Helper: Convert ArrayBuffer to URL-safe Base64
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Helper: Convert URL-safe Base64 to ArrayBuffer
function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Compression: JSON -> GZIP/Deflate -> base64url
export async function compressPayload(config: MockConfig): Promise<string> {
  const str = JSON.stringify(config);
  const stream = new Blob([str]).stream();
  const compressedStream = stream.pipeThrough(new CompressionStream("deflate"));
  
  const reader = compressedStream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  let totalLength = 0;
  for (const chunk of chunks) totalLength += chunk.length;
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return arrayBufferToBase64Url(result.buffer);
}

// Decompression: base64url -> GZIP/Deflate -> JSON
export async function decompressPayload(token: string): Promise<MockConfig> {
  const buffer = base64UrlToArrayBuffer(token);
  const stream = new Blob([buffer]).stream();
  const decompressedStream = stream.pipeThrough(new DecompressionStream("deflate"));
  
  const reader = decompressedStream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  let totalLength = 0;
  for (const chunk of chunks) totalLength += chunk.length;
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  const text = new TextDecoder().decode(result);
  return JSON.parse(text);
}

// Encryption key derivation using PBKDF2
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: 10000, // Reduced from 100k to ensure fast serverless execution (<10ms)
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encryption: AES-GCM
export async function encryptPayload(text: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(secret, salt);
  
  const encryptedContent = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    data
  );
  
  const combined = new Uint8Array(16 + 12 + encryptedContent.byteLength);
  combined.set(salt, 0);
  combined.set(iv, 16);
  combined.set(new Uint8Array(encryptedContent), 28);
  
  return arrayBufferToBase64Url(combined.buffer);
}

// Decryption: AES-GCM
export async function decryptPayload(encryptedToken: string, secret: string): Promise<string> {
  const buffer = base64UrlToArrayBuffer(encryptedToken);
  const combined = new Uint8Array(buffer);
  
  if (combined.length < 28) {
    throw new Error("Invalid encrypted payload");
  }
  
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);
  
  const key = await deriveKey(secret, salt);
  
  const decryptedContent = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    ciphertext
  );
  
  return new TextDecoder().decode(decryptedContent);
}
