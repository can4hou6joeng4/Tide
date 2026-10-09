# AGENTS.md

Tide：每天用 GitHub Actions + Playwright 完成掘金签到和免费抽奖，并把结果推送到 Telegram（可选）。Node.js ≥ 20，ESM。

## 目录

- `scripts/juejin-checkin.mjs` — 唯一的主脚本（签到、抽奖、通知、失败兜底）
- `test/juejin-checkin.test.mjs` — `node:test` 测试
- `.github/workflows/juejin-checkin.yml` — 每天 09:14（北京时间）定时运行，并重置 60 天不活跃停用计时器
- `.env.example` — 环境变量说明

## 常用命令

```bash
npm ci
npx playwright install chromium
node --check scripts/juejin-checkin.mjs
npm test                      # node --test，离线
npm run checkin               # 真实签到，需要 .env.local 中的真实 cookie，仅在用户明确要求时运行
```

## 约定

- 2 空格缩进、LF、文件末尾换行（见 `.editorconfig`）。
- 抽奖失败不能影响签到结果；主流程失败时仍要发兜底通知并保留截图/HTML artifacts。
- 行为、环境变量或工作流变化时同步更新 README。

## 不要做

- 不要提交真实 cookie、Telegram bot token 或 `.env.local`。
- 测试里不要访问掘金或 Telegram 的真实接口。
- 不要在本地或 CI 里多次触发真实签到/抽奖，也不要改动会消耗矿石的逻辑（只用免费次数）。
- 不要删掉工作流中的保活步骤，否则定时任务 60 天后会被 GitHub 停用。
