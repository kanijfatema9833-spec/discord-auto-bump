const { spawn } = require('child_process');
const { Client } = require('discord.js-selfbot-v13');
const express = require('express');

// ১. Python বট (bot.py) ব্যাকগ্রাউন্ডে চালু করা
const pythonProcess = spawn('python3', ['bot.py'], { stdio: 'inherit' });

pythonProcess.on('error', (err) => {
  console.error('[PYTHON ERROR] Failed to start bot.py:', err);
});

// ২. Express Web Server (UptimeRobot-এর জন্য)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('OneBump Auto-Bumper & 24/7 Service Active!');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// ৩. Discord Selfbot কনফিগারেশন
const client = new Client({ checkUpdate: false, syncStatus: false });

const BUMP_CHANNEL_ID = '1538947427669643434';
const ONEBUMP_BOT_ID = '1028956609382199346';
const MY_USER_ID = '1259855596887478308';
const TARGET_GUILD_ID = '1533170362819416144';

// মানুষের মত র‍্যান্ডম ডিলে তৈরি করার ফাংশন
const randomDelay = (min, max) => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));

// GMT+6 (ঢাকা সময়) অনুযায়ী স্ট্যাটাস আপডেট করার ফাংশন
function updateTimeBasedStatus() {
  if (!client.user) return;

  const dhakaHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
    10
  );

  let statusToSet = 'online';

  if (dhakaHour >= 0 && dhakaHour < 8) {
    statusToSet = 'online';
  } else if (dhakaHour >= 8 && dhakaHour < 16) {
    statusToSet = 'idle';
  } else {
    statusToSet = 'dnd';
  }

  client.user.setStatus(statusToSet);
  console.log(`[STATUS UPDATE] Current Dhaka Hour: ${dhakaHour}:00 - Status set to: ${statusToSet}`);
}

async function sendBumpCommand() {
  try {
    const channel = await client.channels.fetch(BUMP_CHANNEL_ID);
    if (!channel) return;

    await channel.sendSlash(ONEBUMP_BOT_ID, 'bump');
    console.log(`[BUMP SUCCESS] ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })} - Sent /bump command`);

    try {
      const myUser = await client.users.fetch(MY_USER_ID);
      if (myUser) await myUser.send(`<@${MY_USER_ID}> Server Bumped!`);
    } catch (dmError) { }
  } catch (error) {
    console.error('[ERROR] Failed to send /bump command:', error);
  }
}

function scheduleNextBump() {
  // ১ ঘণ্টা পর পর বাম্প করার জন্য সময় পরিবর্তন করা হলো (১ ঘণ্টা = ১ * ৬০ * ৬০ * ১০০০ মিলিসেকেন্ড)
  const baseDelay = 1 * 60 * 60 * 1000; 
  const randomJitter = Math.floor(Math.random() * 20000) + 10000; // ১০-৩০ সেকেন্ডের র্যান্ডম ডিলে
  const totalDelay = baseDelay + randomJitter;

  console.log(`[NEXT BUMP] Scheduled in ${(totalDelay / (1000 * 60)).toFixed(2)} minutes.`);
  setTimeout(async () => {
    await sendBumpCommand();
    scheduleNextBump();
  }, totalDelay);
}

// ৪. নির্দিষ্ট সার্ভার ছাড়া বাকি সব সার্ভার থেকে লিভ নেওয়া
async function leaveOtherGuilds() {
  for (const [guildId, guild] of client.guilds.cache) {
    if (guildId !== TARGET_GUILD_ID) {
      try {
        await guild.leave();
        console.log(`[GUILD LEAVE] Left server: ${guild.name}`);
      } catch (err) {}
    }
  }
}

// ৫. নির্দিষ্ট চ্যানেলের মেম্বারদের ফেচ করে ফ্রেন্ড রিকোয়েস্ট পাঠানো
async function sendFriendRequestsFromChannel() {
  try {
    const channel = await client.channels.fetch(BUMP_CHANNEL_ID);
    if (!channel || !channel.guild) {
      console.error('[FRIEND REQ ERROR] Target channel or guild not found!');
      return;
    }

    console.log(`[FRIEND REQ] Channel: #${channel.name}-এর মেম্বারদের লোড করা হচ্ছে...`);

    const members = channel.members;
    console.log(`[FRIEND REQ] #${channel.name} চ্যানেলে ${members.size} জন মেম্বার পাওয়া গেছে।`);

    for (const [id, member] of members) {
      if (member.user.bot || member.id === client.user.id || client.relationships.cache.has(member.id)) {
        continue; 
      }

      try {
        await member.user.sendFriendRequest();
        console.log(`[FRIEND REQ SENT] Sent to: ${member.user.tag}`);
        await randomDelay(10000, 20000); 
      } catch (err) {
        console.error(`[FRIEND REQ FAILED] ${member.user.tag}:`, err.message);
        if (err.message.toLowerCase().includes('captcha') || err.message.toLowerCase().includes('rate limit')) {
          console.warn('[WARNING] Captcha or Rate Limit hit! Pausing for 5 minutes...');
          await randomDelay(300000, 300000); 
        } else {
          await randomDelay(5000, 10000);
        }
      }
    }
  } catch (err) {
    console.error('[FRIEND REQ ERROR] Channel members fetch failed:', err.message);
  }
}

