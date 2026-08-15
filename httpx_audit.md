# HTTPX Subsystem Audit

## Overview
HTTPX is a fully featured HTTP client for Python 3, providing both synchronous and asynchronous APIs, along with support for HTTP/1.1 and HTTP/2. It serves as a next-generation library compared to standard requests.

## Subsystems

1. **Client & API Interface (`httpx/_client.py`, `httpx/_api.py`)**
   - **Role:** The primary public API facade. It exposes `Client`, `AsyncClient`, and convenient top-level functions (`get`, `post`, `request`).
   - **Key Entities:** `Client`, `AsyncClient`, `request` building, request lifecycle orchestration.

2. **Transport Layer (`httpx/_transports/`)**
   - **Role:** The pluggable network execution backend that interacts with core networking libraries (like `httpcore`) or application gateways.
   - **Key Entities:** `HTTPTransport`, `AsyncHTTPTransport`, `ASGITransport`, `WSGITransport`.

3. **Data Models (`httpx/_models.py`, `httpx/_urls.py`)**
   - **Role:** Rich, strongly typed data structures representing HTTP primitives.
   - **Key Entities:** `Request`, `Response`, `URL`, `Headers`, `Cookies`, `QueryParams`.

4. **Authentication (`httpx/_auth.py`)**
   - **Role:** Middleware for appending authentication credentials seamlessly to outgoing requests.
   - **Key Entities:** `BasicAuth`, `DigestAuth`, and the abstract `Auth` base class.

5. **Decoders & Encoders (`httpx/_decoders.py`, `httpx/_content.py`)**
   - **Role:** Handling content conversion. Encoders prepare the request body (JSON, multipart), while decoders transparently decompress the response body (gzip, deflate, brotli).
   - **Key Entities:** `GZipDecoder`, `DeflateDecoder`, `BrotliDecoder`, multipart encoders.

6. **Configuration & Utilities (`httpx/_config.py`, `httpx/_types.py`)**
   - **Role:** Manages networking configurations such as timeouts, connection pooling limits, SSL contexts, and common type definitions.
   - **Key Entities:** `Timeout`, `Limits`, `Proxy`, `SSLConfig`.

7. **Exceptions (`httpx/_exceptions.py`)**
   - **Role:** A comprehensive, unified exception hierarchy for handling network and HTTP errors.
   - **Key Entities:** `RequestError`, `HTTPStatusError`, `TimeoutException`, `ConnectError`.
