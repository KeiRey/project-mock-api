"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { decompressPayload, decryptPayload } from "../lib/crypto";
import { MockCollection, CollectionMock } from "../lib/types";

const formatRules = (p: any) => {
  const rules = [];
  if (p.regex) rules.push(`Pattern: /${p.regex}/`);
  if (p.enums) rules.push(`Allowed: ${p.enums.split(",").map((v: string) => v.trim()).join(" | ")}`);
  if (p.min !== undefined || p.max !== undefined) {
    if (p.type === "number") {
      if (p.min !== undefined && p.max !== undefined) rules.push(`Range: [${p.min}, ${p.max}]`);
      else if (p.min !== undefined) rules.push(`Min: ${p.min}`);
      else if (p.max !== undefined) rules.push(`Max: ${p.max}`);
    } else {
      if (p.min !== undefined && p.max !== undefined) rules.push(`Length: ${p.min}..${p.max}`);
      else if (p.min !== undefined) rules.push(`Min Length: ${p.min}`);
      else if (p.max !== undefined) rules.push(`Max Length: ${p.max}`);
    }
  }
  if (p.defaultValue !== undefined && p.defaultValue !== "") rules.push(`Default: "${p.defaultValue}"`);
  
  if (rules.length === 0) return "-";
  return (
    <div className="flex flex-wrap gap-1">
      {rules.map((r, idx) => (
        <span key={idx} className="bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[9px] px-1.5 py-0.5 rounded">
          {r}
        </span>
      ))}
    </div>
  );
};

