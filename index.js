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
const client = new Client({ checkUpdate: false });

const BUMP_CHANNEL_ID = '1538947427669643434';
const ONEBUMP_BOT_ID = '1028956609382199346';
const MY_USER_ID = '1259855596887478308';
const TARGET_GUILD_ID = '1533170362819416144';

// মানুষের মত র‍্যান্ডম ডিলে তৈরি করার ফাংশন (milliseconds)
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

    await channel.sendSlash(ONEBUMP_BOT_ID, 'bump');
    console.log(`[BUMP SUCCESS] ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })} - Sent /bump command`);

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
  const randomJitter = Math.floor(Math.random() * 20000) + 10000; // ১০-৩০ সেকেন্ড র্যান্ডম ডিলে
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
        console.log(`[GUILD LEAVE] Left server: ${guild.name} (${guildId})`);
      } catch (err) {
        console.error(`[GUILD LEAVE ERROR] Failed to leave ${guild.name}:`, err.message);
      }
    }
  }
}

// ৫. নির্দিষ্ট সার্ভারের সব মেম্বারকে সেফটি ডিলে সহ ফ্রেন্ড রিকোয়েস্ট পাঠানো
async function sendFriendRequestsToGuildMembers() {
  try {
    const guild = await client.guilds.fetch(TARGET_GUILD_ID);
    if (!guild) {
      console.error('[FRIEND REQ ERROR] Target guild not found!');
      return;
    }

    const members = await guild.members.fetch();
    console.log(`[FRIEND REQ] Found ${members.size} members in target guild.`);

    for (const [id, member] of members) {
      if (member.user.bot || member.id === client.user.id) continue;

      try {
        await member.user.sendFriendRequest();
        console.log(`[FRIEND REQ SENT] Sent to: ${member.user.tag}`);
        
        // মানুষের মতো আচরণ করতে ১ থেকে ৩ মিনিটের র‍্যান্ডম বিরতি (60,000ms to 180,000ms)
        await randomDelay(60000, 180000); 
      } catch (err) {
        console.error(`[FRIEND REQ FAILED] ${member.user.tag}:`, err.message);
        
        // ক্যাপচা চাইলে বা রেট লিমিট খেলে অ্যাকাউন্ট বাঁচাতে ৩০ মিনিট অপেক্ষা করবে
        if (err.message.toLowerCase().includes('captcha') || err.message.toLowerCase().includes('rate limit')) {
          console.warn('[WARNING] Captcha or Rate Limit hit! Pausing friend requests for 30 minutes to keep account safe...');
          await randomDelay(1800000, 1800000); // 30 minutes pause
        } else {
          // অন্য এররের জন্য সাধারণ ১৫-২০ সেকেন্ড বিরতি
          await randomDelay(15000, 20000);
        }
      }
    }
  } catch (err) {
    console.error('[FRIEND REQ ERROR] Failed to fetch guild members:', err.message);
  }
}

// ৬. নতুন মেম্বার সার্ভারে যুক্ত হলে ফ্রেন্ড রিকোয়েস্ট পাঠানো
client.on('guildMemberAdd', async (member) => {
  if (member.guild.id === TARGET_GUILD_ID && !member.user.bot) {
    try {
      // সাথে সাথে না পাঠিয়ে ১০ থেকে ৩০ সেকেন্ড পর রিকোয়েস্ট পাঠাবে
      await randomDelay(10000, 30000);
      await member.user.sendFriendRequest();
      console.log(`[NEW MEMBER] Friend request sent to: ${member.user.tag}`);
    } catch (err) {
      console.error(`[NEW MEMBER ERROR] Failed to send request to ${member.user.tag}:`, err.message);
    }
  }
});

