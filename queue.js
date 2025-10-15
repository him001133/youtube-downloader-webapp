// queue.js
const { Queue } = require('bullmq');

// Use REDIS_URL from environment variables for production, default to localhost for development
const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
};

// Create a new queue named 'video-downloads'
const downloadQueue = new Queue('video-downloads', {
  connection: redisConnection,
});

module.exports = { downloadQueue };