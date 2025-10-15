// worker.js
const { Worker } = require('bullmq');
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
require('dotenv').config();

const ytDlpWrap = new YTDlpWrap('/usr/local/bin/yt-dlp');

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
};

const worker = new Worker('video-downloads', async job => {
  const { videoUrl, format, jobId } = job.data;
  console.log(`Processing job ${job.id}: Downloading ${videoUrl} as ${format}`);
  
  const downloadsPath = path.join(__dirname, 'downloads');
  const outputPathTemplate = path.join(downloadsPath, `${jobId}.%(ext)s`);

  try {
    let commandArgs = [];

    // --- The most resilient combination of arguments ---
    if (format === 'mp4') {
      commandArgs = [
        videoUrl, // URL first
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        '--add-header', 'Accept-Language:en-US,en;q=0.5',
        '--ipv4', // Force IPv4, can sometimes bypass certain blocks
        '--no-playlist',
        
        // The "magic" part: a smart format selector with fallbacks
        '-f', 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4][height<=1080]/best[height<=1080]/best',
        
        '--merge-output-format', 'mp4',
        '-o', outputPathTemplate,
      ];
    } else if (format === 'mp3') {
      commandArgs = [
        videoUrl,
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        '--add-header', 'Accept-Language:en-US,en;q=0.5',
        
        '--no-playlist',
        '-x', // Extract audio
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '-o', outputPathTemplate,
      ];
    } else {
        throw new Error('Invalid format specified.');
    }
    
    await new Promise((resolve, reject) => {
        ytDlpWrap.exec(commandArgs)
            .on('progress', (progress) => console.log(`Job ${job.id}:`, progress.percent, progress.eta))
            .on('error', (error) => reject(error))
            .on('close', () => resolve());
    });

    const fs = require('fs');
    const files = fs.readdirSync(downloadsPath);
    const finalFile = files.find(file => file.startsWith(String(jobId)));
    
    if (finalFile) {
        console.log(`Job ${job.id} completed. File: ${finalFile}`);
        return { filename: finalFile };
    } else {
        throw new Error('Downloaded file not found after process completion.');
    }

  } catch (error) {
    console.error(`Job ${job.id} failed with error:`, error.message || error);
    throw error;
  }
}, { connection: redisConnection, concurrency: 5 });

worker.on('failed', (job, err) => {
  console.log(`Job ${job.id} has failed with error: ${err.message}`);
});

console.log('Worker is listening for jobs...');