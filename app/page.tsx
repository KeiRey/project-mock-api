"use client";

import { useState, useEffect } from "react";
import { compressPayload, encryptPayload } from "./lib/crypto";
import { MockHeader, MockConfig, MockParameter } from "./lib/types";

// Standard HTTP Status codes list
const HTTP_STATUS_LIST = [
  { code: 200, name: "OK", type: "success" },
  { code: 201, name: "Created", type: "success" },
  { code: 202, name: "Accepted", type: "success" },
  { code: 204, name: "No Content", type: "success" },
  { code: 301, name: "Moved Permanently", type: "redirect" },
  { code: 302, name: "Found", type: "redirect" },
  { code: 400, name: "Bad Request", type: "client_error" },
  { code: 401, name: "Unauthorized", type: "client_error" },
  { code: 403, name: "Forbidden", type: "client_error" },
  { code: 404, name: "Not Found", type: "client_error" },
  { code: 409, name: "Conflict", type: "client_error" },
  { code: 422, name: "Unprocessable Entity", type: "client_error" },
  { code: 429, name: "Too Many Requests", type: "client_error" },
  { code: 500, name: "Internal Server Error", type: "server_error" },
  { code: 502, name: "Bad Gateway", type: "server_error" },
  { code: 503, name: "Service Unavailable", type: "server_error" },
];

// Default headers suggestions
const STANDARD_HEADERS = [
  "Content-Type",
  "Access-Control-Allow-Origin",
  "Access-Control-Allow-Headers",
  "Access-Control-Allow-Methods",
  "Cache-Control",
  "Authorization",
  "X-MockFlow-Stateless",
];

