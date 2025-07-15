import { Request } from "express";
import { formatDuration } from "../../helpers";
import { auditLogs } from "../logger/allLogs";

export const auditMiddleware = () => {
  return async (req: Request, res, next) => {
    const startTime = Date.now();
    const currentDate = new Date();

    res.on("finish", async () => {
      if (req.skipAuditLog) return;

      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      const user = req.auditData?.user ?? req.user ?? req.email ?? "anonymous";
      console.log("req.originalUrl: ", req.originalUrl);

      const action =
        req.auditData?.action ?? `${req.method} ${req.originalUrl}`;
      const details =
        req.auditData?.details ??
        `${req.method} ${
          req.originalUrl
        } responded with ${statusCode} in ${formatDuration(duration)}`;

      await auditLogs({
        req,
        user,
        action,
        details,
        endPoint: req.originalUrl,
        date: currentDate,
        method: req.method,
        userAgent: req.headers["user-agent"],
        statusCode,
        duration: formatDuration(duration),
      });
    });

    next();
  };
};
