const { Client } = require('discord.js-selfbot-v13');
const express = require('express');

const client = new Client({ checkUpdate: false });
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('OneBump Auto-Bumper & 24/7 Service Active!');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

const BUMP_CHANNEL_ID = '1538947427669643434';
const ONEBUMP_BOT_ID = '1028956609382199346';

async function scheduleNextBump() {
  try {
    const channel = await client.channels.fetch(BUMP_CHANNEL_ID);
    if (!channel) {
      console.error('[ERROR] Channel not found!');
      return;
    }

    await channel.sendSlash(ONEBUMP_BOT_ID, 'bump');
    console.log(`[BUMP SUCCESS] ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })} - OneBump /bump command sent!`);
  } catch (error) {
    console.error('[BUMP ERROR] Failed to send bump:', error);
  }

  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const RANDOM_JITTER = Math.floor(Math.random() * (7 * 60 * 1000 - 2 * 60 * 1000 + 1)) + 2 * 60 * 1000;
  const NEXT_DELAY = TWO_HOURS + RANDOM_JITTER;

  console.log(`[NEXT BUMP] Next bump scheduled in ${(NEXT_DELAY / (60 * 1000)).toFixed(1)} minutes.`);

  setTimeout(scheduleNextBump, NEXT_DELAY);
}

client.on('ready', async () => {
  console.log(`[SUCCESS] Logged in as ${client.user.username}`);

  client.user.setPresence({
    activities: [{ name: 'Roblox & Minecraft', type: 'PLAYING' }],
    status: 'online',
  });

  scheduleNextBump();
});

if (!process.env.TOKEN) {
  console.error('[CRITICAL] TOKEN environment variable missing!');
} else {
  client.login(process.env.TOKEN);
}
