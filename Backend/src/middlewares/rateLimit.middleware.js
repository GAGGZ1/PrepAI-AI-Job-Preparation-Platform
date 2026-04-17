const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis"); 
const redisClient = require("../config/redis");
const { ipKeyGenerator } = require("express-rate-limit");

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // adjust per your budget
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: "rate-limit:",
  }),
  keyGenerator: (req) => {
  return req.user?.id || ipKeyGenerator(req);
},
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many requests, please try again later.",
    });
  },
});

module.exports = { apiRateLimiter };