export default function DocsContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("c") || "";
  const initialPassword = searchParams.get("p") || "";

  // Password / Cryptographic states
  const [password, setPassword] = useState(initialPassword);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [decryptError, setDecryptError] = useState("");
  const [decrypting, setDecrypting] = useState(false);

  // Loaded Collection Data
  const [collection, setCollection] = useState<MockCollection | null>(null);
  const [selectedMockIndex, setSelectedMockIndex] = useState<number>(0);
  const [origin, setOrigin] = useState("http://localhost:3000");

  // Sandbox Client States
  const [testHeaders, setTestHeaders] = useState<Array<{ key: string; value: string }>>([]);
  const [testBody, setTestBody] = useState("");
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [testStatusText, setTestStatusText] = useState("");
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [sandboxParams, setSandboxParams] = useState<Record<string, string>>({});

  const [copySuccess, setCopySuccess] = useState(false);

  // Get current active mock
  const activeMock: CollectionMock | null =
    collection && collection.mocks[selectedMockIndex] ? collection.mocks[selectedMockIndex] : null;

  // Set Origin
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // Pre-fill sandbox parameters with default values when active mock changes
  useEffect(() => {
    if (activeMock) {
      const initialParams: Record<string, string> = {};
      if (activeMock.queryParams) {
        activeMock.queryParams.forEach((p) => {
          if (p.name) {
            initialParams[p.name] = p.defaultValue || "";
          }
        });
      }
      setSandboxParams(initialParams);
    } else {
      setSandboxParams({});
    }
  }, [selectedMockIndex, collection]);

  // Decode collection on mount or when token/password changes
  useEffect(() => {
    if (!token) return;
    attemptLoadCollection(password);
  }, [token]);

  const attemptLoadCollection = async (passKey: string) => {
    setDecrypting(true);
    setDecryptError("");
    try {
      let configText = token;
      
      // If a password is key derived or decryption is attempted
      if (passKey) {
        try {
          configText = await decryptPayload(token, passKey);
        } catch {
          setDecryptError("Invalid decryption key. Please try again.");
          setNeedsPassword(true);
          setDecrypting(false);
          return;
        }
      }

      // Decompress
      try {
        const decoded = await decompressPayload(configText) as any;
        
        // Validate if it is a collection structure
        if (decoded && Array.isArray(decoded.mocks)) {
          setCollection(decoded as MockCollection);
          setNeedsPassword(false);
          setDecryptError("");
        } else {
          setDecryptError("Invalid token format. This doesn't seem to be an API collection.");
        }
      } catch (err) {
        // If decompress fails, it is likely encrypted and needs a password
        if (!passKey) {
          setNeedsPassword(true);
        } else {
          setDecryptError("Failed to decompress decrypted content. Token might be corrupted.");
        }
      }
    } catch (e: any) {
      setDecryptError(e.message || "An unexpected error occurred.");
    } finally {
      setDecrypting(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      attemptLoadCollection(password);
    }
  };

  // Build target mock resolver endpoint
  const getMockUrl = (mock: CollectionMock) => {
    if (!token) return "";
    let passParam = "";
    if (password) {
      passParam = `&p=${encodeURIComponent(password)}`;
    }
    return `${origin}/api/mock?d=${token}&path=${encodeURIComponent(mock.path)}${passParam}`;
  };

  // Get compact preview URL (excluding password param for safety)
  const getMockUrlPreview = (mock: CollectionMock) => {
    return `${origin}/api/mock?d=${token.substring(0, 15)}...&path=${mock.path}`;
  };

  // Copy helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Sandbox requester
  const runSandboxTest = async () => {
    if (!activeMock) return;
    setTesting(true);
    setTestError("");
    setTestStatus(null);
    setTestHeaders([]);
    setTestBody("");
    setTestLatency(null);

    const startTime = performance.now();
    try {
      // Build request query parameters
      const finalParams = new URLSearchParams();
      finalParams.append("d", token);
      if (password) finalParams.append("p", password);
      finalParams.append("path", activeMock.path);

      // Append sandbox input parameters
      Object.entries(sandboxParams).forEach(([key, val]) => {
        if (val.trim() !== "") {
          finalParams.append(key, val);
        }
      });

      const url = `${origin}/api/mock?${finalParams.toString()}`;
      
      const response = await fetch(url, {
        method: activeMock.method,
        // Send body if method supports it
        body: (activeMock.method !== "GET" && activeMock.method !== "HEAD") ? activeMock.body : undefined,
      });

      const endTime = performance.now();
      setTestLatency(Math.round(endTime - startTime));
      setTestStatus(response.status);
      setTestStatusText(response.statusText);

      // Extract response headers
      const resHeaders: Array<{ key: string; value: string }> = [];
      response.headers.forEach((value, key) => {
        resHeaders.push({ key, value });
      });
      setTestHeaders(resHeaders);

      // Extract body
      const text = await response.text();
      try {
        const parsed = JSON.parse(text);
        setTestBody(JSON.stringify(parsed, null, 2));
      } catch {
        setTestBody(text || "(Empty Response Body)");
      }
    } catch (err: any) {
      setTestError(err.message || "Failed to dispatch test request");
    } finally {
      setTesting(false);
    }
  };

  // 1. Missing Token State
  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-rose-950/50 border border-rose-900/30 flex items-center justify-center text-rose-400 mx-auto">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-zinc-200">No Collection Specified</h1>
          <p className="text-sm text-zinc-400 leading-normal">
            No API collection token was found in the URL parameter. Please build a collection in the Dashboard first.
          </p>
          <a
            href="/"
            className="inline-block w-full bg-violet-600 hover:bg-violet-500 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)]"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // 2. Encryption Password Form State
  if (needsPassword) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="bg-mesh" />
        <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-2xl p-8 max-w-md w-full space-y-5 shadow-2xl relative">
          <div className="w-12 h-12 rounded-xl bg-violet-950/60 border border-violet-900/30 flex items-center justify-center text-violet-400 mx-auto shadow-[0_0_15px_rgba(139,92,246,0.3)]">
            <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          
          <div className="text-center space-y-2">
            <h1 className="text-lg font-bold text-zinc-200">Decryption Required</h1>
            <p className="text-xs text-zinc-400 leading-normal">
              This API collection is password-protected. Provide the correct key to decrypt and load the developer portal.
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <input
                type="password"
                placeholder="Enter Collection Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-violet-500 font-mono transition-colors"
                autoFocus
              />
            </div>

            {decryptError && (
              <p className="text-xs text-rose-400 font-mono text-center">{decryptError}</p>
            )}

            <button
              type="submit"
              disabled={decrypting}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)]"
            >
              {decrypting ? "Decrypting..." : "Decrypt & Load Docs"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. Loading State
  if (!collection) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center font-mono">
        <svg className="w-8 h-8 animate-spin text-violet-500 mb-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-xs text-zinc-500 tracking-wider uppercase animate-pulse">Decrypting and loading documentation...</span>
      </div>
    );
  }

  // 4. Complete Document Portal UI
  return (
    <div className="relative min-h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      <div className="bg-mesh" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-[-1]" />

      {/* Header bar */}
      <header className="border-b border-zinc-900 bg-zinc-950/75 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-fuchsia-600 shadow-[0_0_15px_rgba(139,92,246,0.5)]">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-base text-zinc-200">
                MockFlow Portal
              </span>
              <span className="text-[10px] text-zinc-500 font-mono border border-zinc-800/80 rounded px-1.5 py-0.5 ml-2 bg-zinc-900/40 hidden sm:inline-block">
                API Docs
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            {password && (
              <span 
                title="Decrypted successfully"
                className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-lg"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="hidden sm:inline">Decrypted</span>
              </span>
            )}
            <a
              href="/"
              title="Dashboard"
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 p-2 md:px-3.5 md:py-1.5 rounded-lg text-zinc-300 transition-all font-medium flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="hidden sm:inline">Dashboard</span>
            </a>
          </div>
        </div>
      </header>

      {/* Grid Documentation Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row gap-6 px-4 sm:px-6 lg:px-8 py-8 relative">
        
        {/* Left Sidebar: Endpoints */}
        <aside className="w-full md:w-64 flex-shrink-0 space-y-4">
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <div>
              <h1 className="text-base font-bold text-zinc-100 break-words">{collection.name}</h1>
              {collection.description && (
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed break-words">{collection.description}</p>
              )}
            </div>
            
            <div className="border-t border-zinc-900 pt-4 space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">ENDPOINTS ({collection.mocks.length})</span>
              <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                {collection.mocks.map((m, idx) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedMockIndex(idx);
                      // Reset sandbox states on switch
                      setTestStatus(null);
                      setTestBody("");
                      setTestLatency(null);
                      setTestError("");
                    }}
                    className={`w-full text-left p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 border transition-all ${
                      selectedMockIndex === idx
                        ? "bg-violet-950/30 border-violet-900/50 text-violet-300"
                        : "bg-transparent border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30"
                    }`}
                  >
                    <span className={`w-12 text-center text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${
                      m.method === "GET" ? "bg-emerald-950/80 text-emerald-400" :
                      m.method === "POST" ? "bg-blue-950/80 text-blue-400" :
                      m.method === "PUT" ? "bg-amber-950/80 text-amber-400" :
                      m.method === "DELETE" ? "bg-rose-950/80 text-rose-400" :
                      "bg-zinc-800 text-zinc-400"
                    }`}>
                      {m.method}
                    </span>
                    <span className="font-mono truncate flex-1">{m.path}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Content Section (Details & Sandbox) */}
        {activeMock ? (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Middle: Details */}
            <div className="lg:col-span-7 space-y-6">
              {/* Endpoint Information */}
              <div className="glass-panel rounded-2xl p-6 space-y-5">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">ENDPOINT NAME</span>
                  <h2 className="text-lg font-bold text-zinc-200">{activeMock.name || "Mock Endpoint"}</h2>
                </div>

                {/* HTTP URI display */}
                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">RESOLVER API URL</span>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-zinc-950 border border-zinc-900 rounded-xl px-3 py-2 text-xs font-mono text-zinc-400 overflow-x-auto whitespace-nowrap scrollbar-none flex items-center select-all">
                      {getMockUrlPreview(activeMock)}
                    </div>
                    <button
                      onClick={() => copyToClipboard(getMockUrl(activeMock))}
                      className={`px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-all ${
                        copySuccess
                          ? "bg-emerald-950 border-emerald-800 text-emerald-400"
                          : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {copySuccess ? "Copied" : "Copy URL"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-zinc-900/20 p-3.5 border border-zinc-900 rounded-xl">
                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold block uppercase mb-1">Status Code</span>
                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                      activeMock.status >= 200 && activeMock.status < 300 ? "bg-emerald-950 text-emerald-400" :
                      activeMock.status >= 300 && activeMock.status < 400 ? "bg-amber-950 text-amber-400" :
                      "bg-rose-950 text-rose-400"
                    }`}>
                      {activeMock.status}
                    </span>
                  </div>
                  {activeMock.delay && activeMock.delay > 0 ? (
                    <div>
                      <span className="text-[10px] text-zinc-500 font-bold block uppercase mb-1">Simulated Latency</span>
                      <span className="text-xs font-bold font-mono text-violet-400 bg-violet-950/40 px-2 py-0.5 rounded border border-violet-900/30">
                        {activeMock.delay} ms
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Request Parameters table */}
              {activeMock.queryParams && activeMock.queryParams.length > 0 && (
                <div className="glass-panel rounded-2xl p-6 space-y-3">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block border-b border-zinc-900 pb-2">Request Parameters (Query Params)</span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-900 text-zinc-500 font-mono text-[9px]">
                          <th className="py-2 pr-4 font-semibold uppercase tracking-wider">Parameter</th>
                          <th className="py-2 pr-4 font-semibold uppercase tracking-wider">Type</th>
                          <th className="py-2 pr-4 font-semibold uppercase tracking-wider">Required</th>
                          <th className="py-2 pr-4 font-semibold uppercase tracking-wider">Validation Rules</th>
                          <th className="py-2 font-semibold uppercase tracking-wider">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeMock.queryParams.map((p, i) => (
                          <tr key={i} className="border-b border-zinc-900/50 last:border-b-0">
                            <td className="py-2.5 pr-4 font-mono font-bold text-zinc-300">
                              {p.name}
                              {p.required && <span className="text-rose-500 ml-0.5">*</span>}
                            </td>
                            <td className="py-2.5 pr-4">
                              <span className="bg-zinc-900 text-zinc-400 font-mono px-1.5 py-0.5 rounded text-[10px]">
                                {p.type}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4">
                              <span className={`font-mono text-[10px] ${p.required ? "text-rose-400 font-bold" : "text-zinc-600"}`}>
                                {p.required ? "required" : "optional"}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4">
                              {formatRules(p)}
                            </td>
                            <td className="py-2.5 text-zinc-400 leading-normal">{p.description || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Custom response headers */}
              {activeMock.headers && activeMock.headers.length > 0 && (
                <div className="glass-panel rounded-2xl p-6 space-y-3">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block border-b border-zinc-900 pb-2">Response Headers</span>
                  <div className="space-y-2">
                    {activeMock.headers.map((h, i) => (
                      <div key={i} className="flex gap-2 text-xs font-mono py-1 border-b border-zinc-900/50 last:border-b-0">
                        <span className="text-violet-400 font-semibold w-1/3 truncate">{h.key}:</span>
                        <span className="text-zinc-300 flex-1 break-all">{h.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Response payload body */}
              {activeMock.body && (
                <div className="glass-panel rounded-2xl p-6 space-y-3">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block border-b border-zinc-900 pb-2">Response Body</span>
                  <pre className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 text-xs font-mono text-zinc-200 overflow-x-auto max-h-[300px] leading-relaxed">
                    {activeMock.body}
                  </pre>
                </div>
              )}
            </div>

            {/* Right Sandbox Tester */}
            <div className="lg:col-span-5 space-y-6">
              <div className="glass-panel rounded-2xl p-6 border-zinc-800 shadow-xl relative">
                <div className="flex justify-between items-center border-b border-zinc-900 pb-3 mb-4">
                  <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2 uppercase tracking-wide">
                    <span className="w-1.5 h-3 bg-violet-500 rounded-full" />
                    Interactive Client
                  </h2>
                  <button
                    onClick={runSandboxTest}
                    disabled={testing}
                    className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50 px-4 py-1.5 rounded-lg text-white font-semibold transition-all shadow-[0_0_15px_rgba(139,92,246,0.2)] active:scale-[0.98]"
                  >
                    {testing ? "Sending..." : "Test Route"}
                  </button>
                </div>

                {/* Query params inputs section */}
                {activeMock.queryParams && activeMock.queryParams.length > 0 && (
                  <div className="mb-4 bg-zinc-900/30 p-3.5 border border-zinc-900 rounded-xl space-y-3">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Sandbox Query Params</span>
                    <div className="grid grid-cols-1 gap-2.5">
                      {activeMock.queryParams.map((p) => (
                        <div key={p.name} className="flex items-center gap-2">
                          <label className="w-1/3 text-xs font-mono text-zinc-400 truncate flex items-center">
                            {p.name}
                            {p.required && <span className="text-rose-500 ml-0.5">*</span>}
                          </label>
                          <input
                            type="text"
                            placeholder={p.description || p.type}
                            value={sandboxParams[p.name] || ""}
                            onChange={(e) => setSandboxParams({ ...sandboxParams, [p.name]: e.target.value })}
                            className="flex-1 bg-zinc-950 border border-zinc-900 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-300 focus:outline-none focus:border-violet-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Test Terminal */}
                <div className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden font-mono text-xs">
                  <div className="bg-zinc-900/60 px-4 py-2 border-b border-zinc-900/80 flex items-center justify-between text-zinc-500 text-[9px]">
                    <span>SANDBOX PREVIEW</span>
                    {testLatency !== null && (
                      <span className="text-emerald-500 font-bold">{testLatency} ms</span>
                    )}
                  </div>

                  <div className="p-4 space-y-4 min-h-[200px] max-h-[350px] overflow-y-auto">
                    {testing ? (
                      <div className="flex flex-col items-center justify-center py-16 space-y-2 text-zinc-600 animate-pulse">
                        <svg className="w-8 h-8 animate-spin text-zinc-700" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Requesting edge handler...</span>
                      </div>
                    ) : testStatus !== null ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500">Status:</span>
                          <span className={`px-2 py-0.5 rounded font-bold ${
                            testStatus >= 200 && testStatus < 300 ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/50" :
                            testStatus >= 300 && testStatus < 400 ? "bg-amber-950/60 text-amber-400 border border-amber-900/50" :
                            "bg-rose-950/60 text-rose-400 border border-rose-900/50"
                          }`}>
                            {testStatus} {testStatusText}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">Headers</span>
                          <div className="bg-zinc-900/40 p-2 rounded-lg border border-zinc-900 space-y-1 text-[11px] max-h-[100px] overflow-y-auto">
                            {testHeaders.map((h, i) => (
                              <div key={i} className="flex gap-2">
                                <span className="text-violet-400 font-semibold">{h.key}:</span>
                                <span className="text-zinc-300 break-all">{h.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">Response Body</span>
                          <pre className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-900 text-zinc-200 overflow-x-auto max-h-[150px]">
                            {testBody}
                          </pre>
                        </div>
                      </div>
                    ) : testError ? (
                      <div className="bg-rose-950/30 border border-rose-900/50 text-rose-400 p-4 rounded-xl space-y-1 text-xs">
                        <div className="font-bold">Fetch Error</div>
                        <p>{testError}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-zinc-600 space-y-2">
                        <svg className="w-8 h-8 text-zinc-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="text-[10px] uppercase tracking-wide">Ready to test</span>
                        <p className="text-[9px] text-zinc-700 text-center max-w-[180px]">Click &quot;Test Route&quot; above to request dynamic mock</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center py-20 text-zinc-500">
            Select an endpoint from the sidebar to view documentation.
          </div>
        )}
      </div>
    </div>
  );
}
