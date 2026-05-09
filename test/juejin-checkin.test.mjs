import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultSummary, runWorkflowWithDependencies } from "../scripts/juejin-checkin.mjs";

test("runWorkflowWithDependencies sends failure notification when lottery fails after check-in", async () => {
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
          status: "success",
          message: "签到成功：本次 +700 矿石",
          data: { incr_point: 700 },
          counts: { cont_count: 1246 }
        };
        summary.points = 363058;
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
    }),
    /page\.waitForResponse: Target page, context or browser has been closed/
  );

  assert.equal(notifications.length, 1);
  assert.equal(summaryRecords.length, 1);
  assert.equal(notifications[0].status, "failed");
  assert.equal(notifications[0].checkIn.status, "success");
  assert.equal(notifications[0].lottery.status, "failed");
  assert.match(notifications[0].errorMessage, /Target page, context or browser has been closed/);
  assert.equal(summaryRecords[0].status, "failed");
  assert.equal(notificationSentMarked, true);
});
