# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest on `main` | Yes |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do not** open a public GitHub Issue.
2. Send an email or private message to the repository owner describing the vulnerability.
3. Include steps to reproduce the issue if possible.

You should receive a response within 72 hours.

## Security Considerations

This project handles sensitive credentials:

- **`JUEJIN_COOKIE`** — Juejin session cookie
- **`TELEGRAM_BOT_TOKEN`** — Telegram Bot API token

Please ensure:

- Never commit credentials to the repository.
- Use GitHub Secrets for CI/CD, and `.env.local` (gitignored) for local development.
- Rotate credentials immediately if you suspect they have been exposed.
