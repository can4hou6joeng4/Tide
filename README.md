<h1 align="center">Tide</h1>

<p align="center"><em>如潮汐般守时 —— 掘金每日签到 · 免费抽奖 · Telegram 播报</em></p>

<p align="center">
  <a href="https://github.com/can4hou6joeng4/Tide/actions/workflows/juejin-checkin.yml"><img src="https://img.shields.io/github/actions/workflow/status/can4hou6joeng4/Tide/juejin-checkin.yml?style=flat-square&label=daily%20run" alt="daily run"></a>
  <img src="https://img.shields.io/github/stars/can4hou6joeng4/Tide?style=flat-square" alt="stars">
  <img src="https://img.shields.io/github/license/can4hou6joeng4/Tide?style=flat-square" alt="license">
  <img src="https://img.shields.io/github/commit-activity/m/can4hou6joeng4/Tide?style=flat-square" alt="commit activity">
  <img src="https://img.shields.io/badge/node-%E2%89%A520-339933?style=flat-square&logo=node.js&logoColor=white" alt="node">
  <img src="https://img.shields.io/badge/playwright-chromium-45ba4b?style=flat-square" alt="playwright">
</p>

## 为什么叫 Tide

潮汐每天准时涨落,从不缺席。Tide 也一样:每天 09:14 准时出海,替你完成掘金签到与免费抽奖,把收成播报到 Telegram;失败了会自己留下线索、发出警报,并保证第二天照常涨潮。

