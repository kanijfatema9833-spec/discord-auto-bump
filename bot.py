import os
import discord
from discord.ext import commands

UNVERIFIED_ROLE_ID = 1548138865456455792

intents = discord.Intents.default()
intents.members = True
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    print(f'[BOT READY] Logged in as {bot.user.name}')
    for guild in bot.guilds:
        unverified_role = guild.get_role(UNVERIFIED_ROLE_ID)
        if not unverified_role:
            print(f'[ERROR] Role ID {UNVERIFIED_ROLE_ID} not found in {guild.name}')
            continue

        for member in guild.members:
            if member.bot:
                continue
            if len(member.roles) == 1:
                try:
                    await member.add_roles(unverified_role)
                    print(f'[ROLE GIVEN] Added Unverified role to: {member.name}')
                except Exception as e:
                    print(f'[ERROR] Could not give role to {member.name}: {e}')

@bot.event
async def on_member_join(member):
    if member.bot:
        return
    guild = member.guild
    unverified_role = guild.get_role(UNVERIFIED_ROLE_ID)
    if unverified_role:
        try:
            await member.add_roles(unverified_role)
            print(f'[AUTO-ROLE] Added Unverified role to new member: {member.name}')
        except Exception as e:
            print(f'[ERROR] Failed to add role to {member.name}: {e}')

token = os.environ.get('BOT_TOKEN')
if token:
    bot.run(token)
else:
    print('[CRITICAL] BOT_TOKEN environment variable missing!')
