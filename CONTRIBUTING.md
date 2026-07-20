# Contributing

## Development Setup

1. Use Node.js 20 or newer.
2. Install dependencies:

```bash
npm ci
```

3. Install the Playwright browser:

```bash
npx playwright install chromium
```

4. Create a local env file based on `.env.example` and fill in your own credentials:

```bash
cp .env.example .env.local
```

## Local Validation

Run the main task locally:

```bash
npm run checkin
```

If your environment does not provide a desktop session, use:

```bash
xvfb-run -a npm run checkin
```

Recommended checks before opening a pull request:

```bash
node --check scripts/juejin-checkin.mjs
npm test
npm run checkin
```

## Git Workflow

1. Branch from `main` using a descriptive name such as `fix/lottery-best-effort`.
2. Keep secrets only in local env files or GitHub Secrets. Do not commit real cookies or bot tokens.
3. Update documentation whenever behavior, environment variables, or workflows change.
4. Include validation results in your pull request description.

## Pull Request Workflow

1. Start new work from the latest `main`.
2. Push your feature branch to `origin`.
3. Open a Pull Request into `main` instead of syncing feature-branch changes directly onto `main`.
4. Put the change summary and validation commands in the PR description.
5. After the PR is merged, sync local `main` and delete the merged feature branch if it is no longer needed.

## Commit Message Style

- Use the format `type: 中文信息`
- Do not add issue numbers, scopes, AI tags, or other identifiers
- Prefer concise types such as `feat`, `fix`, `docs`, `chore`, `refactor`, `ci`

Examples:

```text
feat: 增加 Telegram 通知排版优化
fix: 修复掘金抽奖流程等待逻辑
ci: 新增 GitHub Actions 定时任务
```

## GitHub Actions Notes

- Pull requests run a lightweight CI workflow that installs dependencies, validates workflow YAML, checks script syntax, and runs unit tests.
- The workflow runs on `ubuntu-latest`.
- Playwright Chromium is installed at runtime.
- The daily task runs headless (`JUEJIN_HEADLESS=true`) with anti-automation mitigations; on failure it uploads debug snapshots (screenshot and HTML) as artifacts.
- Every run resets GitHub's 60-day inactivity timer for scheduled workflows via the workflow enable API.
