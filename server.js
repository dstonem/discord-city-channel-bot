const express = require("express");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
// require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static("public"));

// Discord client setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Your existing STATE_CONFIG (load from state-config.js if you created it)
const STATE_CONFIG = require("./state-config"); // or paste your config here

// Additional role configuration
const SPECIAL_ROLES = {
  LOCAL_LEADER: process.env.LOCAL_LEADER_ROLE_ID,
};

const SPECIAL_CHANNELS = {
  LOCAL_LEADER_KNOWLEDGE_SHARE: process.env.LOCAL_LEADER_CHANNEL_ID,
  RESOURCES: process.env.RESOURCES_CHANNEL_ID,
};

// Enhanced onboarding completion function
async function handleOnboardingCompletion(member, onboardingData) {
  try {
    const guild = member.guild;
    const { state, city, interest } = onboardingData;

    console.log(
      `Processing onboarding for ${member.user.tag}: ${city}, ${state} - Interest: ${interest}`
    );

    // Get state configuration
    const stateConfig = STATE_CONFIG[state];
    if (!stateConfig) {
      throw new Error(`No configuration found for state: ${state}`);
    }

    // 1. Add state role
    const stateRole = guild.roles.cache.get(stateConfig.roleId);
    if (stateRole) {
      await member.roles.add(stateRole);
    }

    // 2. Give access to state channel
    const stateChannel = guild.channels.cache.get(stateConfig.stateChannelId);
    if (stateChannel) {
      await stateChannel.permissionOverwrites.edit(member.id, {
        [PermissionFlagsBits.ViewChannel]: true,
        [PermissionFlagsBits.SendMessages]: true,
        [PermissionFlagsBits.ReadMessageHistory]: true,
      });
    }

    // 3. Create or access city channel
    const cityChannelName = city
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
    const stateCategory = guild.channels.cache.get(stateConfig.categoryId);

    let cityChannel = stateCategory.children.cache.find(
      (channel) =>
        channel.name === cityChannelName &&
        channel.type === ChannelType.GuildText
    );

    if (!cityChannel) {
      cityChannel = await guild.channels.create({
        name: cityChannelName,
        type: ChannelType.GuildText,
        parent: stateCategory.id,
        topic: `Chat for residents of ${city}, ${state}`,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: stateConfig.roleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
      });
    }

    // 4. Give access to city channel
    await cityChannel.permissionOverwrites.edit(member.id, {
      [PermissionFlagsBits.ViewChannel]: true,
      [PermissionFlagsBits.SendMessages]: true,
      [PermissionFlagsBits.ReadMessageHistory]: true,
    });

    // 5. Handle interest-specific logic
    if (interest === "leading") {
      // Add local leader role
      const localLeaderRole = guild.roles.cache.get(SPECIAL_ROLES.LOCAL_LEADER);
      if (localLeaderRole) {
        await member.roles.add(localLeaderRole);
      }

      // Give access to local leader knowledge share
      const leaderChannel = guild.channels.cache.get(
        SPECIAL_CHANNELS.LOCAL_LEADER_KNOWLEDGE_SHARE
      );
      if (leaderChannel) {
        await leaderChannel.permissionOverwrites.edit(member.id, {
          [PermissionFlagsBits.ViewChannel]: true,
          [PermissionFlagsBits.SendMessages]: true,
          [PermissionFlagsBits.ReadMessageHistory]: true,
        });

        // Send leader welcome message
        await leaderChannel.send(
          `🎉 Welcome ${member}! You're now a local leader for ${city}, ${state}!`
        );
      }

      // Send message to city channel about leadership
      await cityChannel.send(
        `🌟 **${member.displayName}** is leading pop-ups in ${city}! The members in this channel are listed as either volunteers or attendees. Check <#${SPECIAL_CHANNELS.RESOURCES}> and <#${SPECIAL_CHANNELS.LOCAL_LEADER_KNOWLEDGE_SHARE}> for everything you need to get started in your community! 🚀`
      );
    } else if (interest === "volunteering") {
      // Send encouragement to volunteer in city channel
      await cityChannel.send(
        `👋 **${member.displayName}** just joined and wants to volunteer for local pop-ups! If you're organizing events in ${city}, reach out! 🙌`
      );
    } else if (interest === "attending") {
      // Send welcome message for attendees
      await cityChannel.send(
        `🎉 Welcome **${member.displayName}** to ${city}! Keep an eye on this channel for local pop-up announcements! 📅`
      );
    }

    console.log(`✅ Successfully processed onboarding for ${member.user.tag}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Error in handleOnboardingCompletion: ${error}`);
    throw error;
  }
}

// API endpoint for onboarding
app.post("/api/onboarding", async (req, res) => {
  try {
    const { userId, city, state, interest } = req.body;
    console.log("here", userId, city, state, interest);

    if (!userId || !city || !state || !interest) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log("there");

    // Get guild and member
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
      return res.status(500).json({ error: "Guild not found" });
    }

    console.log("where");

    const member = await guild.members.fetch(userId);
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    console.log("huh");

    // Process onboarding
    await handleOnboardingCompletion(member, { city, state, interest });

    console.log("oh");

    res.json({ success: true, message: "Onboarding completed successfully" });
  } catch (error) {
    console.error("Onboarding API error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Serve onboarding form
app.get("/onboard/:userId", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "onboarding.html"));
});

// Discord bot events
client.on("guildMemberAdd", async (member) => {
  try {
    // Send welcome DM with onboarding link
    const onboardingUrl = `${
      process.env.BASE_URL || "http://localhost:3000"
    }/discord/onboarding/${member.id}?user=${member.id}`;

    await member.send(
      `🏡 **Welcome to ${member.guild.name}!**\n\n🌟 **Get started by completing your community onboarding:**\n${onboardingUrl}\n\nThis will connect you with your local community and give you access to city-specific channels! 🎉`
    );
  } catch (error) {
    console.error("Error sending welcome DM:", error);

    // Fallback: send in welcome channel if DM fails
    const welcomeChannel = member.guild.channels.cache.find(
      (ch) => ch.name === "welcome" || ch.name === "general"
    );
    if (welcomeChannel) {
      welcomeChannel.send(
        `${member}, welcome! Please check your DMs for your onboarding link, or use this one: ${
          process.env.BASE_URL || "http://localhost:3000"
        }/onboard/${member.id}?user=${member.id}`
      );
    }
  }
});

client.on("ready", () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
  console.log(`🌐 Onboarding server running on port ${PORT}`);
});

// Start server
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// Login bot
setTimeout(() => {
  console.log("🤖 Attempting to login...");
  client.login(process.env.DISCORD_TOKEN);
}, 1000);
