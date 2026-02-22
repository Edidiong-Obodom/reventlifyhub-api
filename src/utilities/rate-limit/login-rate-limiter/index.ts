import rateLimit from "express-rate-limit";

export const loginRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minutes
  max: 10, // Limit each IP to 10 login requests per `window` (here, per 1 minutes)
  standardHeaders: true, // replaces `headers: true` (newer spec)
  legacyHeaders: false,
  keyGenerator: (req) => req.ip, // now safe
  message: {
    message: "Too many login attempts. Try again later.",
  },
});