export default function Home() {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"builder" | "echo" | "collection">("builder");

  // State: Collection Builder
  const [collectionName, setCollectionName] = useState("My Stateless Collection");
  const [collectionDescription, setCollectionDescription] = useState("A stateless group of mocked API endpoints.");
  const [collectionMocks, setCollectionMocks] = useState<any[]>([
    {
      id: "mock_1",
      name: "Get Users List",
      path: "/users",
      method: "GET",
      status: 200,
      headers: [{ key: "Content-Type", value: "application/json", enabled: true }],
      body: JSON.stringify([{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }], null, 2),
      delay: 0,
      queryParams: [
        { name: "limit", type: "number", required: false, description: "Maximum number of items to return" },
        { name: "role", type: "string", required: false, description: "Filter users by role" }
      ]
    },
    {
      id: "mock_2",
      name: "Create User",
      path: "/users",
      method: "POST",
      status: 201,
      headers: [{ key: "Content-Type", value: "application/json", enabled: true }],
      body: JSON.stringify({ success: true, id: 3 }, null, 2),
      delay: 0,
      queryParams: []
    }
  ]);
  const [activeColMockIndex, setActiveColMockIndex] = useState(0);
  
  // Collection Output URL states
  const [collectionToken, setCollectionToken] = useState("");
  const [colGenerating, setColGenerating] = useState(false);
  const [colPassword, setColPassword] = useState("");
  const [colEncryptEnabled, setColEncryptEnabled] = useState(false);
  const [colCopySuccess, setColCopySuccess] = useState(false);

  // State: Mock Config
  const [method, setMethod] = useState("GET");
  const [status, setStatus] = useState(200);
  const [statusName, setStatusName] = useState("OK");
  const [headers, setHeaders] = useState<MockHeader[]>([
    { key: "Content-Type", value: "application/json", enabled: true },
    { key: "Access-Control-Allow-Origin", value: "*", enabled: true },
  ]);
  const [body, setBody] = useState(
    JSON.stringify({ status: "success", message: "Hello from MockFlow Stateless!" }, null, 2)
  );
  
  // Premium Config
  const [delay, setDelay] = useState(0);
  const [password, setPassword] = useState("");
  const [encryptEnabled, setEncryptEnabled] = useState(false);
  const [singleQueryParams, setSingleQueryParams] = useState<MockParameter[]>([]);
  const [expandedColParams, setExpandedColParams] = useState<Record<number, boolean>>({});
  const [expandedSingleParams, setExpandedSingleParams] = useState<Record<number, boolean>>({});

  // Computed / System State
  const [origin, setOrigin] = useState("https://mockflow.vercel.app");
  const [token, setToken] = useState("");
  const [generating, setGenerating] = useState(false);
  const [jsonError, setJsonError] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  // State: API Sandbox Client
  const [testHeaders, setTestHeaders] = useState<Array<{ key: string; value: string }>>([]);
  const [testBody, setTestBody] = useState("");
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [testStatusText, setTestStatusText] = useState("");
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [sandboxSingleParams, setSandboxSingleParams] = useState<Record<string, string>>({});

  // State: Echo Console Webhook Client
  const [echoMethod, setEchoMethod] = useState("POST");
  const [echoParams, setEchoParams] = useState<Array<{ key: string; value: string }>>([
    { key: "source", value: "webhook" }
  ]);
  const [echoHeaders, setEchoHeaders] = useState<Array<{ key: string; value: string }>>([
    { key: "Content-Type", value: "application/json" },
    { key: "X-Webhook-Signature", value: "sha256_mock_sig_12345" }
  ]);
  const [echoBody, setEchoBody] = useState(
    JSON.stringify({ event: "user.created", data: { id: "usr_99", email: "alice@example.com" } }, null, 2)
  );
  const [echoResponse, setEchoResponse] = useState<any>(null);
  const [echoTesting, setEchoTesting] = useState(false);
  const [echoError, setEchoError] = useState("");

  // Fetch window origin
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // Update Status Name automatically
  useEffect(() => {
    const found = HTTP_STATUS_LIST.find((s) => s.code === Number(status));
    if (found) {
      setStatusName(found.name);
    } else {
      setStatusName("Custom Status");
    }
  }, [status]);

  // Pre-fill dashboard sandbox parameters with default values when query params config changes
  useEffect(() => {
    const initialParams: Record<string, string> = {};
    singleQueryParams.forEach((p) => {
      if (p.name) {
        initialParams[p.name] = p.defaultValue || "";
      }
    });
    setSandboxSingleParams(initialParams);
  }, [singleQueryParams]);

  // Real-time URL compilation with debouncing
  useEffect(() => {
    const updateUrl = async () => {
      setGenerating(true);
      try {
        const config: MockConfig = {
          method,
          status: Number(status) || 200,
          headers: headers.filter((h) => h.key.trim() !== "" && h.enabled),
          body,
          delay: delay > 0 ? delay : undefined,
          isEncrypted: encryptEnabled && !!password,
          queryParams: singleQueryParams.filter((p) => p.name.trim() !== ""),
        };

        const compressed = await compressPayload(config);
        let finalToken = "";
        if (encryptEnabled && password) {
          finalToken = await encryptPayload(compressed, password);
        } else {
          finalToken = compressed;
        }
        setToken(finalToken);
      } catch (err) {
        console.error("Encoding error:", err);
      } finally {
        setGenerating(false);
      }
    };

    const debounce = setTimeout(updateUrl, 300);
    return () => clearTimeout(debounce);
  }, [method, status, headers, body, delay, password, encryptEnabled, singleQueryParams]);

  // Real-time collection URL compilation with debouncing
  useEffect(() => {
    const updateCollectionUrl = async () => {
      setColGenerating(true);
      try {
        const payload = {
          name: collectionName,
          description: collectionDescription,
          mocks: collectionMocks,
          isEncrypted: colEncryptEnabled && !!colPassword,
        };

        const compressed = await compressPayload(payload as any);
        let finalToken = "";
        if (colEncryptEnabled && colPassword) {
          finalToken = await encryptPayload(compressed, colPassword);
        } else {
          finalToken = compressed;
        }
        setCollectionToken(finalToken);
      } catch (err) {
        console.error("Collection encoding error:", err);
      } finally {
        setColGenerating(false);
      }
    };

    const debounce = setTimeout(updateCollectionUrl, 300);
    return () => clearTimeout(debounce);
  }, [collectionName, collectionDescription, collectionMocks, colPassword, colEncryptEnabled]);

  // Headers Manager utilities
  const addHeaderRow = () => {
    setHeaders([...headers, { key: "", value: "", enabled: true }]);
  };

  const removeHeaderRow = (index: number) => {
    const newHeaders = [...headers];
    newHeaders.splice(index, 1);
    setHeaders(newHeaders);
  };

  const updateHeaderRow = (index: number, fields: Partial<MockHeader>) => {
    const newHeaders = [...headers];
    newHeaders[index] = { ...newHeaders[index], ...fields };
    setHeaders(newHeaders);
  };

  // JSON Body format utility
  const formatJSON = () => {
    try {
      const parsed = JSON.parse(body);
      setBody(JSON.stringify(parsed, null, 2));
      setJsonError("");
    } catch (err: any) {
      setJsonError("Invalid JSON: " + err.message);
    }
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    if (!value.trim()) {
      setJsonError("");
      return;
    }
    try {
      JSON.parse(value);
      setJsonError("");
    } catch {
      setJsonError("Warning: Payload is not standard JSON.");
    }
  };

  // Generate Endpoint URL
  const getMockUrl = () => {
    if (!token) return "";
    return `${origin}/api/mock?d=${token}`;
  };

  // Click to Copy utility
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Get Curl Command string
  const getCurlCommand = () => {
    const url = getMockUrl();
    if (!url) return "";
    let passHeader = "";
    if (encryptEnabled && password) {
      passHeader = ` -H "X-Mock-Password: ${password}"`;
    }
    return `curl -X ${method}${passHeader} "${url}"`;
  };

  // Run Mock Test Sandbox
  const runSandboxTest = async () => {
    setTesting(true);
    setTestError("");
    setTestStatus(null);
    setTestHeaders([]);
    setTestBody("");
    setTestLatency(null);

    const startTime = performance.now();
    try {
      let finalUrl = getMockUrl();
      if (finalUrl) {
        const urlObj = new URL(finalUrl);
        Object.entries(sandboxSingleParams).forEach(([key, val]) => {
          if (val.trim() !== "") {
            urlObj.searchParams.append(key, val);
          }
        });
        finalUrl = urlObj.toString();
      }

      const requestHeaders: Record<string, string> = {};
      if (encryptEnabled && password) {
        requestHeaders["X-Mock-Password"] = password;
      }
      
      const response = await fetch(finalUrl, {
        method: method,
        headers: requestHeaders,
        // Send body if method supports it
        body: (method !== "GET" && method !== "HEAD") ? body : undefined,
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
      setTestError(err.message || "Failed to establish connection");
    } finally {
      setTesting(false);
    }
  };

  // Webhook Echo Console utilities
  const runEchoTest = async () => {
    setEchoTesting(true);
    setEchoError("");
    setEchoResponse(null);

    try {
      // Build query string
      const qParams = new URLSearchParams();
      echoParams.forEach((p) => {
        if (p.key.trim()) qParams.append(p.key, p.value);
      });
      const qStr = qParams.toString() ? `?${qParams.toString()}` : "";

      const echoUrl = `${origin}/api/echo${qStr}`;

      // Build headers
      const headersMap: Record<string, string> = {};
      echoHeaders.forEach((h) => {
        if (h.key.trim()) headersMap[h.key] = h.value;
      });

      const options: RequestInit = {
        method: echoMethod,
        headers: headersMap,
      };

      if (echoMethod !== "GET" && echoMethod !== "HEAD") {
        options.body = echoBody;
      }

      const response = await fetch(echoUrl, options);
      const data = await response.json();
      setEchoResponse(data);
    } catch (err: any) {
      setEchoError(err.message || "Failed to send webhook event");
    } finally {
      setEchoTesting(false);
    }
  };

  // Collection Builder State Updates
  const updateActiveColMock = (fields: any) => {
    const updated = [...collectionMocks];
    if (updated[activeColMockIndex]) {
      updated[activeColMockIndex] = { ...updated[activeColMockIndex], ...fields };
      setCollectionMocks(updated);
    }
  };

  const addCollectionMock = () => {
    const newMock = {
      id: `mock_${Date.now()}`,
      name: `New Endpoint`,
      path: `/api-path-${collectionMocks.length + 1}`,
      method: "GET",
      status: 200,
      headers: [{ key: "Content-Type", value: "application/json", enabled: true }],
      body: JSON.stringify({ message: "Hello!" }, null, 2),
      delay: 0,
    };
    setCollectionMocks([...collectionMocks, newMock]);
    setActiveColMockIndex(collectionMocks.length);
  };

  const deleteCollectionMock = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (collectionMocks.length <= 1) {
      alert("A collection must contain at least one mock endpoint.");
      return;
    }
    const updated = [...collectionMocks];
    updated.splice(index, 1);
    setCollectionMocks(updated);
    if (activeColMockIndex >= updated.length) {
      setActiveColMockIndex(updated.length - 1);
    }
  };

  const addColMockHeader = () => {
    const active = collectionMocks[activeColMockIndex];
    if (active) {
      const updatedHeaders = [...(active.headers || []), { key: "", value: "", enabled: true }];
      updateActiveColMock({ headers: updatedHeaders });
    }
  };

  const removeColMockHeader = (headerIndex: number) => {
    const active = collectionMocks[activeColMockIndex];
    if (active) {
      const updatedHeaders = [...(active.headers || [])];
      updatedHeaders.splice(headerIndex, 1);
      updateActiveColMock({ headers: updatedHeaders });
    }
  };

  const updateColMockHeader = (headerIndex: number, fields: Partial<MockHeader>) => {
    const active = collectionMocks[activeColMockIndex];
    if (active) {
      const updatedHeaders = [...(active.headers || [])];
      updatedHeaders[headerIndex] = { ...updatedHeaders[headerIndex], ...fields };
      updateActiveColMock({ headers: updatedHeaders });
    }
  };

  const addColMockQueryParam = () => {
    const active = collectionMocks[activeColMockIndex];
    if (active) {
      const updatedParams = [...(active.queryParams || []), { name: "", type: "string", required: false, description: "" }];
      updateActiveColMock({ queryParams: updatedParams });
    }
  };

  const removeColMockQueryParam = (paramIndex: number) => {
    const active = collectionMocks[activeColMockIndex];
    if (active) {
      const updatedParams = [...(active.queryParams || [])];
      updatedParams.splice(paramIndex, 1);
      updateActiveColMock({ queryParams: updatedParams });
    }
  };

  const updateColMockQueryParam = (paramIndex: number, fields: Partial<MockParameter>) => {
    const active = collectionMocks[activeColMockIndex];
    if (active) {
      const updatedParams = [...(active.queryParams || [])];
      updatedParams[paramIndex] = { ...updatedParams[paramIndex], ...fields };
      updateActiveColMock({ queryParams: updatedParams });
    }
  };

  const addSingleQueryParam = () => {
    setSingleQueryParams([...singleQueryParams, { name: "", type: "string", required: false, description: "" }]);
  };

  const removeSingleQueryParam = (paramIndex: number) => {
    const updatedParams = [...singleQueryParams];
    updatedParams.splice(paramIndex, 1);
    setSingleQueryParams(updatedParams);
  };

  const updateSingleQueryParam = (paramIndex: number, fields: Partial<MockParameter>) => {
    const updatedParams = [...singleQueryParams];
    updatedParams[paramIndex] = { ...updatedParams[paramIndex], ...fields };
    setSingleQueryParams(updatedParams);
  };

  // URL length and progress statistics
  const mockUrl = getMockUrl();
  const urlLen = mockUrl.length;
  const isTooLong = urlLen > 2048;
  const urlPercentage = Math.min((urlLen / 2048) * 100, 100);

  return (
    <div className="relative min-h-screen flex flex-col font-sans bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Background Radial Gradients */}
      <div className="bg-mesh" />

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-[-1]" />

      {/* Header section */}
      <header className="border-b border-zinc-800 bg-zinc-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Glowing Logo */}
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-fuchsia-600 shadow-[0_0_15px_rgba(139,92,246,0.5)]">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-lg bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                MockFlow
              </span>
              <span className="text-xs text-zinc-500 ml-2 font-mono border border-zinc-800 rounded px-1 py-0.5 bg-zinc-900/50">
                Stateless V2
              </span>
            </div>
          </div>

          {/* Navigation tabs in Header */}
          <nav className="flex items-center gap-1 bg-zinc-900/80 border border-zinc-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("builder")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === "builder"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-900/20"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Mock Builder
            </button>
            <button
              onClick={() => setActiveTab("echo")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === "echo"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-900/20"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Webhook Echo
            </button>
            <button
              onClick={() => setActiveTab("collection")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === "collection"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-900/20"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Collection Builder
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        
        {/* Tab 1: Mock Builder */}
        {activeTab === "builder" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Form Controls */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Box 1: Configuration Form */}
              <div className="glass-panel rounded-2xl p-6 space-y-5">
                <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2 border-b border-zinc-900 pb-3">
                  <span className="w-1.5 h-3 bg-violet-500 rounded-full" />
                  1. Setup HTTP Method & Status
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* HTTP Method */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">Method</label>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500 font-bold transition-all duration-200"
                    >
                      {["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status Code Picker */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">Status Code</label>
                    <input
                      type="number"
                      value={status}
                      onChange={(e) => setStatus(Number(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500 font-mono transition-all duration-200"
                    />
                  </div>

                  {/* Quick Select Status Dropdown */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">Standard Presets</label>
                    <select
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val) setStatus(val);
                      }}
                      value={status}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-400 focus:outline-none focus:border-violet-500 transition-all duration-200"
                    >
                      {HTTP_STATUS_LIST.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/40 rounded-lg border border-zinc-900">
                  <span className="text-xs text-zinc-500">Resolved Status:</span>
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                    status >= 200 && status < 300 ? "bg-emerald-950 text-emerald-400" :
                    status >= 300 && status < 400 ? "bg-amber-950 text-amber-400" :
                    "bg-rose-950 text-rose-400"
                  }`}>
                    {status} {statusName}
                  </span>
                </div>
              </div>

              {/* Box 2: Headers Manager */}
              <div className="glass-panel rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                  <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
                    <span className="w-1.5 h-3 bg-violet-500 rounded-full" />
                    2. Response Headers
                  </h2>
                  <button
                    onClick={addHeaderRow}
                    className="flex items-center gap-1 text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-3 py-1.5 rounded-lg text-violet-400 hover:text-violet-300 font-medium transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Header
                  </button>
                </div>

                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {headers.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-6">No custom headers configured. Standard defaults will be applied.</p>
                  ) : (
                    headers.map((h, i) => (
                      <div key={i} className="flex gap-2 items-center bg-zinc-900/30 p-2 rounded-xl border border-zinc-900/50">
                        {/* Checkbox enabled */}
                        <input
                          type="checkbox"
                          checked={h.enabled}
                          onChange={(e) => updateHeaderRow(i, { enabled: e.target.checked })}
                          className="w-4 h-4 accent-violet-600 rounded bg-zinc-900 border-zinc-800 cursor-pointer"
                        />
                        
                        {/* Key with suggestion list */}
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder="Header Key (e.g. Content-Type)"
                            value={h.key}
                            onChange={(e) => updateHeaderRow(i, { key: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500 font-mono"
                            list="header-suggestions"
                          />
                        </div>

                        {/* Value */}
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Header Value"
                            value={h.value}
                            onChange={(e) => updateHeaderRow(i, { value: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500 font-mono"
                          />
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => removeHeaderRow(i)}
                          className="p-1.5 rounded-md hover:bg-rose-950/20 text-zinc-500 hover:text-rose-400 transition-colors"
                          title="Remove Header"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Datalist header suggestions */}
                <datalist id="header-suggestions">
                  {STANDARD_HEADERS.map((sh) => (
                    <option key={sh} value={sh} />
                  ))}
                </datalist>
              </div>

              {/* Box 3: Request Parameters (Query Params) */}
              <div className="glass-panel rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                  <div className="space-y-0.5">
                    <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
                      <span className="w-1.5 h-3 bg-violet-500 rounded-full" />
                      3. Request Parameters (Query Params)
                    </h2>
                    <p className="text-[10px] text-zinc-500">Define query parameter requirements and validation rules for this mock.</p>
                  </div>
                  <button
                    onClick={addSingleQueryParam}
                    className="flex items-center gap-1 text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-3 py-1.5 rounded-lg text-violet-400 hover:text-violet-300 font-medium transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Param
                  </button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {singleQueryParams.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-6">No request parameters configured. All query parameters will be accepted.</p>
                  ) : (
                    singleQueryParams.map((p, i) => (
                      <div key={i} className="flex flex-col bg-zinc-900/30 rounded-xl border border-zinc-900/50 overflow-hidden">
                        {/* Main Row */}
                        <div className="flex gap-2 items-center p-2.5 border-b border-zinc-900/30">
                          {/* Expand/Collapse Button */}
                          <button
                            onClick={() => setExpandedSingleParams(prev => ({ ...prev, [i]: !prev[i] }))}
                            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                            title="Advanced Rules"
                            type="button"
                          >
                            <svg className={`w-3 h-3 transform transition-transform ${expandedSingleParams[i] ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>

                          {/* Param Name */}
                          <input
                            type="text"
                            placeholder="Name (e.g. limit)"
                            value={p.name}
                            onChange={(e) => updateSingleQueryParam(i, { name: e.target.value })}
                            className="flex-1 bg-transparent border-none text-xs text-zinc-200 focus:outline-none font-mono"
                          />
                          
                          {/* Param Type */}
                          <select
                            value={p.type}
                            onChange={(e) => updateSingleQueryParam(i, { type: e.target.value })}
                            className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono focus:outline-none"
                          >
                            <option value="string">string</option>
                            <option value="number">number</option>
                            <option value="boolean">boolean</option>
                          </select>

                          {/* Required checkbox */}
                          <label className="flex items-center gap-1 cursor-pointer select-none text-[10px] text-zinc-500">
                            <input
                              type="checkbox"
                              checked={p.required}
                              onChange={(e) => updateSingleQueryParam(i, { required: e.target.checked })}
                              className="w-3 h-3 accent-violet-600 cursor-pointer"
                            />
                            Req
                          </label>

                          {/* Param Description */}
                          <input
                            type="text"
                            placeholder="Description"
                            value={p.description}
                            onChange={(e) => updateSingleQueryParam(i, { description: e.target.value })}
                            className="flex-1.5 bg-transparent border-none text-xs text-zinc-200 focus:outline-none font-mono"
                          />

                          {/* Remove button */}
                          <button
                            onClick={() => removeSingleQueryParam(i)}
                            className="p-1.5 rounded-md hover:bg-rose-950/20 text-zinc-500 hover:text-rose-400 transition-colors"
                            title="Remove Parameter"
                          >
                            &times;
                          </button>
                        </div>

                        {/* Expanded Advanced Rules Panel */}
                        {expandedSingleParams[i] && (
                          <div className="bg-zinc-950/40 p-3 border-t border-zinc-900/50 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            {/* Left Column: Regex & Enums */}
                            <div className="space-y-2">
                              <div>
                                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Regex Pattern</label>
                                <input
                                  type="text"
                                  placeholder="e.g. ^[0-9]+$"
                                  value={p.regex || ""}
                                  onChange={(e) => updateSingleQueryParam(i, { regex: e.target.value })}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-zinc-300 font-mono text-[10px] focus:outline-none focus:border-violet-500/50"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Allowed Values (Enum, comma-separated)</label>
                                <input
                                  type="text"
                                  placeholder="e.g. active, inactive"
                                  value={p.enums || ""}
                                  onChange={(e) => updateSingleQueryParam(i, { enums: e.target.value })}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-zinc-300 font-mono text-[10px] focus:outline-none focus:border-violet-500/50"
                                />
                              </div>
                            </div>

                            {/* Right Column: Min, Max, Default */}
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                                    {p.type === "number" ? "Min Value" : "Min Length"}
                                  </label>
                                  <input
                                    type="number"
                                    placeholder="No limit"
                                    value={p.min !== undefined ? p.min : ""}
                                    onChange={(e) => updateSingleQueryParam(i, { min: e.target.value === "" ? undefined : Number(e.target.value) })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-zinc-300 font-mono text-[10px] focus:outline-none focus:border-violet-500/50"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                                    {p.type === "number" ? "Max Value" : "Max Length"}
                                  </label>
                                  <input
                                    type="number"
                                    placeholder="No limit"
                                    value={p.max !== undefined ? p.max : ""}
                                    onChange={(e) => updateSingleQueryParam(i, { max: e.target.value === "" ? undefined : Number(e.target.value) })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-zinc-300 font-mono text-[10px] focus:outline-none focus:border-violet-500/50"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Default / Example Value</label>
                                <input
                                  type="text"
                                  placeholder="Pre-filled value in sandbox testing"
                                  value={p.defaultValue || ""}
                                  onChange={(e) => updateSingleQueryParam(i, { defaultValue: e.target.value })}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-zinc-300 font-mono text-[10px] focus:outline-none focus:border-violet-500/50"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Box 4: Response Payload Editor */}
              <div className="glass-panel rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                  <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
                    <span className="w-1.5 h-3 bg-violet-500 rounded-full" />
                    4. Response Body (JSON / Plaintext)
                  </h2>
                  <button
                    onClick={formatJSON}
                    className="text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-3 py-1.5 rounded-lg text-zinc-300 hover:text-zinc-200 font-medium transition-all"
                  >
                    Format Code
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    value={body}
                    onChange={(e) => handleBodyChange(e.target.value)}
                    rows={8}
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-4 text-xs text-zinc-200 font-mono focus:outline-none focus:border-violet-500 leading-normal focus:ring-1 focus:ring-violet-500/30"
                    placeholder='{"status": "success", "data": {}}'
                  />
                  {jsonError && (
                    <div className="absolute bottom-3 left-3 right-3 px-3 py-1.5 rounded bg-rose-950/80 border border-rose-900/50 text-[10px] text-rose-400 font-mono">
                      {jsonError}
                    </div>
                  )}
                </div>
              </div>

              {/* Box 4: Premium Features */}
              <div className="glass-panel rounded-2xl p-6 border-violet-500/20 shadow-lg shadow-violet-950/5">
                <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2 border-b border-zinc-900 pb-3">
                  <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  Premium Capabilities (Zero-Database)
                </h2>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Latency Simulator */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Simulate Latency
                      </span>
                      <span className="text-xs font-mono font-bold text-violet-400 bg-violet-950/40 px-2 py-0.5 rounded border border-violet-900/30">
                        {delay} ms
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5000"
                      step="100"
                      value={delay}
                      onChange={(e) => setDelay(Number(e.target.value))}
                      className="w-full accent-violet-500 h-1 bg-zinc-900 rounded-lg cursor-pointer appearance-none"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                      <span>0ms (Instant)</span>
                      <span>5s (Max)</span>
                    </div>
                  </div>

                  {/* AES-256 Encryption */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        AES-256 Encryption
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={encryptEnabled}
                          onChange={(e) => setEncryptEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4.5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-violet-600 peer-checked:after:bg-white" />
                      </label>
                    </div>

                    {encryptEnabled ? (
                      <div className="relative">
                        <input
                          type="password"
                          placeholder="Encryption Key / Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-zinc-950 border border-violet-900/50 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 font-mono"
                        />
                        <div className="mt-1 text-[10px] text-zinc-500 leading-normal">
                          Requires passing key via query parameter `?p=key` or header `X-Mock-Password` to resolve.
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10.5px] text-zinc-600 leading-normal py-1">
                        Client-side encryption encodes your mock config with a password so only those with the key can resolve or view it.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Console & Sharing */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Box 1: Sharing Links */}
              <div className="glass-panel rounded-2xl p-6 space-y-5 relative overflow-hidden">
                {/* Gradient Accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

                <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-fuchsia-500 rounded-full" />
                  Your Stateless URL
                </h2>

                {generating ? (
                  <div className="h-12 flex items-center justify-center bg-zinc-950/50 border border-zinc-900 rounded-xl">
                    <span className="text-xs text-zinc-500 flex items-center gap-2 animate-pulse">
                      <svg className="w-4 h-4 animate-spin text-violet-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Updating URL...
                    </span>
                  </div>
                ) : mockUrl ? (
                  <div className="space-y-4">
                    {/* Compact URL Box */}
                    <div className="flex gap-2">
                      <div className="flex-1 bg-zinc-950 border border-zinc-900 rounded-xl px-3 py-2.5 text-xs font-mono text-zinc-400 select-all overflow-x-auto whitespace-nowrap">
                        {mockUrl.substring(0, 100)}...
                      </div>
                      <button
                        onClick={() => copyToClipboard(mockUrl)}
                        className={`px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                          copySuccess
                            ? "bg-emerald-950 border-emerald-800 text-emerald-400"
                            : "bg-violet-600 hover:bg-violet-500 border-violet-600 text-white"
                        }`}
                      >
                        {copySuccess ? (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Copied
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>

                    {/* Progress indicator for Safe URL limits */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                        <span>Payload Size Stats</span>
                        <span className={isTooLong ? "text-rose-400 font-bold" : "text-zinc-400"}>
                          {urlLen} / 2048 chars ({Math.round(urlPercentage)}%)
                        </span>
                      </div>
                      <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            isTooLong ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]" :
                            urlLen > 1500 ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${urlPercentage}%` }}
                        />
                      </div>
                      {isTooLong && (
                        <p className="text-[9.5px] text-rose-400 leading-normal">
                          ⚠️ Warning: This payload exceeds the safe 2048 character limit. Browsers or HTTP clients might truncate the query params. Reduce your JSON body size.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600">Enter configurations to generate URL.</p>
                )}

                {/* cURL copy generator */}
                {mockUrl && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Copy as cURL</label>
                    <div className="relative">
                      <pre className="bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-[10.5px] font-mono text-zinc-500 overflow-x-auto whitespace-pre">
                        {getCurlCommand()}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(getCurlCommand())}
                        className="absolute right-2.5 top-2.5 p-1 rounded hover:bg-zinc-900 border border-transparent hover:border-zinc-800 text-zinc-500 hover:text-zinc-300 transition-all"
                        title="Copy command"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Box 2: API Sandbox Client */}
              <div className="glass-panel rounded-2xl p-6 border-zinc-800 shadow-xl relative">
                <div className="flex justify-between items-center border-b border-zinc-900 pb-3 mb-4">
                  <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
                    <span className="w-1.5 h-3 bg-violet-500 rounded-full" />
                    Mock Sandbox Client
                  </h2>
                  <button
                    onClick={runSandboxTest}
                    disabled={testing || !mockUrl}
                    className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border border-transparent disabled:opacity-50 px-3.5 py-1.5 rounded-lg text-white font-semibold transition-all shadow-[0_0_15px_rgba(139,92,246,0.2)] active:scale-[0.98]"
                  >
                    {testing ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Requesting...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        </svg>
                        Test Request
                      </>
                    )}
                  </button>
                </div>

                {/* Query params inputs section */}
                {singleQueryParams.length > 0 && (
                  <div className="mb-4 bg-zinc-900/30 p-3.5 border border-zinc-900 rounded-xl space-y-3">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Sandbox Query Params</span>
                    <div className="grid grid-cols-1 gap-2.5">
                      {singleQueryParams.filter(p => p.name.trim() !== "").map((p) => (
                        <div key={p.name} className="flex items-center gap-2">
                          <label className="w-1/3 text-xs font-mono text-zinc-400 truncate flex items-center">
                            {p.name}
                            {p.required && <span className="text-rose-500 ml-0.5">*</span>}
                          </label>
                          <input
                            type="text"
                            placeholder={p.description || p.type}
                            value={sandboxSingleParams[p.name] || ""}
                            onChange={(e) => setSandboxSingleParams({ ...sandboxSingleParams, [p.name]: e.target.value })}
                            className="flex-1 bg-zinc-950 border border-zinc-900 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-300 focus:outline-none focus:border-violet-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Test outputs window */}
                <div className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden font-mono text-xs">
                  {/* Title Bar */}
                  <div className="bg-zinc-900/60 px-4 py-2 border-b border-zinc-900/80 flex items-center justify-between text-zinc-500 text-[10px]">
                    <span>RESPONSE SANDBOX</span>
                    {testLatency !== null && (
                      <span className="text-emerald-500 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        {testLatency} ms
                      </span>
                    )}
                  </div>

                  <div className="p-4 space-y-4 min-h-[220px] max-h-[350px] overflow-y-auto">
                    {testing ? (
                      <div className="flex flex-col items-center justify-center py-16 space-y-2 text-zinc-600 animate-pulse">
                        <svg className="w-8 h-8 animate-spin text-zinc-700" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Dispatching request to serverless edge...</span>
                      </div>
                    ) : testStatus !== null ? (
                      <div className="space-y-4">
                        {/* Status bar */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-zinc-500">Status:</span>
                          <span className={`px-2 py-0.5 rounded font-bold ${
                            testStatus >= 200 && testStatus < 300 ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/50" :
                            testStatus >= 300 && testStatus < 400 ? "bg-amber-950/60 text-amber-400 border border-amber-900/50" :
                            "bg-rose-950/60 text-rose-400 border border-rose-900/50"
                          }`}>
                            {testStatus} {testStatusText}
                          </span>
                        </div>

                        {/* Headers */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Headers</span>
                          <div className="bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-900 space-y-1 text-[11px] max-h-[120px] overflow-y-auto">
                            {testHeaders.map((h, index) => (
                              <div key={index} className="flex gap-2">
                                <span className="text-violet-400 font-semibold">{h.key}:</span>
                                <span className="text-zinc-300 break-all">{h.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Body */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Body Payload</span>
                          <pre className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-900 text-zinc-200 overflow-x-auto whitespace-pre leading-relaxed max-h-[180px]">
                            {testBody}
                          </pre>
                        </div>
                      </div>
                    ) : testError ? (
                      <div className="bg-rose-950/30 border border-rose-900/50 text-rose-400 p-4 rounded-xl space-y-1 text-xs">
                        <div className="font-bold flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          Network Error
                        </div>
                        <p>{testError}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-zinc-600 space-y-2">
                        <svg className="w-10 h-10 text-zinc-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[11px] uppercase tracking-wide">Terminal Idle</span>
                        <p className="text-[10px] text-zinc-700 text-center max-w-[200px]">Click &quot;Test Request&quot; to invoke serverless handler</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Webhook Echo Console */}
        {activeTab === "echo" && (
          <div className="space-y-6">
            {/* Explanatory Header */}
            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
              <div className="space-y-2 max-w-2xl">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-500 shadow-[0_0_10px_#d946ef]" />
                  Stateless Webhook Echo Reflector
                </h2>
                <p className="text-sm text-zinc-400 leading-normal">
                  Our reflector route dynamically echoes back your request payloads. Use this endpoint to inspect what external payment providers, CMS engines, or custom webhook modules send to your backend in real-time.
                </p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 font-mono text-xs text-zinc-300 w-full md:w-auto break-all">
                <span className="text-zinc-500 font-semibold uppercase mr-2 text-[10px]">URL:</span>
                {origin}/api/echo
              </div>
            </div>

            {/* Test Console */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Form: Request parameters and headers */}
              <div className="lg:col-span-5 space-y-6">
                <div className="glass-panel rounded-2xl p-6 space-y-5">
                  <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider border-b border-zinc-900 pb-2">
                    Simulate Webhook Dispatcher
                  </h3>

                  {/* HTTP Method selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400">Method</label>
                    <div className="flex gap-2">
                      {["POST", "PUT", "PATCH", "GET"].map((m) => (
                        <button
                          key={m}
                          onClick={() => setEchoMethod(m)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                            echoMethod === m
                              ? "bg-violet-600 border-violet-500 text-white"
                              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Query Params manager */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-zinc-400">Query Parameters</label>
                      <button
                        onClick={() => setEchoParams([...echoParams, { key: "", value: "" }])}
                        className="text-[10px] text-violet-400 hover:underline"
                      >
                        + Add Param
                      </button>
                    </div>
                    {echoParams.map((p, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="key"
                          value={p.key}
                          onChange={(e) => {
                            const newP = [...echoParams];
                            newP[i].key = e.target.value;
                            setEchoParams(newP);
                          }}
                          className="flex-1 bg-zinc-950 border border-zinc-900 rounded-lg px-2 py-1.5 text-xs text-zinc-300 font-mono"
                        />
                        <input
                          type="text"
                          placeholder="value"
                          value={p.value}
                          onChange={(e) => {
                            const newP = [...echoParams];
                            newP[i].value = e.target.value;
                            setEchoParams(newP);
                          }}
                          className="flex-1 bg-zinc-950 border border-zinc-900 rounded-lg px-2 py-1.5 text-xs text-zinc-300 font-mono"
                        />
                        <button
                          onClick={() => {
                            const newP = [...echoParams];
                            newP.splice(i, 1);
                            setEchoParams(newP);
                          }}
                          className="text-zinc-600 hover:text-rose-400 text-xs px-1"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Webhook Headers manager */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-zinc-400">Headers</label>
                      <button
                        onClick={() => setEchoHeaders([...echoHeaders, { key: "", value: "" }])}
                        className="text-[10px] text-violet-400 hover:underline"
                      >
                        + Add Header
                      </button>
                    </div>
                    {echoHeaders.map((h, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Header-Key"
                          value={h.key}
                          onChange={(e) => {
                            const newH = [...echoHeaders];
                            newH[i].key = e.target.value;
                            setEchoHeaders(newH);
                          }}
                          className="flex-1 bg-zinc-950 border border-zinc-900 rounded-lg px-2 py-1.5 text-xs text-zinc-300 font-mono"
                        />
                        <input
                          type="text"
                          placeholder="value"
                          value={h.value}
                          onChange={(e) => {
                            const newH = [...echoHeaders];
                            newH[i].value = e.target.value;
                            setEchoHeaders(newH);
                          }}
                          className="flex-1 bg-zinc-950 border border-zinc-900 rounded-lg px-2 py-1.5 text-xs text-zinc-300 font-mono"
                        />
                        <button
                          onClick={() => {
                            const newH = [...echoHeaders];
                            newH.splice(i, 1);
                            setEchoHeaders(newH);
                          }}
                          className="text-zinc-600 hover:text-rose-400 text-xs px-1"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Webhook Payload Body */}
                  {echoMethod !== "GET" && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-zinc-400">Payload Body (JSON)</label>
                      <textarea
                        value={echoBody}
                        onChange={(e) => setEchoBody(e.target.value)}
                        rows={5}
                        className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs text-zinc-300 font-mono focus:outline-none focus:border-violet-500"
                        placeholder="{}"
                      />
                    </div>
                  )}

                  {/* Fire webhook trigger */}
                  <button
                    onClick={runEchoTest}
                    disabled={echoTesting}
                    className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 border border-transparent disabled:opacity-50 text-xs font-semibold text-white transition-all shadow-[0_0_15px_rgba(139,92,246,0.2)] active:scale-[0.98] flex items-center justify-center gap-1.5"
                  >
                    {echoTesting ? (
                      <>
                        <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Sending Event...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        Fire Webhook Payload
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right panel: Terminal response output */}
              <div className="lg:col-span-7 space-y-6">
                <div className="glass-panel rounded-2xl p-6 border-zinc-800 shadow-xl min-h-[350px] flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider border-b border-zinc-900 pb-2 flex justify-between items-center">
                      <span>Reflected Console Output</span>
                      <span className="text-[10px] text-zinc-500 font-mono lowercase">murni-stateless.log</span>
                    </h3>

                    {echoTesting ? (
                      <div className="flex flex-col items-center justify-center py-24 space-y-2 text-zinc-600 animate-pulse font-mono text-xs">
                        <svg className="w-8 h-8 animate-spin text-zinc-700" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Awaiting payload echo...</span>
                      </div>
                    ) : echoResponse ? (
                      <div className="space-y-4 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500">Reflector Status:</span>
                          <span className="px-2 py-0.5 rounded font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-900/50">
                            200 OK
                          </span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Echo Metadata</span>
                          <div className="bg-zinc-950 border border-zinc-900 p-3 rounded-lg space-y-1">
                            <div><span className="text-zinc-500">Client IP:</span> <span className="text-zinc-300 font-bold">{echoResponse.clientIp}</span></div>
                            <div><span className="text-zinc-500">Timestamp:</span> <span className="text-zinc-400">{echoResponse.timestamp}</span></div>
                            <div><span className="text-zinc-500">HTTP Method:</span> <span className="text-violet-400 font-bold">{echoResponse.method}</span></div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Reflected Query</span>
                            <pre className="bg-zinc-950 border border-zinc-900 p-2.5 rounded-lg text-zinc-300 max-h-[140px] overflow-y-auto">
                              {JSON.stringify(echoResponse.query, null, 2)}
                            </pre>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Reflected Headers</span>
                            <pre className="bg-zinc-950 border border-zinc-900 p-2.5 rounded-lg text-zinc-300 max-h-[140px] overflow-y-auto">
                              {JSON.stringify(echoResponse.headers, null, 2)}
                            </pre>
                          </div>
                        </div>

                        {echoResponse.body !== undefined && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Reflected Body</span>
                            <pre className="bg-zinc-950 border border-zinc-900 p-3 rounded-lg text-zinc-200 overflow-x-auto whitespace-pre max-h-[160px]">
                              {typeof echoResponse.body === "object"
                                ? JSON.stringify(echoResponse.body, null, 2)
                                : echoResponse.body}
                            </pre>
                          </div>
                        )}
                      </div>
                    ) : echoError ? (
                      <div className="bg-rose-950/30 border border-rose-900/50 text-rose-400 p-4 rounded-xl space-y-1 text-xs font-mono">
                        <div className="font-bold">Error Dispatching Webhook</div>
                        <p>{echoError}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-28 text-zinc-600 space-y-2 font-mono text-xs">
                        <svg className="w-10 h-10 text-zinc-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                        </svg>
                        <span className="text-[11px] uppercase tracking-wide">Waiting for Dispatcher...</span>
                        <p className="text-[10px] text-zinc-700 text-center max-w-[240px] mt-1">Configure parameters on the left and click &quot;Fire Webhook Payload&quot;</p>
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono text-center border-t border-zinc-900/80 pt-3 mt-4">
                    MockFlow Stateless V2 • 100% Client-Edge Isolation
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Collection Builder */}
        {activeTab === "collection" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Sidebar: Collection Config & Endpoints */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Collection General Details */}
              <div className="glass-panel rounded-2xl p-6 space-y-4">
                <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider border-b border-zinc-900 pb-2 flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-fuchsia-500 rounded-full" />
                  Collection Meta
                </h2>
                
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Collection Name</label>
                    <input
                      type="text"
                      value={collectionName}
                      onChange={(e) => setCollectionName(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Description</label>
                    <textarea
                      value={collectionDescription}
                      onChange={(e) => setCollectionDescription(e.target.value)}
                      rows={2}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              </div>

              {/* Endpoints Sidebar */}
              <div className="glass-panel rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                  <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1.5 h-3 bg-violet-500 rounded-full" />
                    Endpoints ({collectionMocks.length})
                  </h2>
                  <button
                    onClick={addCollectionMock}
                    className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-0.5"
                  >
                    + Add Mock
                  </button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {collectionMocks.map((m, idx) => (
                    <div
                      key={m.id}
                      onClick={() => setActiveColMockIndex(idx)}
                      className={`group p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between cursor-pointer transition-all ${
                        activeColMockIndex === idx
                          ? "bg-violet-950/30 border-violet-900/50 text-violet-300"
                          : "bg-zinc-900/20 border-zinc-900 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate mr-2">
                        <span className={`w-12 text-center text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${
                          m.method === "GET" ? "bg-emerald-950/80 text-emerald-400" :
                          m.method === "POST" ? "bg-blue-950/80 text-blue-400" :
                          m.method === "PUT" ? "bg-amber-950/80 text-amber-400" :
                          m.method === "DELETE" ? "bg-rose-950/80 text-rose-400" :
                          "bg-zinc-800 text-zinc-400"
                        }`}>
                          {m.method}
                        </span>
                        <span className="font-mono truncate">{m.path || "/"}</span>
                      </div>
                      
                      <button
                        onClick={(e) => deleteCollectionMock(idx, e)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-rose-950/30 text-zinc-500 hover:text-rose-400 transition-all"
                        title="Delete mock"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Encryption for collections */}
              <div className="glass-panel rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    🔒 Collection Protection
                  </h2>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={colEncryptEnabled}
                      onChange={(e) => setColEncryptEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-zinc-805 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-violet-600 peer-checked:after:bg-white" />
                  </label>
                </div>

                {colEncryptEnabled && (
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={colPassword}
                    onChange={(e) => setColPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-violet-900/50 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-violet-500 font-mono"
                  />
                )}
              </div>
            </div>

            {/* Right Panel: Shared Docs URL & Active Endpoint Editor */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Box 1: Collection Documentation Link generator */}
              <div className="glass-panel rounded-2xl p-6 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none" />
                <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-fuchsia-500 rounded-full" />
                  Shared Documentation Link
                </h2>

                {colGenerating ? (
                  <div className="h-12 flex items-center justify-center bg-zinc-950/50 border border-zinc-900 rounded-xl">
                    <span className="text-xs text-zinc-500 flex items-center gap-2 animate-pulse">
                      <svg className="w-4 h-4 animate-spin text-fuchsia-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Compiling collection...
                    </span>
                  </div>
                ) : collectionToken ? (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <div className="flex-1 bg-zinc-950 border border-zinc-900 rounded-xl px-3 py-2.5 text-xs font-mono text-zinc-400 overflow-x-auto whitespace-nowrap scrollbar-none select-all flex items-center">
                        {`${origin}/docs?c=${collectionToken}`.substring(0, 80)}...
                      </div>
                      <button
                        onClick={() => {
                          const urlToCopy = `${origin}/docs?c=${collectionToken}` + (colEncryptEnabled && colPassword ? `&p=${encodeURIComponent(colPassword)}` : "");
                          copyToClipboard(urlToCopy);
                          setColCopySuccess(true);
                          setTimeout(() => setColCopySuccess(false), 2000);
                        }}
                        className={`px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                          colCopySuccess
                            ? "bg-emerald-950 border-emerald-800 text-emerald-400"
                            : "bg-fuchsia-600 hover:bg-fuchsia-500 border-fuchsia-600 text-white shadow-md shadow-fuchsia-950/10"
                        }`}
                      >
                        {colCopySuccess ? "Copied" : "Copy Docs Link"}
                      </button>
                    </div>

                    {/* Progress indicator */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                        <span>Payload Size Stats</span>
                        <span className={`${(`${origin}/docs?c=${collectionToken}`.length) > 2048 ? "text-rose-400 font-bold" : "text-zinc-400"}`}>
                          {`${origin}/docs?c=${collectionToken}`.length} / 2048 chars ({Math.round(Math.min(((`${origin}/docs?c=${collectionToken}`.length) / 2048) * 100, 100))}%)
                        </span>
                      </div>
                      <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            (`${origin}/docs?c=${collectionToken}`.length) > 2048 ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]" :
                            (`${origin}/docs?c=${collectionToken}`.length) > 1500 ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(((`${origin}/docs?c=${collectionToken}`.length) / 2048) * 100, 100)}%` }}
                        />
                      </div>
                      {(`${origin}/docs?c=${collectionToken}`.length) > 2048 && (
                        <p className="text-[9.5px] text-rose-400 leading-normal">
                          ⚠️ Warning: Collection payload is too large. Reduce the number of mock endpoints or sizes of mock JSON body payloads to stay under 2048 characters.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Box 2: Active Mock Details Editor */}
              {collectionMocks[activeColMockIndex] ? (
                <div className="glass-panel rounded-2xl p-6 space-y-6">
                  <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider border-b border-zinc-900 pb-3 flex items-center justify-between">
                    <span>Configure Endpoint: <span className="text-violet-400 font-bold font-mono">{collectionMocks[activeColMockIndex].name}</span></span>
                    <span className="text-[10px] text-zinc-500 font-mono">index #{activeColMockIndex}</span>
                  </h3>

                  {/* 1. Endpoint metadata Name & Path */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Endpoint Name</label>
                      <input
                        type="text"
                        value={collectionMocks[activeColMockIndex].name}
                        onChange={(e) => updateActiveColMock({ name: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                        placeholder="Get Users list"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Request Path</label>
                      <input
                        type="text"
                        value={collectionMocks[activeColMockIndex].path}
                        onChange={(e) => updateActiveColMock({ path: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500 font-mono"
                        placeholder="/users"
                      />
                    </div>
                  </div>

                  {/* 2. HTTP Method & Status code */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Method</label>
                      <select
                        value={collectionMocks[activeColMockIndex].method}
                        onChange={(e) => updateActiveColMock({ method: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 font-bold focus:outline-none focus:border-violet-500"
                      >
                        {["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Status Code</label>
                      <input
                        type="number"
                        value={collectionMocks[activeColMockIndex].status}
                        onChange={(e) => updateActiveColMock({ status: Number(e.target.value) })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-violet-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Status Presets</label>
                      <select
                        value={collectionMocks[activeColMockIndex].status}
                        onChange={(e) => updateActiveColMock({ status: Number(e.target.value) })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:border-violet-500"
                      >
                        {HTTP_STATUS_LIST.map((s) => (
                          <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 3. Headers manager */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Response Headers</label>
                      <button
                        onClick={addColMockHeader}
                        className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold"
                      >
                        + Add Header
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[150px] overflow-y-auto">
                      {!(collectionMocks[activeColMockIndex].headers) || collectionMocks[activeColMockIndex].headers.length === 0 ? (
                        <p className="text-[10px] text-zinc-600 text-center py-2">No custom headers. Defaults will be applied.</p>
                      ) : (
                        collectionMocks[activeColMockIndex].headers.map((h: any, i: number) => (
                          <div key={i} className="flex gap-2 items-center bg-zinc-950 p-2 rounded-xl border border-zinc-900">
                            <input
                              type="checkbox"
                              checked={h.enabled}
                              onChange={(e) => updateColMockHeader(i, { enabled: e.target.checked })}
                              className="w-3.5 h-3.5 accent-violet-600 cursor-pointer"
                            />
                            <input
                              type="text"
                              placeholder="Key"
                              value={h.key}
                              onChange={(e) => updateColMockHeader(i, { key: e.target.value })}
                              className="flex-1 bg-transparent border-none text-xs text-zinc-200 focus:outline-none font-mono"
                              list="header-suggestions"
                            />
                            <input
                              type="text"
                              placeholder="Value"
                              value={h.value}
                              onChange={(e) => updateColMockHeader(i, { value: e.target.value })}
                              className="flex-1 bg-transparent border-none text-xs text-zinc-200 focus:outline-none font-mono"
                            />
                            <button
                              onClick={() => removeColMockHeader(i)}
                              className="text-zinc-600 hover:text-rose-400 text-xs px-1"
                            >
                              &times;
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Request Parameters manager */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Request Parameters (Query Params)</label>
                      <button
                        onClick={addColMockQueryParam}
                        className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold"
                      >
                        + Add Param
                      </button>
                    </div>

                    <div className="space-y-2">
                      {!(collectionMocks[activeColMockIndex].queryParams) || collectionMocks[activeColMockIndex].queryParams.length === 0 ? (
                        <p className="text-[10px] text-zinc-600 text-center py-2">No request parameters documented for this mock.</p>
                      ) : (
                        collectionMocks[activeColMockIndex].queryParams.map((p: any, i: number) => (
                          <div key={i} className="flex flex-col bg-zinc-950 rounded-xl border border-zinc-900 overflow-hidden">
                            {/* Main Row */}
                            <div className="flex gap-2 items-center p-2.5 border-b border-zinc-900/30">
                              {/* Expand/Collapse Button */}
                              <button
                                onClick={() => setExpandedColParams(prev => ({ ...prev, [i]: !prev[i] }))}
                                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                                title="Advanced Rules"
                                type="button"
                              >
                                <svg className={`w-3 h-3 transform transition-transform ${expandedColParams[i] ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>

                              {/* Param Name */}
                              <input
                                type="text"
                                placeholder="Name (e.g. limit)"
                                value={p.name}
                                onChange={(e) => updateColMockQueryParam(i, { name: e.target.value })}
                                className="flex-1 bg-transparent border-none text-xs text-zinc-200 focus:outline-none font-mono"
                              />
                              
                              {/* Param Type */}
                              <select
                                value={p.type}
                                onChange={(e) => updateColMockQueryParam(i, { type: e.target.value })}
                                className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono focus:outline-none"
                              >
                                <option value="string">string</option>
                                <option value="number">number</option>
                                <option value="boolean">boolean</option>
                              </select>

                              {/* Required checkbox */}
                              <label className="flex items-center gap-1 cursor-pointer select-none text-[10px] text-zinc-500">
                                <input
                                  type="checkbox"
                                  checked={p.required}
                                  onChange={(e) => updateColMockQueryParam(i, { required: e.target.checked })}
                                  className="w-3 h-3 accent-violet-600 cursor-pointer"
                                />
                                Req
                              </label>

                              {/* Param Description */}
                              <input
                                type="text"
                                placeholder="Description"
                                value={p.description}
                                onChange={(e) => updateColMockQueryParam(i, { description: e.target.value })}
                                className="flex-1.5 bg-transparent border-none text-xs text-zinc-200 focus:outline-none font-mono"
                              />

                              {/* Remove button */}
                              <button
                                onClick={() => removeColMockQueryParam(i)}
                                className="p-1 rounded-md hover:bg-rose-950/20 text-zinc-500 hover:text-rose-400 transition-colors"
                                title="Remove Parameter"
                              >
                                &times;
                              </button>
                            </div>

                            {/* Expanded Advanced Rules Panel */}
                            {expandedColParams[i] && (
                              <div className="bg-zinc-900/30 p-3 border-t border-zinc-900/50 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                {/* Left Column: Regex & Enums */}
                                <div className="space-y-2">
                                  <div>
                                    <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Regex Pattern</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. ^[0-9]+$"
                                      value={p.regex || ""}
                                      onChange={(e) => updateColMockQueryParam(i, { regex: e.target.value })}
                                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-zinc-300 font-mono text-[10px] focus:outline-none focus:border-violet-500/50"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Allowed Values (Enum, comma-separated)</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. active, inactive"
                                      value={p.enums || ""}
                                      onChange={(e) => updateColMockQueryParam(i, { enums: e.target.value })}
                                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-zinc-300 font-mono text-[10px] focus:outline-none focus:border-violet-500/50"
                                    />
                                  </div>
                                </div>

                                {/* Right Column: Min, Max, Default */}
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                                        {p.type === "number" ? "Min Value" : "Min Length"}
                                      </label>
                                      <input
                                        type="number"
                                        placeholder="No limit"
                                        value={p.min !== undefined ? p.min : ""}
                                        onChange={(e) => updateColMockQueryParam(i, { min: e.target.value === "" ? undefined : Number(e.target.value) })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-zinc-300 font-mono text-[10px] focus:outline-none focus:border-violet-500/50"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                                        {p.type === "number" ? "Max Value" : "Max Length"}
                                      </label>
                                      <input
                                        type="number"
                                        placeholder="No limit"
                                        value={p.max !== undefined ? p.max : ""}
                                        onChange={(e) => updateColMockQueryParam(i, { max: e.target.value === "" ? undefined : Number(e.target.value) })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-zinc-300 font-mono text-[10px] focus:outline-none focus:border-violet-500/50"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Default / Example Value</label>
                                    <input
                                      type="text"
                                      placeholder="Pre-filled value in sandbox testing"
                                      value={p.defaultValue || ""}
                                      onChange={(e) => updateColMockQueryParam(i, { defaultValue: e.target.value })}
                                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-zinc-300 font-mono text-[10px] focus:outline-none focus:border-violet-500/50"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 4. Response body Payload */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Response Body</label>
                      <button
                        onClick={() => {
                          try {
                            const parsed = JSON.parse(collectionMocks[activeColMockIndex].body);
                            updateActiveColMock({ body: JSON.stringify(parsed, null, 2) });
                          } catch (e) {
                            alert("Invalid JSON format.");
                          }
                        }}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 font-semibold"
                      >
                        Format Body
                      </button>
                    </div>
                    <textarea
                      value={collectionMocks[activeColMockIndex].body}
                      onChange={(e) => updateActiveColMock({ body: e.target.value })}
                      rows={5}
                      className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs text-zinc-200 font-mono focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/25 leading-normal"
                      placeholder='{"message": "Hello!"}'
                    />
                  </div>

                  {/* 5. Latency slider */}
                  <div className="space-y-2 bg-zinc-950 p-4 border border-zinc-900 rounded-xl">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Simulate Latency</span>
                      <span className="text-[10px] font-mono text-violet-400 font-bold">
                        {collectionMocks[activeColMockIndex].delay || 0} ms
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5000"
                      step="100"
                      value={collectionMocks[activeColMockIndex].delay || 0}
                      onChange={(e) => updateActiveColMock({ delay: Number(e.target.value) })}
                      className="w-full accent-violet-500 h-1 bg-zinc-900 rounded-lg cursor-pointer appearance-none"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 text-center py-20 bg-zinc-900/20 border border-zinc-800 rounded-2xl">
                  Please add an endpoint to configure details.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
