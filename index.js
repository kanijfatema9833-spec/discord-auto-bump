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
const MY_USER_ID = '1259855596887478308';

async function sendBumpCommand() {
  try {
    const channel = await client.channels.fetch(BUMP_CHANNEL_ID);
    if (!channel) {
      console.error('[ERROR] Target channel not found.');
      return;
    }

    // OneBump ডিসকর্ড স্ল্যাশ কমান্ড রান করা
    await channel.sendSlash(ONEBUMP_BOT_ID, 'bump');
    console.log(`[BUMP SUCCESS] ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })} - Sent /bump command to channel: ${channel.name}`);

    // আপনার অ্যাকাউন্টে DM পাঠানো
    try {
      const myUser = await client.users.fetch(MY_USER_ID);
      if (myUser) {
        await myUser.send('@ahnafkarim0837 Server Bumped!');
        console.log('[SUCCESS] Sent DM notification.');
      }
    } catch (dmError) {
      console.error('[ERROR] DM পাঠাতে সমস্যা হয়েছে:', dmError.message);
    }

  } catch (error) {
    console.error('[ERROR] Failed to send /bump command:', error);
  }
}

function scheduleNextBump() {
  const baseDelay = 2 * 60 * 60 * 1000; // ২ ঘণ্টা
  const randomJitter = Math.floor(Math.random() * 20000) + 10000; // ১০ থেকে ৩০ সেকেন্ড র্যান্ডম বিরতি
  const totalDelay = baseDelay + randomJitter;

  console.log(`[NEXT BUMP] Scheduled in ${(totalDelay / (1000 * 60)).toFixed(2)} minutes.`);

  setTimeout(async () => {
    await sendBumpCommand();
    scheduleNextBump(); // পরবর্তী বাম্পের জন্য আবার শিডিউল করা
  }, totalDelay);
}

client.on('ready', async () => {
  console.log(`[SUCCESS] Logged in as ${client.user.username}`);

  client.user.setPresence({
    activities: [{ name: 'Roblox & Minecraft', type: 'PLAYING' }],
    status: 'online',
  });

  // ১ম বাম্প সাথে সাথে সম্পন্ন হবে এবং পরবর্তী বাম্পগুলোর জন্য টাইমার চালু হবে
  await sendBumpCommand();
  scheduleNextBump();
});

if (!process.env.TOKEN) {
  console.error('[CRITICAL] TOKEN environment variable missing!');
} else {
  client.login(process.env.TOKEN);
}
