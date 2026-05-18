import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDefaultSummary,
  buildTelegramMessage,
  ensurePageHealthy,
  runWorkflowWithDependencies
} from "../scripts/juejin-checkin.mjs";

test("runWorkflowWithDependencies sends failure notification when check-in fails", async () => {
  const notifications = [];
  const summaryRecords = [];
  let notificationSentMarked = false;

  await assert.rejects(
    runWorkflowWithDependencies({
      createBrowserContext: async () => ({
        browser: {
          close: async () => {}
        },
        context: {
          close: async () => {}
        }
      }),
      runCheckIn: async (_context, summary) => {
        summary.checkIn = {
          status: "failed",
          message: "签到未完成"
        };
        throw new Error("Missing required environment variable: JUEJIN_COOKIE");
      },
      runLottery: async () => {
        throw new Error("lottery should not run after check-in failure");
      },
      sendTelegramNotification: async (summary) => {
        notifications.push(structuredClone(summary));
      },
      recordSummary: async (summary) => {
        summaryRecords.push(structuredClone(summary));
      },
      markNotificationSent: async () => {
        notificationSentMarked = true;
      },
      buildDefaultSummary
    }),
    /Missing required environment variable: JUEJIN_COOKIE/
  );

  assert.equal(notifications.length, 1);
  assert.equal(summaryRecords.length, 1);
  assert.equal(notifications[0].status, "failed");
  assert.equal(notifications[0].checkIn.status, "failed");
  assert.equal(notifications[0].lottery.status, "failed");
  assert.match(notifications[0].errorMessage, /Missing required environment variable/);
  assert.equal(summaryRecords[0].status, "failed");
  assert.equal(notificationSentMarked, true);
});

test("runWorkflowWithDependencies keeps check-in success when only lottery fails", async () => {
  const notifications = [];
  const summaryRecords = [];
  let notificationSentMarked = false;

  await runWorkflowWithDependencies({
    createBrowserContext: async () => ({
      browser: {
        close: async () => {}
      },
      context: {
        close: async () => {}
      }
    }),
    runCheckIn: async (_context, summary) => {
      summary.checkIn = {
        status: "success",
        message: "签到成功：本次 +700 矿石",
        data: { incr_point: 700 },
        counts: { cont_count: 1254 }
      };
      summary.points = 370870;
    },
    runLottery: async () => {
      throw new Error("page.waitForResponse: Target page, context or browser has been closed");
    },
    sendTelegramNotification: async (summary) => {
      notifications.push(structuredClone(summary));
    },
    recordSummary: async (summary) => {
      summaryRecords.push(structuredClone(summary));
    },
    markNotificationSent: async () => {
      notificationSentMarked = true;
    },
    buildDefaultSummary
  });

  assert.equal(notifications.length, 1);
  assert.equal(summaryRecords.length, 1);
  assert.equal(notifications[0].status, "success");
  assert.equal(notifications[0].checkIn.status, "success");
  assert.equal(notifications[0].lottery.status, "failed");
  assert.match(notifications[0].lottery.message, /抽奖未完成/);
  assert.match(notifications[0].lottery.errorMessage, /Target page, context or browser has been closed/);
  assert.equal(summaryRecords[0].status, "success");
  assert.equal(notificationSentMarked, true);
});

test("buildTelegramMessage includes lottery failure details", () => {
  const message = buildTelegramMessage({
    status: "success",
    checkIn: {
      status: "success",
      message: "签到成功：本次 +700 矿石",
      data: { incr_point: 700 },
      counts: { cont_count: 1254 }
    },
    lottery: {
      status: "failed",
      message: "抽奖未完成，签到已成功",
      errorMessage: "page.waitForResponse: Target page, context or browser has been closed"
    },
    points: 370870,
    errorMessage: ""
  });

  assert.match(message, /抽奖未完成，签到已成功/);
  assert.match(message, /Target page, context or browser has been closed/);
});

test("ensurePageHealthy reports empty pages before title mismatch", async () => {
  const page = {
    url: () => "https://juejin.cn/user/center/lottery",
    title: async () => "",
    evaluate: async () => ""
  };

  await assert.rejects(
    ensurePageHealthy(page, "幸运抽奖"),
    /Juejin page rendered empty: https:\/\/juejin\.cn\/user\/center\/lottery/
  );
});