// ৬. নতুন মেম্বার সার্ভারে যুক্ত হলে ফ্রেন্ড রিকোয়েস্ট পাঠানো
client.on('guildMemberAdd', async (member) => {
  if (member.guild.id === TARGET_GUILD_ID && !member.user.bot) {
    try {
      await randomDelay(5000, 15000);
      await member.user.sendFriendRequest();
      console.log(`[NEW MEMBER] Friend request sent to: ${member.user.tag}`);
    } catch (err) {
      console.error(`[NEW MEMBER ERROR]:`, err.message);
    }
  }
});

// ৭. ফ্রেন্ড রিকোয়েস্ট অ্যাকসেপ্ট করলে স্বয়ংক্রিয় ডিএম (DM) পাঠানো
client.on('relationshipAdd', async (relationship) => {
  if (relationship.type === 1 || relationship.type === 'FRIEND') {
    try {
      const user = relationship.user || await client.users.fetch(relationship.id);
      if (user) {
        const dmChannel = await user.createDM();
        await dmChannel.sendTyping();
        await randomDelay(3000, 6000); 
        await dmChannel.send('hello, i am the manager of sultan smp and studios! how can i help you today?');
        console.log(`[DM SENT] Successfully sent welcome DM to: ${user.tag || user.id}`);
      }
    } catch (err) {}
  }
});

// ৮. কেউ মেসেজ পাঠালে বা মেনশন করলে সাথে সাথে Seen / Read করা
client.on('messageCreate', async (message) => {
  try {
    if (message.author.id === client.user.id) return;
    
    // মেসেজ আসার সাথে সাথেই চ্যানেলটি Ack/Seen করে দেবে
    if (typeof message.channel.ack === 'function') {
      await message.channel.ack();
    }
  } catch (err) {}
});

// ৯. সার্ভারের জমে থাকা মেনশন/ব্যাজ ক্লিয়ার করা (প্রতি ১০ মিনিট পর পর চলবে)
async function clearAllServerNotifications() {
  try {
    const guild = await client.guilds.fetch(TARGET_GUILD_ID);
    if (!guild) return;

    // পুরো সার্ভারের সমস্ত পিন্গ একবারে ক্লিয়ার করবে
    if (typeof guild.ack === 'function') {
      await guild.ack();
      console.log(`[CLEAR NOTIFS] ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })} - Successfully cleared all server-wide pings and red badges!`);
    }

    // ব্যাকআপ হিসেবে টেক্সট চ্যানেলগুলোও ক্লিয়ার করা
    const textChannels = guild.channels.cache.filter(ch => ch.isText() && typeof ch.ack === 'function');
    for (const [id, channel] of textChannels) {
      try {
        await channel.ack();
        await randomDelay(200, 500); // রেট লিমিট এড়াতে ছোট বিরতি
      } catch (err) {}
    }
  } catch (err) {
    console.error('[CLEAR NOTIFS ERROR]:', err.message);
  }
}

// Client Ready Event
client.on('ready', async () => {
  console.log(`[SUCCESS] Logged in as ${client.user.username}`);

  updateTimeBasedStatus();
  setInterval(updateTimeBasedStatus, 15 * 60 * 1000);

  await leaveOtherGuilds();
  
  // বটের সার্ভার নোটিফিকেশন ক্লিয়ারেন্স চালু করা (প্রতি ১০ মিনিট পর পর)
  await clearAllServerNotifications();
  setInterval(clearAllServerNotifications, 10 * 60 * 1000); 

  // চ্যানেলের মেম্বারদের ফ্রেন্ড রিকোয়েস্ট পাঠানো চালু করা
  sendFriendRequestsFromChannel();

  // ১ম বাম্প সম্পাদন এবং ১ ঘণ্টার টাইমার চালু করা
  await sendBumpCommand();
  scheduleNextBump();
});

if (!process.env.TOKEN) {
  console.error('[CRITICAL] TOKEN environment variable missing!');
} else {
  client.login(process.env.TOKEN);
}
