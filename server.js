// server.js
const express = require('express');
const path = require('path');
const { downloadQueue } = require('./queue');
const { Job } = require('bullmq');
require('dotenv').config(); // Load .env file

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Serve downloaded files statically
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// --- API Routes ---

// Route to start a new download job
app.post('/start-download', async (req, res) => {
  const { url, format } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required.' });
  }

  // Add job to the queue
  const job = await downloadQueue.add('download-video', { videoUrl: url, format, jobId: Date.now() });
  
  res.status(202).json({ jobId: job.id });
});

// Route to check the status of a job
app.get('/status/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = await downloadQueue.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  const state = await job.getState();
  const progress = job.progress;
  const returnValue = job.returnvalue;

  res.json({
    jobId,
    state,
    progress,
    result: returnValue
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});