// ৭. ফ্রেন্ড রিকোয়েস্ট অ্যাকসেপ্ট করলে স্বয়ংক্রিয় ডিএম (DM) পাঠানো
client.on('relationshipAdd', async (relationship) => {
  if (relationship.type === 1 || relationship.type === 'FRIEND') {
    try {
      const user = relationship.user || await client.users.fetch(relationship.id);
      if (user) {
        // DM চ্যানেল তৈরি করা
        const dmChannel = await user.createDM();
        
        // টাইপিং স্ট্যাটাস চালু করা (যেন মনে হয় মানুষ টাইপ করছে)
        await dmChannel.sendTyping();
        
        // মেসেজ টাইপ করতে ৪ থেকে ৮ সেকেন্ড সময় নেওয়ার ভান করা
        await randomDelay(4000, 8000); 
        
        await dmChannel.send('hello, i am the manager of sultan smp and studios! how can i help you today?');
        console.log(`[DM SENT] Successfully sent welcome DM to: ${user.tag || user.id}`);
      }
    } catch (err) {
      console.error(`[DM ERROR] Could not send DM to ${relationship.id}:`, err.message);
    }
  }
});

// ৮. কেউ মেসেজ পাঠালে সাথে সাথে Seen / Read করা
client.on('messageCreate', async (message) => {
  try {
    // নিজের পাঠানো মেসেজ হলে স্কিপ করবে
    if (message.author.id === client.user.id) return;

    // মেসেজটি যে চ্যানেলে এসেছে তা Seen (ACK) করা
    if (typeof message.channel.ack === 'function') {
      await message.channel.ack();
    } else if (typeof message.ack === 'function') {
      await message.ack();
    }
  } catch (err) {
    // কোনো ত্রুটি হলে ইগনোর করবে
  }
});

// ৯. সার্ভারের সব চ্যানেলের নোটিফিকেশন প্রতিদিন চেক ও ক্লিয়ার (Mark as Read) করার ফাংশন
async function clearAllServerNotifications() {
  try {
    const guild = await client.guilds.fetch(TARGET_GUILD_ID);
    if (!guild) return;

    console.log(`[CLEAR NOTIFS] Clearing unread notifications for guild: ${guild.name}`);

    // টেক্সট ভিত্তিক চ্যানেলগুলো ফিল্টার করা
    const textChannels = guild.channels.cache.filter(
      (ch) => ch.isText() && typeof ch.ack === 'function'
    );

    for (const [id, channel] of textChannels) {
      try {
        await channel.ack();
        // ডিসকোর্ড এপিআই রেট-লিমিট এড়াতে ১ থেকে ৩ সেকেন্ডের র‍্যান্ডম ডিলে
        await randomDelay(1000, 3000);
      } catch (err) {
        // এক্সেস না থাকলে স্কিপ করবে
      }
    }
    console.log('[CLEAR NOTIFS] All server channels marked as read successfully.');
  } catch (err) {
    console.error('[CLEAR NOTIFS ERROR] Failed to clear notifications:', err.message);
  }
}

// Client Ready Event
client.on('ready', async () => {
  console.log(`[SUCCESS] Logged in as ${client.user.username}`);

  updateTimeBasedStatus();
  setInterval(updateTimeBasedStatus, 15 * 60 * 1000);

  // অনাকাঙ্ক্ষিত সার্ভার থেকে লিভ নেওয়া
  await leaveOtherGuilds();

  // ব্যাকগ্রাউন্ডে ফ্রেন্ড রিকোয়েস্ট পাঠানো শুরু করা
  sendFriendRequestsToGuildMembers();

  // সার্ভারের নোটিফিকেশন ক্লিয়ার করা (প্রতি ২৪ ঘণ্টায় একবার চালানো)
  await clearAllServerNotifications();
  setInterval(clearAllServerNotifications, 24 * 60 * 60 * 1000);

  // ১ম বাম্প সম্পাদন এবং টাইমার চালু করা
  await sendBumpCommand();
  scheduleNextBump();
});

if (!process.env.TOKEN) {
  console.error('[CRITICAL] TOKEN environment variable missing!');
} else {
  client.login(process.env.TOKEN);
}
