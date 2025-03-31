import rateLimit from "express-rate-limit";

export const loginRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minutes
  max: 10, // Limit each IP to 10 login requests per `window` (here, per 1 minutes)
  message: {
    message:
      "Too many login attempts from this IP, please try again after 1 minute.",
  },
  headers: true, // Send rate limit info in the `RateLimit-*` headers
});
