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

// GMT+6 অনুযায়ী স্ট্যাটাস আপডেট করার ফাংশন
function updateTimeBasedStatus() {
  if (!client.user) return;

  // ঢাকা সময়ের বর্তমান ঘণ্টা (0-23) বের করা
  const dhakaHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
    10
  );

  let statusToSet = 'online';

  if (dhakaHour >= 6 && dhakaHour < 14) {
    // সকাল ৬:০০ থেকে দুপুর ১:৫৯ পর্যন্ত Online
    statusToSet = 'online';
  } else if (dhakaHour >= 14 && dhakaHour < 22) {
    // দুপুর ২:০০ থেকে রাত ৯:৫৯ পর্যন্ত Idle
    statusToSet = 'idle';
  } else {
    // রাত ১০:০০ থেকে সকাল ৫:৫৯ পর্যন্ত DND
    statusToSet = 'dnd';
  }

  client.user.setPresence({
    activities: [],
    status: statusToSet,
  });

  console.log(`[STATUS UPDATE] Current Dhaka Hour: ${dhakaHour}:00 - Presence set to: ${statusToSet}`);
}

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

    // আপনার অ্যাকাউন্টে প্রপার পিং সহ DM পাঠানো
    try {
      const myUser = await client.users.fetch(MY_USER_ID);
      if (myUser) {
        await myUser.send(`<@${MY_USER_ID}> Server Bumped!`);
        console.log('[SUCCESS] Sent DM notification with ping.');
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

  // বট চালুর সাথে সাথে স্ট্যাটাস আপডেট করা
  updateTimeBasedStatus();

  // প্রতি ১৫ মিনিট পর পর বাংলাদেশ সময় চেক করে স্ট্যাটাস আপডেট রাখা
  setInterval(updateTimeBasedStatus, 15 * 60 * 1000);

  // ১ম বাম্প সাথে সাথে সম্পন্ন হবে এবং পরবর্তী বাম্পগুলোর জন্য টাইমার চালু হবে
  await sendBumpCommand();
  scheduleNextBump();
});

if (!process.env.TOKEN) {
  console.error('[CRITICAL] TOKEN environment variable missing!');
} else {
  client.login(process.env.TOKEN);
}
