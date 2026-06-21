# MockFlow Stateless (V2)

MockFlow Stateless is a 100% database-free, zero-latency serverless utility for instant API mocking and Webhook reflections. Built on **Next.js (App Router)** and optimized for **Vercel Serverless Edge Functions**, it compresses entire mock configurations directly into the client-side URL.

---

## 🚀 Getting Started

### 1. Run the Application Locally

Install dependencies and start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the **MockFlow Dashboard**.

### 2. Deployment

This project is fully compatible with Vercel:

```bash
vercel
```

---

## 🧪 Test API Endpoints

We have set up pre-configured endpoints to test different request flows immediately. Replace `{base_url}` with your active host (e.g., `http://localhost:3000` or your production domain):

### 1. GET Test Endpoint
* **URL**: `{base_url}/api/test-get`
* **Method**: `GET`
* **CORS**: Enabled (`*`)
* **Response**: Returns a sample profile dataset (`200 OK`).
* **Example command**:
  ```bash
  curl -X GET http://localhost:3000/api/test-get
  ```

### 2. POST Test Endpoint
* **URL**: `{base_url}/api/test-post`
* **Method**: `POST`
* **CORS**: Enabled (`*`)
* **Response**: Echoes back your JSON payload with a `201 Created` status code.
* **Example command**:
  ```bash
  curl -X POST http://localhost:3000/api/test-post \
    -H "Content-Type: application/json" \
    -d '{"test": "hello mockflow"}'
  ```

### 3. Edit (PUT/PATCH/DELETE) Test Endpoint
* **URL**: `{base_url}/api/test-edit`
* **Method**: `PUT` | `PATCH` | `DELETE`
* **CORS**: Enabled (`*`)
* **Response**: Reflects the updated payload and HTTP method used (`200 OK`).
* **Example command**:
  ```bash
  curl -X PATCH http://localhost:3000/api/test-edit \
    -H "Content-Type: application/json" \
    -d '{"update": "changed field"}'
  ```

---

## 🛠️ Main Feature Endpoints

### 1. Stateless Mock Resolver
* **Endpoint**: `/api/mock`
* **Params**: `?d=[COMPRESSED_TOKEN]&p=[DECRYPTION_PASSWORD]&delay=[LATENCY_MS]`
* **Description**: Decompresses (and decrypts if necessary) your configuration dynamically in Edge RAM to throw the exact response configured in the dashboard.

### 2. Webhook Echo Reflector
* **Endpoint**: `/api/echo`
* **Description**: Catch and echo any incoming HTTP method, headers, query string parameters, and payload body back to the caller immediately.
