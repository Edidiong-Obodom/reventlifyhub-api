import rateLimit from "express-rate-limit";

export const allRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8, // Limit each IP to 8 requests per `window` (here, per 15 minutes)
  message: {
    message:
      "Too many requests from this IP, please try again after 15 minutes before you can make this particular request.",
  },
  headers: true, // Send rate limit info in the `RateLimit-*` headers
});
