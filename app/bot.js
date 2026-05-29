const axios = require('axios');

const BOT_TOKEN = '8823422105:AAG-mhQurbbqUp4KyhEdn0qQN_CGQFu4Qt4';
const CHAT_ID = '8881529092';
const RAPIDAPI_KEY = '4cd80b1366msh9918c7a2780a5bep11e5bbjsn3620f2094de1';

async function scrapeAndSend() {
  try {
    const options = {
      method: 'GET',
      url: 'https://tiktok-video-no-watermark2.p.rapidapi.com/feed/search',
      params: { keywords: 'fineshyt pinay viral', region: 'PH', count: '5' },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'tiktok-video-no-watermark2.p.rapidapi.com'
      }
    };
    const response = await axios.request(options);
    const videos = response.data.data.videos || [];
    if (videos.length === 0) {
      await sendMessage('No new videos found.');
      return;
    }
    await sendMessage(`Found ${videos.length} videos. Sending top ${Math.min(videos.length, 3)}...`);
    for (let i = 0; i < Math.min(videos.length, 3); i++) {
      const video = videos[i];
      const videoUrl = video.play;
      const desc = video.title || 'No description';
      const videoRes = await axios({ method: 'GET', url: videoUrl, responseType: 'arraybuffer' });
      const buffer = Buffer.from(videoRes.data);
      await sendVideo(buffer, `@fineshyt viral pinay\n${desc}`);
    }
  } catch (error) {
    await sendMessage(`Scrape failed: ${error.message}`);
  }
}

async function sendMessage(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await axios.post(url, { chat_id: CHAT_ID, text });
}

async function sendVideo(buffer, caption) {
  const formData = new FormData();
  formData.append('chat_id', CHAT_ID);
  formData.append('video', new Blob([buffer]), 'video.mp4');
  formData.append('caption', caption);
  await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
}

module.exports = async (req, res) => {
  // Allow Telegram to call this endpoint
  const body = req.body;
  const message = body?.message;
  if (!message) {
    res.status(200).send('ok');
    return;
  }
  const text = message.text || '';
  const chatId = message.chat.id;
  if (text === '/start') {
    const keyboard = { reply_markup: { keyboard: [['Scrappe']], resize_keyboard: true } };
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: 'Click Scrappe button to manually scrape TikTok videos now.',
      ...keyboard
    });
  } else if (text === 'Scrappe') {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: 'Manual scrape triggered. Fetching latest videos...'
    });
    await scrapeAndSend();
  }
  res.status(200).send('ok');
};
