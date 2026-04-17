const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (err) => {
  console.error("[Redis] Client error", err);
});

redisClient.on("connect", () => {
  console.log("[Redis] Connected");
});

(async () => {
  await redisClient.connect();
})();

module.exports = redisClient;