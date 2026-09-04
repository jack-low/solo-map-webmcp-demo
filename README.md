# Solo Map Secure Agent Bus — WebMCP demo

Solo Map is a small, privacy-first WebMCP demo for policy-bound agent handoffs. It shows how a browser agent can ask for a structured envelope plan before sensitive data is ever eligible for transport.

The public demo deliberately uses synthetic identities and metadata. It does not accept a real secret, create real ciphertext, contact a relay, or contain private keys. The production A2A relay and agent runtimes are separate protected infrastructure.

## Run locally

Any static HTTP server works:

```bash
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/` in a WebMCP-capable browser. The page uses the browser-mediated `document.modelContext.registerTool()` API when available and keeps the same validation logic behind the human UI for preview browsers.

## WebMCP tools

- `inspect_security_boundary` explains the public trust boundary.
- `list_demo_agents` returns synthetic public agent identities.
- `create_policy_bound_envelope` validates recipient, purpose, expiry, read limit, and forwarding before returning a redacted preview.

## Privacy boundary

The relay-facing production design uses authenticated encryption and isolated agent runtimes. This public demo only communicates its policy model; it never includes a relay hostname, API token, enrollment token, private key, personal email, or real message.

## Hackathon note

This is an open-source WebMCP submission demo for The WebMCP Challenge. The page is intentionally small so a judge can open it, discover the tools, and see the result of a structured call immediately.
