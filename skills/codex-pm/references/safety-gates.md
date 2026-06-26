# Safety Gates

Codex PM must stop or request approval for:

- authentication or authorization changes,
- payments, billing, subscriptions,
- secrets, tokens, credentials,
- destructive database migrations,
- production deployments,
- CI/CD secret changes,
- mass file deletion,
- privacy-sensitive data logic,
- any attempt to bypass sandbox or verification.

Automatic evolution may adjust strategy parameters only within approved ranges. It must not disable these gates.
