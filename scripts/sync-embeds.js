const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANGED_CHANNELS = process.env.CHANGED_CHANNELS
  ? process.env.CHANGED_CHANNELS.split(" ")
  : [];

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN environment variable is not set");
  process.exit(1);
}

if (!GUILD_ID) {
  console.error("GUILD_ID environment variable is not set");
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

    const channelsToSync =
      CHANGED_CHANNELS.length > 0 ? CHANGED_CHANNELS : getAllChannelDirs();

    for (const channelName of channelsToSync) {
      // Get JSON files
      const channelPath = path.join(__dirname, "..", "channels", channelName);
      if (!fs.existsSync(channelPath)) continue;

      const files = fs
        .readdirSync(channelPath)
        .filter((file) => file.endsWith(".json") || file.endsWith(".yaml"))
        .sort(); // lexicographical order

      if (files.length <= 0) {
        console.log(`Skipping channel: ${channelName}. No JSON files.`);
        continue;
      }

      const channel = channels.find(
        (ch) => ch.name === channelName && ch.isTextBased()
      );
      if (!channel) {
        console.log(`Channel ${channelName} not found, skipping.`);
        continue;
      }

      console.log(`Syncing channel: ${channelName}`);

      // Delete previous bot messages
      let messages;
      do {
        messages = await channel.messages.fetch({ limit: 100 });
        const botMessages = messages.filter(msg => msg.author.id === client.user.id);
        if (botMessages.size > 0) {
          const now = Date.now();
          const twoWeeks = 14 * 24 * 60 * 60 * 1000; // discord API limitation on bulkDelete.
          const eligible = botMessages.filter(msg => now - msg.createdTimestamp < twoWeeks);
          if (eligible.size > 0) {
            await channel.bulkDelete(eligible);
          }
          const ineligible = botMessages.filter(msg => now - msg.createdTimestamp >= twoWeeks);
          for (const msg of ineligible.values()) {
            await msg.delete();
          }
        }
      } while (messages.size === 100)

      for (const file of files) {
        const filePath = path.join(channelPath, file);
        let data;
        if (file.endsWith('.json')) {
          data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        } else if (file.endsWith('.yaml')) {
          data = yaml.load(fs.readFileSync(filePath, "utf8"));
        }

        let messages = [];
        if (Array.isArray(data)) {
          // Top-level array: each element is an embed message
          messages = data.map((embed) => ({ embeds: [embed] }));
        } else if (data.embeds) {
          // Top-level object with "embeds" property
          messages = [{ embeds: data.embeds }];
        } else {
          // Assume single embed object (backward compatibility)
          messages = [{ embeds: [data] }];
        }

        for (const message of messages) {
          const attachmentFiles = collectAttachments(message);
          const filesToAttach = attachmentFiles
            .map((file) => {
              const imagePath = path.join(channelPath, file);
              if (fs.existsSync(imagePath)) {
                return { attachment: imagePath, name: file };
              }
            })
            .filter(Boolean);

          await channel.send({ ...message, files: filesToAttach });
        }
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
