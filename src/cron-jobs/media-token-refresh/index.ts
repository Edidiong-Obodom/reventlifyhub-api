import cron from "node-cron";
import instaRefreshCron from "./crons/instaRefresh";

// run immediately after server starts
// instaRefreshCron();

// refresh instaAccessToken eg: daily(every Midnight)
cron.schedule("0 0 * * *", async () => {
  // await instaRefreshCron();
});
// refresh instaAccessToken eg: weekly(every Sat)
// cron.schedule("* * * * * 7", async () => {
//   await instaRefreshCron();
// });
// refresh instaAccessToken eg: every minute
// cron.schedule("* * * * *", async () => {
//   await instaRefreshCron();
// });
