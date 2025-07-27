const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // Required for basic bot functionality
    GatewayIntentBits.GuildMessages, // Required to read messages/commands
    GatewayIntentBits.MessageContent, // Required to read message content (privileged)
  ],
});

// All 50 US states
const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

// Function to sanitize names for Discord
function sanitizeDiscordName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Function to create state infrastructure
async function createStateInfrastructure(guild) {
  const createdStates = {};
  const batchSize = 5; // Create 5 states at a time to avoid rate limits

  console.log("🚀 Starting creation of 50 state infrastructures...");

  for (let i = 0; i < US_STATES.length; i += batchSize) {
    const batch = US_STATES.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (stateName) => {
        try {
          const sanitizedName = sanitizeDiscordName(stateName);

          console.log(`Creating infrastructure for ${stateName}...`);

          // 1. Create Role
          const role = await guild.roles.create({
            name: `${stateName} Resident`,
            color: Math.floor(Math.random() * 0xffffff), // Random color
            reason: `Auto-created role for ${stateName} residents`,
          });

          // 2. Create Category
          const category = await guild.channels.create({
            name: `📍 ${stateName.toUpperCase()}`,
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel],
              },
              {
                id: role.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                ],
              },
            ],
          });

          // 3. Create State General Channel
          const stateChannel = await guild.channels.create({
            name: `${sanitizedName}-general`,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: `General discussion for ${stateName} residents`,
            permissionOverwrites: [
              {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel],
              },
              {
                id: role.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.UseExternalEmojis,
                  PermissionFlagsBits.AddReactions,
                ],
              },
            ],
          });

          // Store the created infrastructure
          createdStates[sanitizedName] = {
            stateName: stateName,
            categoryId: category.id,
            stateChannelId: stateChannel.id,
            roleId: role.id,
          };

          console.log(
            `✅ Created ${stateName}: Category ${category.id}, Channel ${stateChannel.id}, Role ${role.id}`
          );

          // Send welcome message to the channel
          await stateChannel.send({
            content: `🏛️ **Welcome to ${stateName}!**\n\nThis is the general chat for all ${stateName} residents. City-specific channels will be created automatically when residents join!\n\n*Use \`/setlocation ${sanitizedName} <your-city>\` to get access to your city's channel.*`,
          });
        } catch (error) {
          console.error(
            `❌ Error creating infrastructure for ${stateName}:`,
            error
          );
        }
      })
    );

    // Rate limit protection - wait between batches
    if (i + batchSize < US_STATES.length) {
      console.log(`⏳ Waiting 2 seconds before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return createdStates;
}

// Function to generate the STATE_CONFIG code
function generateStateConfig(createdStates) {
  console.log("\n📋 Generated STATE_CONFIG for your bot:");
  console.log("```javascript");
  console.log("const STATE_CONFIG = {");

  Object.entries(createdStates).forEach(([key, config]) => {
    console.log(`    '${key}': {`);
    console.log(`        categoryId: '${config.categoryId}',`);
    console.log(`        stateChannelId: '${config.stateChannelId}',`);
    console.log(`        roleId: '${config.roleId}'`);
    console.log(`    },`);
  });

  console.log("};");
  console.log("```");

  // Also save to file
  const fs = require("fs");
  const configContent = `// Auto-generated STATE_CONFIG\nconst STATE_CONFIG = {\n${Object.entries(
    createdStates
  )
    .map(
      ([key, config]) =>
        `    '${key}': {\n        categoryId: '${config.categoryId}',\n        stateChannelId: '${config.stateChannelId}',\n        roleId: '${config.roleId}'\n    }`
    )
    .join(",\n")}\n};\n\nmodule.exports = STATE_CONFIG;`;

  fs.writeFileSync("state-config.js", configContent);
  console.log("\n💾 Configuration saved to state-config.js");
}

// Command to create all state infrastructure
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Admin command to create all states
  if (message.content === "!createallstates") {
    // Check if user has administrator permissions
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply(
        "❌ You need Administrator permissions to use this command."
      );
    }

    await message.reply(
      "🚀 Starting creation of all 50 state infrastructures... This will take a few minutes."
    );

    try {
      const createdStates = await createStateInfrastructure(message.guild);

      await message.reply(
        `✅ Successfully created infrastructure for all ${
          Object.keys(createdStates).length
        } states!`
      );

      // Generate and display the config
      generateStateConfig(createdStates);
    } catch (error) {
      console.error("Error creating state infrastructure:", error);
      await message.reply(
        "❌ There was an error creating the state infrastructure. Check the console for details."
      );
    }
  }

  // Command to clean up (delete all created states) - USE WITH CAUTION
  if (message.content === "!deleteallstates") {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply(
        "❌ You need Administrator permissions to use this command."
      );
    }

    await message.reply(
      "⚠️ **WARNING**: This will delete ALL state categories, channels, and roles. Type `!confirmdelete` within 30 seconds to proceed."
    );

    const filter = (m) =>
      m.author.id === message.author.id && m.content === "!confirmdelete";
    const collector = message.channel.createMessageCollector({
      filter,
      time: 30000,
      max: 1,
    });

    collector.on("collect", async () => {
      await message.reply("🗑️ Deleting all state infrastructure...");

      try {
        const guild = message.guild;

        // Delete all categories that start with "📍"
        const stateCategories = guild.channels.cache.filter(
          (channel) =>
            channel.type === ChannelType.GuildCategory &&
            channel.name.startsWith("📍")
        );

        for (const category of stateCategories.values()) {
          // Delete all channels in the category first
          const childChannels = category.children.cache;
          for (const child of childChannels.values()) {
            await child.delete();
          }
          // Delete the category
          await category.delete();
        }

        // Delete all roles that end with "Resident"
        const stateRoles = guild.roles.cache.filter(
          (role) => role.name.endsWith("Resident") && role.name !== "@everyone"
        );

        for (const role of stateRoles.values()) {
          await role.delete();
        }

        await message.reply("✅ All state infrastructure has been deleted.");
      } catch (error) {
        console.error("Error deleting state infrastructure:", error);
        await message.reply(
          "❌ There was an error deleting the infrastructure."
        );
      }
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        message.reply("⏱️ Deletion cancelled - no confirmation received.");
      }
    });
  }
});

// Ready event
client.on("ready", () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
  console.log("📋 Available commands:");
  console.log(
    "  !createallstates - Creates infrastructure for all 50 US states"
  );
  console.log(
    "  !deleteallstates - Deletes all created state infrastructure (admin only)"
  );
});

client.login(process.env.DISCORD_TOKEN);
