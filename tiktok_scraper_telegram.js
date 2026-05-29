const cron = require('node-cron');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = '8823422105:AAG-mhQurbbqUp4KyhEdn0qQN_CGQFu4Qt4';
const CHAT_ID = '8881529092';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

let currentJob = null;
let nextRunTime = null;

function scheduleScrapeAt(targetTime) {
  if (currentJob) {
    currentJob.stop();
  }
  const cronExpression = `${targetTime.getMinutes()} ${targetTime.getHours()} * * *`;
  currentJob = cron.schedule(cronExpression, () => {
    scrapeTikTokVideos();
  }, {
    scheduled: true,
    timezone: 'Asia/Manila'
  });
  nextRunTime = targetTime;
  console.log(`Next scrape scheduled at ${targetTime.toLocaleString()}`);
}

function scheduleNextMorning() {
  const now = new Date();
  const phNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  let target = new Date(phNow);
  target.setHours(8, 0, 0, 0);
  if (phNow >= target) {
    target.setDate(target.getDate() + 1);
  }
  scheduleScrapeAt(target);
}

function resetScheduleFromManual() {
  const now = new Date();
  const phNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  let target = new Date(phNow);
  target.setHours(target.getHours() + 24);
  target.setMinutes(0, 0, 0);
  scheduleScrapeAt(target);
  console.log('Manual scrape triggered. Next scheduled scrape reset to 24 hours from now.');
}

async function scrapeTikTokVideos() {
  try {
    const options = {
      method: 'GET',
      url: 'https://tiktok-video-no-watermark2.p.rapidapi.com/feed/search',
      params: {
        keywords: 'fineshyt pinay viral',
        region: 'PH',
        count: '5'
      },
      headers: {
        'X-RapidAPI-Key': '4cd80b1366msh9918c7a2780a5bep11e5bbjsn3620f2094de1',
        'X-RapidAPI-Host': 'tiktok-video-no-watermark2.p.rapidapi.com'
      }
    };

    const response = await axios.request(options);
    const videos = response.data.data.videos || [];
    
    if (videos.length === 0) {
      await bot.sendMessage(CHAT_ID, 'No new TikTok videos found for #fineshyt.');
      console.log('No new videos found.');
      return;
    }

    await bot.sendMessage(CHAT_ID, `Found ${videos.length} videos. Sending top ${Math.min(videos.length, 3)}...`);

    for (let i = 0; i < Math.min(videos.length, 3); i++) {
      const video = videos[i];
      const videoUrl = video.play;
      const desc = video.title || 'No description';
      const videoPath = path.join(__dirname, `temp_${Date.now()}_${i}.mp4`);
      
      const writer = fs.createWriteStream(videoPath);
      const videoStream = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'stream'
      });
      
      videoStream.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      await bot.sendVideo(CHAT_ID, videoPath, { caption: `@fineshyt viral pinay\n${desc}` });
      fs.unlinkSync(videoPath);
    }
    
    console.log('TikTok videos sent successfully.');
  } catch (error) {
    console.error('Scraping error:', error.message);
    await bot.sendMessage(CHAT_ID, `Scrape failed: ${error.message}`);
  }
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const opts = {
    reply_markup: {
      keyboard: [[{ text: 'Scrappe' }]],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
  bot.sendMessage(chatId, 'Click Scrappe button to manually scrape TikTok videos now.', opts);
});

bot.onText(/Scrappe/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 'Manual scrape triggered. Fetching latest videos...');
  await scrapeTikTokVideos();
  resetScheduleFromManual();
});

bot.on('message', (msg) => {
  if (msg.text === 'Scrappe') return;
  if (msg.text && !msg.text.startsWith('/')) {
    bot.sendMessage(msg.chat.id, 'Use /start or press the Scrappe button.');
  }
});

scheduleNextMorning();
console.log('TikTok scraper bot started. Daily schedule at 8 AM PH time. Manual scrape via Scrappe button resets schedule to +24 hours.');