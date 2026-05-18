import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const TELEGRAM_BASE_URL = "https://api.telegram.org";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const LOCAL_ENV_PATH = path.join(PROJECT_ROOT, ".env.local");
const DEBUG_DIR = path.join(PROJECT_ROOT, "debug");

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalizedLine = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separatorIndex = normalizedLine.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();

    if (!key || process.env[key]) {
      continue;
    }

    const value = normalizedLine.slice(separatorIndex + 1).trim();
    process.env[key] = stripQuotes(value);
  }
}

loadEnvFile(LOCAL_ENV_PATH);

function getEnv(name) {
  return process.env[name]?.trim() || "";
}

function getRequiredEnv(name) {
  const value = getEnv(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getSummaryPath() {
  return getEnv("JUEJIN_SUMMARY_PATH") || path.join(PROJECT_ROOT, "juejin-run-summary.json");
}

function getNotificationMarkerPath() {
  return getEnv("JUEJIN_NOTIFICATION_SENT_PATH") || path.join(PROJECT_ROOT, ".telegram-notification-sent");
}

async function recordSummary(summary) {
  const payload = {
    updatedAt: new Date().toISOString(),
    summary
  };

  writeFileSync(getSummaryPath(), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function markNotificationSent() {
  writeFileSync(getNotificationMarkerPath(), `${new Date().toISOString()}\n`, "utf8");
}

function hasNotificationSent() {
  return existsSync(getNotificationMarkerPath());
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function parseBooleanEnv(name, defaultValue = false) {
  const value = getEnv(name).toLowerCase();

  if (!value) {
    return defaultValue;
  }

  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }

  return defaultValue;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function truncateText(value, maxLength = 600) {
  const text = String(value ?? "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

function parseCookieString(cookieString) {
  return cookieString
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separatorIndex = item.indexOf("=");

      if (separatorIndex <= 0) {
        return null;
      }

      return {
        name: item.slice(0, separatorIndex),
        value: item.slice(separatorIndex + 1),
        domain: ".juejin.cn",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax"
      };
    })
    .filter(Boolean);
}

async function parseJsonResponse(response, label) {
  const text = await response.text();

  if (!text) {
    throw new Error(`${label} returned an empty response body`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned invalid JSON: ${text.slice(0, 200)}`);
  }
}

function ensureJuejinSuccess(payload, label) {
  if (payload?.err_no === 0) {
    return payload.data;
  }

  throw new Error(`${label} failed: ${payload?.err_msg || "Unknown Juejin API error"}`);
}

function formatCheckInSummary(data, counts, points) {
  if (!data || typeof data !== "object") {
    return "签到成功";
  }

  const parts = [];
  const incrPoint = toNumber(data.incr_point);
  const sumPoint = toNumber(points);
  const contCount = toNumber(counts?.cont_count);

  if (incrPoint !== null) {
    parts.push(`本次 +${incrPoint} 矿石`);
  }

  if (sumPoint !== null) {
    parts.push(`总矿石 ${sumPoint}`);
  }

  if (contCount !== null) {
    parts.push(`连续签到 ${contCount} 天`);
  }

  return parts.length > 0 ? `签到成功：${parts.join("，")}` : "签到成功";
}

function formatLotterySummary(data, freeCountAfter) {
  if (!data || typeof data !== "object") {
    return "免费抽奖成功";
  }

  const parts = [];
  const lotteryName = data.lottery_name || data.lottery_type_name || "";
  const drawLuckyValue = toNumber(data.draw_lucky_value);
  const totalLuckyValue = toNumber(data.total_lucky_value);

  if (lotteryName) {
    parts.push(`奖品 ${lotteryName}`);
  }

  if (drawLuckyValue !== null) {
    parts.push(`幸运值 +${drawLuckyValue}`);
  }

  if (totalLuckyValue !== null) {
    parts.push(`总幸运值 ${totalLuckyValue}`);
  }

  if (typeof freeCountAfter === "number") {
    parts.push(`剩余免费次数 ${freeCountAfter}`);
  }

  return parts.length > 0 ? `免费抽奖成功：${parts.join("，")}` : "免费抽奖成功";
}

function buildDefaultSummary() {
  return {
    status: "success",
    checkIn: null,
    lottery: null,
    points: null,
    errorMessage: ""
  };
}

function capturePromise(promise) {
  return promise.then(
    (value) => ({ status: "fulfilled", value }),
    (reason) => ({ status: "rejected", reason })
  );
}

function unwrapCaptured(result) {
  if (result.status === "fulfilled") {
    return result.value;
  }

  throw result.reason;
}

async function waitForJuejinResponse(page, { pathname, method = "GET", timeout = 45000 }) {
  const response = await page.waitForResponse(
    (candidate) => {
      try {
        const url = new URL(candidate.url());
        return (
          url.hostname === "api.juejin.cn" &&
          url.pathname === pathname &&
          candidate.request().method() === method
        );
      } catch {
        return false;
      }
    },
    { timeout }
  );

  const payload = await parseJsonResponse(response, pathname);
  return ensureJuejinSuccess(payload, pathname);
}

async function ensurePageHealthy(page, expectedTitle) {
  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body?.innerText || "");

  if (!title.trim() && !bodyText.trim()) {
    throw new Error(`Juejin page rendered empty: ${page.url()}`);
  }

  if (expectedTitle && !title.includes(expectedTitle)) {
    throw new Error(`Unexpected Juejin page title: ${title}`);
  }

  if (/访问异常，请稍后再试|前往申诉|与稀土掘金运营同学联系/i.test(bodyText)) {
    throw new Error(`Juejin blocked the browser session: ${bodyText.slice(0, 120)}`);
  }
}

async function captureDiagnostics(page, label) {
  if (!page) {
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.join(DEBUG_DIR, `${label}-${stamp}`);
  await mkdir(DEBUG_DIR, { recursive: true }).catch(() => {});

  let url = "";
  try {
    url = page.url();
  } catch {}
  await writeFile(`${base}.url.txt`, url || "(unavailable)").catch(() => {});

  if (typeof page.isClosed === "function" && page.isClosed()) {
    return;
  }

  await page
    .screenshot({ path: `${base}.png`, fullPage: true })
    .catch(() => {});
  await page
    .content()
    .then((html) => writeFile(`${base}.html`, html))
    .catch(() => {});
}

async function createBrowserContext() {
  const cookie = getRequiredEnv("JUEJIN_COOKIE");
  const headless = parseBooleanEnv("JUEJIN_HEADLESS", false);
  const browser = await chromium.launch({
    headless,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-sandbox"
    ]
  });

  const context = await browser.newContext({
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    userAgent: getEnv("JUEJIN_USER_AGENT") || DEFAULT_USER_AGENT,
    viewport: { width: 1440, height: 960 }
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined
    });
    Object.defineProperty(navigator, "languages", {
      get: () => ["zh-CN", "zh", "en-US", "en"]
    });
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5]
    });

    window.chrome = window.chrome || { runtime: {} };
  });

  await context.setExtraHTTPHeaders({
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
  });

  await context.addCookies(parseCookieString(cookie));

  return { browser, context };
}

async function runCheckIn(context, summary) {
  const page = await context.newPage();

  try {
    const todayStatusPromise = capturePromise(
      waitForJuejinResponse(page, {
        pathname: "/growth_api/v2/get_today_status"
      })
    );
    const countsPromise = waitForJuejinResponse(page, {
      pathname: "/growth_api/v1/get_counts"
    }).catch(() => null);
    const pointPromise = waitForJuejinResponse(page, {
      pathname: "/growth_api/v1/get_cur_point"
    }).catch(() => null);

    await page.goto("https://juejin.cn/user/center/signin", {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await ensurePageHealthy(page, "每日签到");

    const button = page.getByRole("button", { name: /立即签到|今日已签到/ }).first();
    await button.waitFor({ state: "visible", timeout: 30000 });

    const todayStatus = unwrapCaptured(await todayStatusPromise);
    const initialCounts = await countsPromise;
    const initialPoint = await pointPromise;

    if (toNumber(initialPoint) !== null) {
      summary.points = toNumber(initialPoint);
    }

    const buttonText = ((await button.textContent()) || "").trim();
    if (todayStatus === true || buttonText.includes("今日已签到")) {
      summary.checkIn = {
        status: "already_checked_in",
        message: "今天已经签到过了",
        counts: initialCounts
      };
      console.log(summary.checkIn.message);
      return;
    }

    const checkInResponsePromise = capturePromise(
      waitForJuejinResponse(page, {
        pathname: "/growth_api/v1/check_in",
        method: "POST"
      })
    );
    const countsAfterPromise = waitForJuejinResponse(page, {
      pathname: "/growth_api/v1/get_counts"
    }).catch(() => initialCounts);
    const pointAfterPromise = waitForJuejinResponse(page, {
      pathname: "/growth_api/v1/get_cur_point"
    }).catch(() => initialPoint);

    await button.click();

    const [checkInResult, countsAfter, pointAfter] = await Promise.all([
      checkInResponsePromise,
      countsAfterPromise,
      pointAfterPromise
    ]);
    const checkInData = unwrapCaptured(checkInResult);

    const nextPoint = toNumber(pointAfter);
    if (nextPoint !== null) {
      summary.points = nextPoint;
    }

    summary.checkIn = {
      status: "success",
      message: formatCheckInSummary(checkInData, countsAfter, summary.points),
      data: checkInData,
      counts: countsAfter
    };
    console.log(summary.checkIn.message);
  } catch (error) {
    await captureDiagnostics(page, "checkin");
    throw error;
  } finally {
    await page.close().catch(() => {});
  }
}

async function runLottery(context, summary) {
  const page = await context.newPage();

  try {
    const configPromise = capturePromise(
      waitForJuejinResponse(page, {
        pathname: "/growth_api/v1/lottery_config/get"
      })
    );

    await page.goto("https://juejin.cn/user/center/lottery", {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await ensurePageHealthy(page, "幸运抽奖");

    const config = unwrapCaptured(await configPromise);
    const freeCount = toNumber(config?.free_count) ?? 0;
    const pointCost = toNumber(config?.point_cost);

    if (freeCount <= 0) {
      summary.lottery = {
        status: "skipped",
        message: pointCost
          ? `当前没有免费抽奖次数，单次抽奖需 ${pointCost} 矿石`
          : "当前没有免费抽奖次数"
      };
      console.log(summary.lottery.message);
      return;
    }

    const drawResponsePromise = capturePromise(
      waitForJuejinResponse(page, {
        pathname: "/growth_api/v1/lottery/draw",
        method: "POST"
      })
    );
    const configAfterPromise = waitForJuejinResponse(page, {
      pathname: "/growth_api/v1/lottery_config/get"
    }).catch(() => config);

    await page.evaluate(() => {
      const target = document.querySelectorAll(".turntable-item.lottery")[0];

      if (!target) {
        throw new Error("Cannot find the free lottery trigger");
      }

      target.click();
    });

    const [drawResult, nextConfig] = await Promise.all([drawResponsePromise, configAfterPromise]);
    const drawData = unwrapCaptured(drawResult);
    const freeCountAfter = toNumber(nextConfig?.free_count);

    summary.lottery = {
      status: "success",
      message: formatLotterySummary(drawData, freeCountAfter),
      data: drawData,
      freeCountAfter
    };
    console.log(summary.lottery.message);
  } catch (error) {
    await captureDiagnostics(page, "lottery");
    throw error;
  } finally {
    await page.close().catch(() => {});
  }
}

function getRunUrl() {
  const serverUrl = getEnv("GITHUB_SERVER_URL");
  const repository = getEnv("GITHUB_REPOSITORY");
  const runId = getEnv("GITHUB_RUN_ID");

  if (!serverUrl || !repository || !runId) {
    return "";
  }

  return `${serverUrl}/${repository}/actions/runs/${runId}`;
}

function formatRunTime() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date());
}

function getTaskStatusIcon(status) {
  switch (status) {
    case "success":
      return "✅";
    case "already_checked_in":
      return "☑️";
    case "skipped":
      return "⏭️";
    case "failed":
      return "❌";
    default:
      return "⚪";
  }
}

function buildCheckInLines(summary) {
  const checkIn = summary.checkIn;

  if (!checkIn) {
    return ["⚪ 未执行"];
  }

  const title = checkIn.status === "success" ? "签到成功" : checkIn.message || "未执行";
  const lines = [`${getTaskStatusIcon(checkIn.status)} ${escapeHtml(title)}`];
  const incrPoint = toNumber(checkIn.data?.incr_point);
  const contCount = toNumber(checkIn.counts?.cont_count);

  if (checkIn.status === "success" && incrPoint !== null) {
    lines.push(`• 本次获得：${incrPoint} 矿石`);
  }

  if (contCount !== null) {
    lines.push(`• 连续签到：${contCount} 天`);
  }

  return lines;
}

function buildLotteryLines(summary) {
  const lottery = summary.lottery;

  if (!lottery) {
    return ["⚪ 未执行"];
  }

  const title = lottery.status === "success" ? "免费抽奖成功" : lottery.message || "未执行";
  const lines = [`${getTaskStatusIcon(lottery.status)} ${escapeHtml(title)}`];
  const lotteryName = lottery.data?.lottery_name || lottery.data?.lottery_type_name || "";
  const drawLuckyValue = toNumber(lottery.data?.draw_lucky_value);
  const totalLuckyValue = toNumber(lottery.data?.total_lucky_value);
  const freeCountAfter = toNumber(lottery.freeCountAfter);

  if (lottery.status === "success" && lotteryName) {
    lines.push(`• 奖品：${escapeHtml(lotteryName)}`);
  }

  if (lottery.status === "success" && drawLuckyValue !== null) {
    lines.push(`• 幸运值：+${drawLuckyValue}`);
  }

  if (lottery.status === "success" && totalLuckyValue !== null) {
    lines.push(`• 累计幸运值：${totalLuckyValue}`);
  }

  if (lottery.status === "success" && freeCountAfter !== null) {
    lines.push(`• 剩余免费次数：${freeCountAfter}`);
  }

  if (lottery.status === "failed" && lottery.errorMessage) {
    lines.push(`• 异常：${escapeHtml(truncateText(lottery.errorMessage, 180))}`);
  }

  return lines;
}

function buildTelegramMessage(summary) {
  const lines = [];
  const overallIcon = summary.status === "success" ? "🟢" : "🔴";
  const overallLabel = summary.status === "success" ? "执行成功" : "执行失败";

  lines.push("<b>掘金每日任务播报</b>");
  lines.push(`${overallIcon} <b>${overallLabel}</b>`);
  lines.push(`🕒 <b>执行时间</b>：${escapeHtml(formatRunTime())}`);
  lines.push("");
  lines.push("📅 <b>签到</b>");
  lines.push(...buildCheckInLines(summary));
  lines.push("");
  lines.push("🎰 <b>抽奖</b>");
  lines.push(...buildLotteryLines(summary));

  if (typeof summary.points === "number") {
    lines.push("");
    lines.push(`🪙 <b>当前矿石</b>：<code>${summary.points}</code>`);
  }

  if (summary.errorMessage) {
    lines.push("");
    lines.push("⚠️ <b>异常信息</b>");
    lines.push(`<pre>${escapeHtml(truncateText(summary.errorMessage))}</pre>`);
  }

  const runUrl = getRunUrl();
  if (runUrl) {
    lines.push("");
    lines.push(`🔗 <a href="${escapeHtml(runUrl)}">查看 GitHub Actions 运行详情</a>`);
  }

  return lines.join("\n");
}

async function sendTelegramNotification(summary) {
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  const chatId = getEnv("TELEGRAM_CHAT_ID");

  if (!token && !chatId) {
    console.log("未配置 Telegram，跳过通知。");
    return;
  }

  if (!token || !chatId) {
    throw new Error("Telegram 配置不完整，请同时提供 TELEGRAM_BOT_TOKEN 和 TELEGRAM_CHAT_ID。");
  }

  const payload = {
    chat_id: chatId,
    text: buildTelegramMessage(summary),
    parse_mode: "HTML",
    disable_web_page_preview: true
  };

  const messageThreadId = getEnv("TELEGRAM_MESSAGE_THREAD_ID");
  if (messageThreadId) {
    const threadId = toNumber(messageThreadId);

    if (threadId === null) {
      throw new Error("TELEGRAM_MESSAGE_THREAD_ID 必须是数字。");
    }

    payload.message_thread_id = threadId;
  }

  const response = await fetch(`${TELEGRAM_BASE_URL}/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const result = await parseJsonResponse(response, "Telegram Bot API");

  if (!response.ok || result?.ok !== true) {
    throw new Error(`Telegram notification failed: ${result?.description ?? `HTTP ${response.status}`}`);
  }

  console.log("Telegram 通知发送成功。");
}

function readRecordedSummary() {
  const summaryPath = getSummaryPath();

  if (!existsSync(summaryPath)) {
    return {
      status: "failed",
      checkIn: null,
      lottery: null,
      points: null,
      errorMessage: "主任务失败，且未找到运行摘要文件。"
    };
  }

  const payload = JSON.parse(readFileSync(summaryPath, "utf8"));
  return payload.summary ?? payload;
}

async function runFallbackNotification() {
  if (hasNotificationSent()) {
    console.log("Telegram 通知已由主任务发送，跳过兜底通知。");
    return;
  }

  const summary = readRecordedSummary();

  if (summary.status !== "failed") {
    summary.status = "failed";
    summary.errorMessage ||= "GitHub Actions 主任务失败，触发 workflow 级兜底通知。";
  }

  await sendTelegramNotification(summary);
  await markNotificationSent();
}

async function runWorkflowWithDependencies({
  createBrowserContext: createContext,
  runCheckIn: runCheckInTask,
  runLottery: runLotteryTask,
  sendTelegramNotification: sendNotification,
  recordSummary: recordRunSummary = recordSummary,
  markNotificationSent: markSent = markNotificationSent,
  buildDefaultSummary: buildSummary = buildDefaultSummary
}) {
  const summary = buildSummary();
  let browser;
  let context;

  try {
    ({ browser, context } = await createContext());
    await runCheckInTask(context, summary);
  } catch (error) {
    summary.status = "failed";
    summary.errorMessage = error instanceof Error ? error.message : String(error);
    summary.lottery ??= {
      status: "failed",
      message: "未完成"
    };
  }

  if (summary.status === "success") {
    try {
      await runLotteryTask(context, summary);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      summary.lottery = {
        status: "failed",
        message: "抽奖未完成，签到已成功",
        errorMessage
      };
      console.warn(`抽奖失败，签到已完成：${errorMessage}`);
    }
  }

  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});

  await recordRunSummary(summary);

  try {
    await sendNotification(summary);
    await markSent();
  } catch (notificationError) {
    console.error(
      `Telegram 通知失败：${notificationError instanceof Error ? notificationError.message : String(notificationError)}`
    );

    if (summary.status === "success") {
      summary.status = "failed";
      summary.errorMessage =
        notificationError instanceof Error ? notificationError.message : String(notificationError);
    }
  }

  if (summary.status !== "success") {
    throw new Error(summary.errorMessage || "任务执行失败");
  }
}

async function runWorkflow() {
  return runWorkflowWithDependencies({
    createBrowserContext,
    runCheckIn,
    runLottery,
    sendTelegramNotification,
    recordSummary,
    markNotificationSent,
    buildDefaultSummary
  });
}

async function runCli() {
  if (process.argv[2] === "notify:fallback") {
    return runFallbackNotification();
  }

  return runWorkflow();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(`任务失败：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

export {
  buildDefaultSummary,
  buildTelegramMessage,
  ensurePageHealthy,
  runFallbackNotification,
  runWorkflow,
  runWorkflowWithDependencies
};
