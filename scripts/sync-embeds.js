const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANGED_CHANNELS = process.env.CHANGED_CHANNELS ? process.env.CHANGED_CHANNELS.split(' ') : [];

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN environment variable is not set');
  process.exit(1);
}

if (!GUILD_ID) {
  console.error('GUILD_ID environment variable is not set');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

function collectAttachments(obj) {
  const attachments = new Set();
  function walk(o) {
    if (typeof o === "string" && o.startsWith("attachment://")) {
      attachments.add(o.replace("attachment://", ""));
    } else if (Array.isArray(o)) {
      o.forEach(walk);
    } else if (o && typeof o === "object") {
      Object.values(o).forEach(walk);
    }
  }
  walk(obj);
  return Array.from(attachments);
}

function getAllChannelDirs() {
  const channelsPath = path.join(__dirname, "..", "channels");
  if (!fs.existsSync(channelsPath)) return [];
  return fs
    .readdirSync(channelsPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
}

async function syncEmbeds() {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channels = await guild.channels.fetch();

    const channelsToSync = CHANGED_CHANNELS.length > 0 ? CHANGED_CHANNELS : getAllChannelDirs();

    for (const channelName of channelsToSync) {
      const channel = channels.find(
        (ch) => ch.name === channelName && ch.isTextBased()
      );
      if (!channel) {
        console.log(`Channel ${channelName} not found, skipping.`);
        continue;
      }

      console.log(`Syncing channel: ${channelName}`);

      // Delete all messages
      let messages;
      do {
        messages = await channel.messages.fetch({ limit: 100 });
        if (messages.size > 0) {
          await channel.bulkDelete(messages);
        }
      } while (messages.size === 100);

      // Get JSON files
      const channelPath = path.join(__dirname, "..", "channels", channelName);
      if (!fs.existsSync(channelPath)) continue;

      const files = fs
        .readdirSync(channelPath)
        .filter((file) => file.endsWith(".json"))
        .sort(); // lexicographical order

      for (const file of files) {
        const filePath = path.join(channelPath, file);
        const embedData = JSON.parse(fs.readFileSync(filePath, "utf8"));

        const attachmentFiles = collectAttachments(embedData);
        const filesToAttach = attachmentFiles
          .map((file) => {
            const imagePath = path.join(channelPath, file);
            if (fs.existsSync(imagePath)) {
              return { attachment: imagePath, name: file };
            }
          })
          .filter(Boolean);

        await channel.send({ embeds: [embedData], files: filesToAttach });
      }
    }

    console.log("Sync complete");
    process.exit(0);
  } catch (error) {
    console.error("Error syncing embeds:", error);
    process.exit(1);
  }
}

client.once("clientReady", () => {
  console.log("Bot ready");
  syncEmbeds();
});

client.login(BOT_TOKEN);
