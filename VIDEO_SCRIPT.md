# Demo video script

Target length: about 60 seconds. The video is intentionally public-safe: it shows only synthetic demo identities and policy metadata.

Sensitive agent handoffs fail when a relay, a prompt, or an accidental forwarder can see more than it should.

PolicyBound Agent Bus puts policy before payload. This is the public WebMCP demo.

In a WebMCP-capable browser, the page registers three structured tools: inspect security boundary, list demo agents, and create policy-bound envelope.

Now an agent asks for a handoff to the Legal Agent for contract review. The tool call supplies a recipient, purpose, expiry, read limit, and forwarding rule. The browser validates the combination and returns a machine-readable preview.

Notice the boundary: this demo uses synthetic identities only. It makes no network request, creates no real ciphertext, and accepts no secret or private key.

The production design keeps decryption inside an authorized agent runtime. The relay can route encrypted data and delivery metadata, while the model never receives the private key.

The human form and the agent tool share the same validation path. WebMCP makes a sensitive workflow explicit, discoverable, and easier for both people and agents to use safely.
