# 掘金每日签到 / 抽奖 / Telegram 通知

这个仓库提供了一个可直接运行在 GitHub Actions 上的掘金每日自动任务，包含：

- 每日签到
- 免费抽奖
- 执行结果通知到 Telegram

当前实现基于浏览器自动化，而不是直接调用掘金接口。原因是掘金接口现在会校验运行时生成的风控参数，直接在 Node 里发请求容易拿到空响应或被拦截；浏览器态实测可正常完成签到和抽奖。

## 仓库协作

- 日常开发、分支命名和本地验证命令见 `CONTRIBUTING.md`
- 建议通过 GitHub Pull Request 合入改动，并在 PR 中附上验证结果
- 默认分支是 `main`，日常改动建议从 `main` 拉出功能分支后再通过 PR 合并
- 非紧急情况不建议把功能分支内容直接同步覆盖到 `main`

## 仓库内容

- `scripts/juejin-checkin.mjs`
  - 使用 Playwright 打开掘金页面，完成签到、免费抽奖，并发送 Telegram 通知。
- `.github/workflows/juejin-checkin.yml`
  - 每天定时执行任务，同时支持手动触发。

## 环境变量

实际运行时只需要下面这些变量：

- 必填：`JUEJIN_COOKIE`
- Telegram 可选：`TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`
- 仅在 Telegram 群组话题里发消息时可选：`TELEGRAM_MESSAGE_THREAD_ID`
- 调试或兼容性用途可选：`JUEJIN_USER_AGENT`、`JUEJIN_HEADLESS`

说明：

- 如果不需要 Telegram 通知，可以完全不传任何 `TELEGRAM_*` 变量。
- 如果要启用 Telegram 通知，`TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_CHAT_ID` 必须成对提供。
- 可选变量不需要在 `.env.local` 里预留空行或空值，不写就行。

## GitHub 使用方式

1. 在 GitHub 仓库中进入 `Settings -> Secrets and variables -> Actions`。
2. 新建仓库 Secret：`JUEJIN_COOKIE`
3. 将浏览器里登录掘金后的完整 Cookie 复制进去保存。
4. 如果要启用 Telegram 通知，再新增两个 Secret：
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
5. 如果你的 Telegram 群组启用了话题，可在 `Variables` 里新增 `TELEGRAM_MESSAGE_THREAD_ID`
6. 如果你确实需要自定义浏览器标识，可在 `Variables` 里新增 `JUEJIN_USER_AGENT`
7. 进入 `Actions -> Juejin Daily Automation`，先手动执行一次确认配置正确。

## 可选配置

- `JUEJIN_USER_AGENT`
  - 只有你明确需要覆盖默认浏览器标识时再设置。
- `TELEGRAM_MESSAGE_THREAD_ID`
  - 只有你要把消息发到 Telegram 群组 topic 时再设置。
- `JUEJIN_HEADLESS`
  - 仅在你明确需要无头模式时设置为 `true`。默认不建议开启，因为掘金更容易识别并拦截无头浏览器。

## Telegram 配置

### 1. 创建机器人

在 Telegram 里找到 `@BotFather`，创建一个 bot，拿到 `TELEGRAM_BOT_TOKEN`。

### 2. 获取 `chat_id`

- 发给机器人私聊消息后，通过 `getUpdates` 获取私聊 `chat_id`
- 或者把机器人拉进群组，发送一条消息后再通过 `getUpdates` 查看群组 `chat_id`

你可以在浏览器里访问下面这个地址查看更新结果：

```text
https://api.telegram.org/bot<你的BOT_TOKEN>/getUpdates
```

如果你使用群组 topic，还可以从返回结果里拿到 `message_thread_id`，再填到 `TELEGRAM_MESSAGE_THREAD_ID`。

## 默认调度时间

工作流默认使用下面的 cron：

```yaml
14 1 * * *
```

GitHub Actions 的 cron 使用 UTC 时区，这个表达式对应北京时间每天 `09:14`。

如果你想修改执行时间，只需要改 `.github/workflows/juejin-checkin.yml` 里的 `schedule`。

## 本地运行

你可以复制 `.env.example` 为 `.env.local`，脚本会自动读取它：

```bash
cp .env.example .env.local
```

最小可用的 `.env.local` 只需要：

```env
JUEJIN_COOKIE=你的完整Cookie
```

如果你也要本地测试 Telegram 通知，再额外补上：

```env
JUEJIN_COOKIE=你的完整Cookie
TELEGRAM_BOT_TOKEN=你的BOT_TOKEN
TELEGRAM_CHAT_ID=你的CHAT_ID
```

只有在这些场景下才需要继续加变量：

```env
# 发到 Telegram 群组 topic
TELEGRAM_MESSAGE_THREAD_ID=

# 覆盖默认浏览器标识
JUEJIN_USER_AGENT=

# 默认就是 false，不写也可以
JUEJIN_HEADLESS=false
```

然后执行：

```bash
npm run checkin
```

如果你在 Linux 服务器或没有桌面环境的环境里本地跑，推荐用：

```bash
xvfb-run -a npm run checkin
```

如果你不想用 `.env.local`，也可以直接通过命令行传最小变量：

```bash
JUEJIN_COOKIE='你的完整Cookie' \
npm run checkin
```

如果要临时测试 Telegram 通知，再追加：

```bash
JUEJIN_COOKIE='你的完整Cookie' \
TELEGRAM_BOT_TOKEN='你的BOT_TOKEN' \
TELEGRAM_CHAT_ID='你的CHAT_ID' \
npm run checkin
```

第一次运行前需要先安装依赖和浏览器：

```bash
npm install
npx playwright install chromium
```

## 注意事项

- Cookie 失效后，GitHub Action 会执行失败，此时更新 `JUEJIN_COOKIE` 即可。
- 签到接口依赖你的掘金登录态，建议直接复制浏览器请求里的完整 Cookie，避免缺字段。
- 免费抽奖只有在当天还有免费次数时才会执行，不会消耗矿石做付费抽奖。
- `.env.local` 可以只保留你实际需要的字段，不需要把所有可选变量都写进去。
- Telegram 通知未配置时，脚本会跳过通知，不影响签到和抽奖主流程。
- GitHub Actions 里任务会在 `xvfb-run` 下以有头浏览器模式运行，这是为了降低掘金风控拦截概率。