Tide 是航海家族的一员:[Harbor](https://github.com/can4hou6joeng4/Harbor) 让知识停泊,[Beacon](https://github.com/can4hou6joeng4/Beacon) 在过期前预警,[Atlas](https://github.com/can4hou6joeng4/Atlas) 丈量每段航程,而 Tide 守护每日的节律。

## 功能特性

- ⚓ **每日签到** — 自动完成掘金每日签到,已签过会识别并跳过
- 🎰 **免费抽奖** — 仅在当天有免费次数时抽,不消耗矿石;抽奖失败不影响签到结果
- 📣 **Telegram 播报** — 矿石、连签天数、奖品一目了然;完全可选,支持群组话题
- 🛟 **失败兜底** — 主流程失败时仍会发出兜底通知,并把页面截图/HTML 上传到 Actions artifacts 供排查
- 🔁 **永不搁浅** — 每次运行自动重置 GitHub「60 天不活跃即停用定时任务」的计时器,无需人工保活

## 工作原理

```text
cron 09:14 (UTC+8) ─▶ GitHub Actions ─▶ Playwright 无头 Chromium(带反自动化检测缓解)
                                           ├─ 签到页:读取今日状态 → 点击签到 → 校验接口响应
                                           └─ 抽奖页:有免费次数才抽
                                                │
                          运行摘要 juejin-run-summary.json
                                                │
                      ├─ 成功 ─▶ Telegram 播报(未配置则跳过)
                      ├─ 失败 ─▶ notify:fallback 兜底通知 + debug 快照 artifact
                      └─ 收尾 ─▶ keepalive 重置 60 天停用计时器
```

当前实现基于浏览器自动化而不是直接调用掘金接口:掘金接口会校验运行时生成的风控参数,直接在 Node 里发请求容易拿到空响应或被拦截;浏览器态实测可正常完成签到和抽奖。

## 快速开始(GitHub Actions 部署)

1. Fork 本仓库。
2. 进入 `Settings -> Secrets and variables -> Actions`。
3. 新建仓库 Secret:`JUEJIN_COOKIE`,粘贴浏览器登录掘金后的完整 Cookie。
4. 如需 Telegram 通知,再新增两个 Secret:`TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`。
5. 群组话题场景可在 `Variables` 里新增 `TELEGRAM_MESSAGE_THREAD_ID`;需要自定义浏览器标识时再新增 `JUEJIN_USER_AGENT`。
6. 进入 `Actions -> Juejin Daily Automation`,手动执行一次确认配置正确。

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `JUEJIN_COOKIE` | ✅ | 掘金登录态的完整 Cookie |
| `TELEGRAM_BOT_TOKEN` | 可选 | 启用通知时与 `TELEGRAM_CHAT_ID` 成对提供 |
| `TELEGRAM_CHAT_ID` | 可选 | 同上 |
| `TELEGRAM_MESSAGE_THREAD_ID` | 可选 | 仅发到 Telegram 群组话题时需要 |
| `JUEJIN_USER_AGENT` | 可选 | 覆盖默认浏览器标识 |
| `JUEJIN_HEADLESS` | 可选 | 本地默认 `false`(有头便于观察);GitHub Actions 上以 `true` 无头运行 |

不需要 Telegram 通知时,所有 `TELEGRAM_*` 变量都可以不传,脚本会跳过通知环节,不影响签到和抽奖主流程。

## Telegram 配置

1. **创建机器人**:在 Telegram 里找 `@BotFather` 创建 bot,拿到 `TELEGRAM_BOT_TOKEN`。
2. **获取 `chat_id`**:给机器人发一条私聊消息(或把它拉进群组后发言),然后在浏览器访问:

```text
https://api.telegram.org/bot<你的BOT_TOKEN>/getUpdates
```

私聊、群组的 `chat_id` 都能在返回结果里找到;如果使用群组话题,同一结果里还能拿到 `message_thread_id`,填入 `TELEGRAM_MESSAGE_THREAD_ID`。

## 调度时间与 keepalive

工作流默认 cron 为 `14 1 * * *`(UTC),即北京时间每天 `09:14`;修改 `.github/workflows/juejin-checkin.yml` 里的 `schedule` 即可调整。

GitHub 会自动停用超过 60 天没有提交的仓库中的定时任务。Tide 在每次运行结束时(无论成败)调用 workflow enable API 重置这个计时器,因此长期没有新提交也不会停摆。

## 本地运行

第一次运行前安装依赖和浏览器:

```bash
npm install
npx playwright install chromium
```

复制 `.env.example` 为 `.env.local` 并填入 Cookie(脚本会自动读取):

```bash
cp .env.example .env.local
```

最小可用配置只需要一行:

```env
JUEJIN_COOKIE=你的完整Cookie
```

然后执行:

```bash
npm run checkin
```

本地默认以有头模式运行,便于观察流程;在没有桌面环境的 Linux 上可以用 `xvfb-run -a npm run checkin`,或设置 `JUEJIN_HEADLESS=true` 直接无头运行。也可以不用 `.env.local`,直接通过命令行传变量:

```bash
JUEJIN_COOKIE='你的完整Cookie' npm run checkin
```

## 技术栈

- **Node.js 20+** — 脚本运行时,单元测试用原生 `node:test`
- **Playwright** — Chromium 浏览器自动化与接口响应校验
- **GitHub Actions** — 定时调度、PR CI 校验、失败快照 artifacts
- **Telegram Bot API** — 执行结果播报

## 注意事项

- Cookie 失效后 GitHub Action 会执行失败并发出兜底通知,更新 `JUEJIN_COOKIE` Secret 即可恢复。
- 建议直接复制浏览器请求里的完整 Cookie,避免缺字段导致登录态不完整。
- 免费抽奖只有在当天还有免费次数时才会执行,不会消耗矿石做付费抽奖。
- GitHub Actions 上以无头模式运行,并启用了降低风控识别概率的浏览器参数;如果仍被拦截,可从失败运行的 debug artifacts(截图/HTML)排查。
- 运行摘要会写入 `juejin-run-summary.json`(已在 `.gitignore` 中),兜底通知靠它判断是否需要补发。

## 参与开发

代码集中在 `scripts/juejin-checkin.mjs`,单元测试在 `test/`;PR 会触发 CI(YAML 校验 + 语法检查 + 单元测试)。分支命名、提交规范和本地验证流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

[MIT](LICENSE)
