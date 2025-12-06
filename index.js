// Sleepy Bot Setup with slash + legacy message commands:
// Slash: /sleepy, /mysleepys, /randomsleepy, /awareness, /linkwallet, /sleepyid, /grid
// Legacy: !sleepy, !mysleepys, !randomsleepy, !awareness, !linkwallet, !sleepy<id>

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  Events,
  MessageFlags
} = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');
const { Pool } = require('pg');
const Jimp = require('jimp');

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

// ---- Postgres Setup ----
const pool = new Pool({
  connectionString: DATABASE_URL,
  // For local dev without SSL, set PGSSL_DISABLE=true
  ssl: process.env.PGSSL_DISABLE === 'true' ? false : { rejectUnauthorized: false }
});

async function ensureWalletTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wallet_links (
      user_id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function setWalletLink(userId, address) {
  await pool.query(
    `
      INSERT INTO wallet_links (user_id, address, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET address = EXCLUDED.address, updated_at = NOW();
    `,
    [userId, address]
  );
}

async function getWalletLink(userId) {
  // First try Postgres
  const res = await pool.query(
    `SELECT address FROM wallet_links WHERE user_id = $1`,
    [userId]
  );
  if (res.rows.length > 0) {
    return res.rows[0].address;
  }

  // Fallback to legacy JSON (if it exists) so old links still work
  if (walletLinks[userId]) {
    const address = walletLinks[userId];
    // Backfill into Postgres
    try {
      await setWalletLink(userId, address);
    } catch (err) {
      console.warn('Failed to backfill wallet link into Postgres:', err);
    }
    return address;
  }

  return null;
}

// ---- Constants ----

const SLEEPY_CONTRACT = '0x3CCBd9C381742c04D81332b5db461951672F6A99';
const IMAGE_BASE = 'https://ipfs.chlewigen.ch/ipfs/QmcMWvNKhSzFqbvyCdcaiuBgQLTSEmHXWjys2N1dBUAHFe';

const mecfsFacts = [
  "ME/CFS affects all races, genders, income levels, and ages. Recovery is rare — under 5%.",
  "ME/CFS is more common than multiple sclerosis, lupus, and many cancers.",
  "ME/CFS has no FDA-approved treatments and no cure.",
  "Physical or mental exertion can lead to a crash called post-exertional malaise (PEM) — now measurable in lab tests. // UPDATED",
  "Many people with ME/CFS are bedbound or housebound for months or years.",
  "ME/CFS can follow viral infections, including Epstein-Barr, SARS, and COVID-19.",
  "25% of ME/CFS patients are severely ill and may need feeding tubes, full-time care, or dark rooms.",
  "Genetic research in 2025 identified immune and nervous system pathways linked to ME/CFS. // UPDATED",
  "ME/CFS disrupts energy production at a cellular level and alters immune function.",
  "People with ME/CFS often sleep long hours yet wake unrefreshed.",
  "Memory issues and difficulty concentrating ('brain fog') are common in ME/CFS.",
  "CDC estimates ~1.3% of U.S. adults (3.3M people) have ME/CFS — most undiagnosed. // UPDATED",
  "Many doctors are still unaware of how to diagnose or manage ME/CFS.",
  "ME/CFS can make basic tasks like showering or cooking exhausting.",
  "There is no single test — diagnosis is based on symptoms and exclusion.",
  "ME/CFS can worsen over time, sometimes rapidly.",
  "ME/CFS remains one of the most underfunded diseases relative to its burden.",
  "Research funding per patient is lower than for almost any other major illness.",
  "ME/CFS often overlaps with fibromyalgia, POTS, IBS, and mast cell disorders.",
  "Light, sound, touch, chemical, and food sensitivities are common in ME/CFS.",
  "Some patients spend years or decades seeking a diagnosis.",
  "Suicide risk is elevated due to isolation, severe symptoms, and disbelief.",
  "ME/CFS is not 'just tiredness' — it is a complex multi-system disease.",
  "Children and teens can get ME/CFS, often missing school or misdiagnosed.",
  "Research is growing, but ME/CFS is still severely under-resourced.",
  "Awareness and understanding are key to improving lives for people with ME/CFS.",
  "Many patients find community and hope through online support networks.",
  "Symptoms can fluctuate daily or hourly.",
  "Many with ME/CFS were previously healthy and active.",
  "There is no official biomarker — diagnosis is clinical.",
  "Energy metabolism dysfunction remains a leading theory.",
  "Cognitive impairment ('brain fog') can impair daily functioning.",
  "ME/CFS can be triggered by infections, surgery, or physical trauma.",
  "Long COVID has renewed scientific attention to ME/CFS.",
  "Some patients report worsening after vaccinations or infections.",
  "Temperature regulation is often impaired.",
  "Even minor stress can trigger symptom flares.",
  "Heart rate and blood pressure abnormalities are common.",
  "Digestive issues like IBS affect many patients.",
  "ME/CFS affects more women, but all genders are impacted.",
  "Hormonal changes can worsen symptoms.",
  "Research funding is still less than $10 per patient per year.",
  "Average time to diagnosis is over 5 years.",
  "Social stigma stops many from getting help.",
  "Family and caregiver support is vital.",
  "Patients are often misdiagnosed with depression or anxiety.",
  "Rest does not restore energy — this is not normal fatigue.",
  "Sensory overload is common in public spaces.",
  "Speech and verbal processing can be impaired during crashes.",
  "Some patients cannot speak, move, or tolerate light for years.",
  "Overexertion can cause crashes lasting days to months.",
  "Patients often track activity with heart rate monitors.",
  "Graded exercise therapy is no longer recommended by NICE due to harm. // UPDATED",
  "People with ME/CFS are not lazy — they are surviving daily battles.",
  "Sleep studies show disrupted deep and REM sleep.",
  "No two patients have the exact same symptom set.",
  "Many must give up careers they loved.",
  "Medical gaslighting is a common trauma.",
  "Relapses can follow infections, stress, or overexertion.",
  "Homebound and bedbound patients are often invisible in statistics.",
  "The most severe cases are among medicine’s most neglected.",
  "Promising diagnostic tests are in development but not yet approved.",
  "The IOM renamed ME/CFS as SEID (Systemic Exertion Intolerance Disease) in 2015.",
  "Support groups are vital for mental health.",
  "Many patients lose friends and social ties due to isolation.",
  "Disability benefits are hard to obtain due to misunderstanding.",
  "Some patients experience changes in vision, voice, or movement.",
  "Patient advocacy is growing, fueled by research and long COVID overlap.",
  "Sharing ME/CFS facts helps fight stigma.",
  "Awareness campaigns are increasing worldwide.",
  "Many live in poverty due to job loss and medical costs.",
  "ME/CFS is rarely taught in medical schools.",
  "The U.S. economic cost is estimated at $18–$51 billion annually. // UPDATED",
  "ME/CFS has been reported for over a century under different names.",
  "Digital tools like pacing apps help symptom management.",
  "ME/CFS is real, physical, and devastating — but often misunderstood.",
  "You can help by listening, believing, and supporting those affected."
];

// ---- Client Setup ----

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Legacy JSON walletLinks as fallback
let walletLinks = {};
if (fs.existsSync('walletLinks.json')) {
  walletLinks = JSON.parse(fs.readFileSync('walletLinks.json'));
}

// ---- Helpers ----

function buildSleepyMessage(tokenId, includeFact = false) {
  const imgUrl = `${IMAGE_BASE}/${tokenId}.jpg`;
  const randomFact = mecfsFacts[Math.floor(Math.random() * mecfsFacts.length)];
  const text = `Token ID: ${tokenId}` + (includeFact ? `\n\n💡 **ME/CFS Fact:** ${randomFact}` : '');
  return { text, imgUrl };
}

// bump offset so we can handle wallets with lots of Sleepys
async function fetchOwnedTokens(wallet) {
  const url = `https://api.etherscan.io/v2/api?module=account&action=tokennfttx&address=${wallet}&contractaddress=${SLEEPY_CONTRACT}&page=1&offset=1000&sort=asc&chainid=1&apikey=${ETHERSCAN_API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  const owned = new Set();
  const walletLower = wallet.toLowerCase();

  // Handle error / NOTOK responses from Etherscan V2
  if (!data || data.status !== '1' || !Array.isArray(data.result)) {
    console.warn('Unexpected Etherscan response for fetchOwnedTokens:', data);
    return [];
  }

  for (const tx of data.result) {
    // Some tx entries may be malformed / missing fields – skip safely
    if (!tx || !tx.tokenID) continue;

    const to = tx.to ? tx.to.toLowerCase() : null;
    const from = tx.from ? tx.from.toLowerCase() : null;

    if (to === walletLower) {
      owned.add(tx.tokenID);
    } else if (from === walletLower) {
      owned.delete(tx.tokenID);
    }
  }

  return Array.from(owned);
}

// Create a grid PNG from an array of tokenIds (as strings)
async function createSleepyGrid(tokenIds) {
  if (tokenIds.length === 0) {
    throw new Error('No token IDs provided for grid');
  }

  const maxTokens = 300;
  const limited = tokenIds.slice(0, maxTokens);

  const count = limited.length;
  const cellSize = 200; // px per Sleepy
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);

  const width = cols * cellSize;
  const height = rows * cellSize;

  const grid = new Jimp(width, height, 0x000000ff); // black background

  let index = 0;
  for (const tokenId of limited) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = col * cellSize;
    const y = row * cellSize;

    const imgUrl = `${IMAGE_BASE}/${tokenId}.jpg`;

    try {
      const img = await Jimp.read(imgUrl);
      img.cover(cellSize, cellSize); // fill cell, keep aspect
      grid.composite(img, x, y);
    } catch (err) {
      console.warn(`Failed to load Sleepy #${tokenId} for grid:`, err);
      // Leave that cell black if it fails
    }

    index++;
  }

  const buffer = await grid.getBufferAsync(Jimp.MIME_PNG);
  return buffer;
}

// ---- Slash Command Definitions ----

const GUILD_ID = '943847323690217482';

const commandsBuilders = [
  new SlashCommandBuilder()
    .setName('linkwallet')
    .setDescription('Link your Ethereum wallet for Always Tired.')
    .addStringOption(option =>
      option
        .setName('address')
        .setDescription('Your Ethereum wallet address (0x...)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('sleepy')
    .setDescription('Show a random Always Tired NFT you own.'),

  new SlashCommandBuilder()
    .setName('mysleepys')
    .setDescription('Show up to 10 Always Tired NFTs you own.'),

  new SlashCommandBuilder()
    .setName('randomsleepy')
    .setDescription('Show a completely random Always Tired NFT.'),

  new SlashCommandBuilder()
    .setName('awareness')
    .setDescription('Share a random Always Tired NFT with an ME/CFS fact.'),

  new SlashCommandBuilder()
    .setName('sleepyid')
    .setDescription('Show a specific Always Tired NFT by token ID.')
    .addIntegerOption(option =>
      option
        .setName('tokenid')
        .setDescription('Token ID (e.g. 142)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('grid')
    .setDescription('Generate a grid image of all your Always Tired NFTs (up to 300).')
];

const commands = commandsBuilders.map(cmd => cmd.toJSON());

// ---- Ready & Command Registration ----

client.once(Events.ClientReady, async (c) => {
  console.log(`😴 Sleepy Bot logged in as ${c.user.tag}`);

  try {
    await ensureWalletTable();
    console.log('✅ wallet_links table ready.');
  } catch (err) {
    console.error('❌ Error ensuring wallet_links table:', err);
  }

  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(c.user.id, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registered for guild:', GUILD_ID);
  } catch (err) {
    console.error('❌ Error registering slash commands:', err);
  }
});

// ---- Slash Command Handling ----

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'linkwallet') {
    const address = interaction.options.getString('address', true).trim();

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return interaction.reply({
        content: '❌ Please enter a valid Ethereum wallet address.',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      await setWalletLink(interaction.user.id, address);
      return interaction.reply({
        content: '✅ Wallet linked.',
        flags: MessageFlags.Ephemeral
      });
    } catch (err) {
      console.error('Error saving wallet link:', err);
      return interaction.reply({
        content: '⚠️ Error saving your wallet link. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  if (commandName === 'sleepy') {
    try {
      const wallet = await getWalletLink(interaction.user.id);
      if (!wallet) {
        return interaction.reply({
          content: '❌ Please link your wallet first using `/linkwallet 0x...`',
          flags: MessageFlags.Ephemeral
        });
      }

      const owned = await fetchOwnedTokens(wallet);
      if (owned.length === 0) {
        return interaction.reply({
          content: '😢 You don’t own any Always Tired NFTs.',
          flags: MessageFlags.Ephemeral
        });
      }

      const randomToken = owned[Math.floor(Math.random() * owned.length)];
      const { text, imgUrl } = buildSleepyMessage(randomToken);

      try {
        await interaction.reply({
          content: text,
          files: [{ attachment: imgUrl, name: `sleepy-${randomToken}.jpg` }]
        });
      } catch (err) {
        console.warn(`⚠️ Could not send image for Sleepy #${randomToken}.`, err);
        await interaction.reply({ content: text });
      }
    } catch (err) {
      console.error(err);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: '⚠️ Error fetching your Sleepys. Please try again later.',
          flags: MessageFlags.Ephemeral
        });
      }
    }
  }

  if (commandName === 'mysleepys') {
    try {
      const wallet = await getWalletLink(interaction.user.id);
      if (!wallet) {
        return interaction.reply({
          content: '❌ Please link your wallet first using `/linkwallet 0x...`',
          flags: MessageFlags.Ephemeral
        });
      }

      const owned = await fetchOwnedTokens(wallet);
      if (owned.length === 0) {
        return interaction.reply({
          content: '😢 You don’t currently own any Always Tired NFTs.',
          flags: MessageFlags.Ephemeral
        });
      }

      const limitedTokens = owned.slice(0, 10);
      const files = limitedTokens.map((tokenId) => ({
        attachment: `${IMAGE_BASE}/${tokenId}.jpg`,
        name: `sleepy-${tokenId}.jpg`
      }));

      const listedIds = limitedTokens.map(id => `Token ID: ${id}`).join('\n');

      try {
        await interaction.reply({ content: listedIds, files });
      } catch (err) {
        console.warn('⚠️ Could not send one or more images for mysleepys.', err);
        await interaction.reply({ content: listedIds });
      }
    } catch (err) {
      console.error(err);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: '⚠️ Error fetching your Sleepys. Please try again later.',
          flags: MessageFlags.Ephemeral
        });
      }
    }
  }

  if (commandName === 'randomsleepy') {
    const tokenId = Math.floor(Math.random() * 4000) + 1;
    const { text, imgUrl } = buildSleepyMessage(tokenId);

    try {
      await interaction.reply({
        content: text,
        files: [{ attachment: imgUrl, name: `sleepy-${tokenId}.jpg` }]
      });
    } catch (err) {
      console.warn(`⚠️ Could not send image for random Sleepy #${tokenId}.`, err);
      await interaction.reply({ content: text });
    }
  }

  if (commandName === 'awareness') {
    const tokenId = Math.floor(Math.random() * 4000) + 1;
    const { text, imgUrl } = buildSleepyMessage(tokenId, true);

    try {
      await interaction.reply({
        content: text,
        files: [{ attachment: imgUrl, name: `sleepy-${tokenId}.jpg` }]
      });
    } catch (err) {
      console.warn(`⚠️ Could not send image for awareness Sleepy #${tokenId}.`, err);
      await interaction.reply({ content: text });
    }
  }

  if (commandName === 'sleepyid') {
    const tokenId = interaction.options.getInteger('tokenid', true);
    if (tokenId <= 0) {
      return interaction.reply({
        content: '❌ Please enter a valid token number greater than 0.',
        flags: MessageFlags.Ephemeral
      });
    }

    const { text, imgUrl } = buildSleepyMessage(tokenId);

    try {
      await interaction.reply({
        content: text,
        files: [{ attachment: imgUrl, name: `sleepy-${tokenId}.jpg` }]
      });
    } catch (err) {
      console.warn(`⚠️ Could not send image for Sleepy #${tokenId}.`, err);
      await interaction.reply({ content: text });
    }
  }

  if (commandName === 'grid') {
    await interaction.deferReply(); // not ephemeral – this is something they'll want to share

    try {
      const wallet = await getWalletLink(interaction.user.id);
      if (!wallet) {
        return interaction.editReply('❌ Please link your wallet first using `/linkwallet 0x...`');
      }

      const owned = await fetchOwnedTokens(wallet);
      if (owned.length === 0) {
        return interaction.editReply('😢 You don’t own any Always Tired NFTs.');
      }

      const gridBuffer = await createSleepyGrid(owned);
      await interaction.editReply({
        content: `🧱 Always Tired grid for <@${interaction.user.id}> (showing up to 300 Sleepys).`,
        files: [{ attachment: gridBuffer, name: 'always-tired-grid.png' }]
      });
    } catch (err) {
      console.error('Error creating Sleepy grid:', err);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: '⚠️ Error creating your grid. Please try again later.',
          flags: MessageFlags.Ephemeral
        });
      } else {
        return interaction.editReply('⚠️ Error creating your grid. Please try again later.');
      }
    }
  }
});

// ---- Legacy Message Command Handling (Option C) ----

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('!') || message.author.bot) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // !linkwallet
  if (command === 'linkwallet') {
    const address = args[0];
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return message.reply('❌ Please enter a valid Ethereum wallet address.');
    }

    try {
      await setWalletLink(message.author.id, address);
    } catch (err) {
      console.error('Error saving wallet link (legacy !linkwallet):', err);
      return message.reply('⚠️ Error saving your wallet link. Please try again later.');
    }

    // Try to delete the message if we have perms
    if (
      message.guild &&
      message.guild.members.me.permissionsIn(message.channel).has(PermissionsBitField.Flags.ManageMessages)
    ) {
      try {
        await message.delete();
      } catch (err) {
        console.warn('Could not delete message:', err);
      }
    }

    return message.channel.send('✅ Wallet linked.');
  }

  const handleSleepyToken = async (tokenId, includeFact = false) => {
    const { text, imgUrl } = buildSleepyMessage(tokenId, includeFact);

    try {
      return message.reply({
        content: text,
        files: [{ attachment: imgUrl, name: `sleepy-${tokenId}.jpg` }]
      });
    } catch (err) {
      console.warn(`⚠️ Could not send image for Sleepy #${tokenId}.`, err);
      return message.reply({ content: text });
    }
  };

  // !sleepy
  if (command === 'sleepy') {
    try {
      const wallet = await getWalletLink(message.author.id);
      if (!wallet) return message.reply('❌ Please link your wallet first using `!linkwallet 0x...` or `/linkwallet 0x...`');

      const owned = await fetchOwnedTokens(wallet);
      if (owned.length === 0) return message.reply('😢 You don’t own any Always Tired NFTs.');

      const randomToken = owned[Math.floor(Math.random() * owned.length)];
      return handleSleepyToken(randomToken);
    } catch (err) {
      console.error(err);
      return message.reply('⚠️ Error fetching your Sleepys. Please try again later.');
    }
  }

  // !mysleepys
  if (command === 'mysleepys') {
    try {
      const wallet = await getWalletLink(message.author.id);
      if (!wallet) return message.reply('❌ Please link your wallet first using `!linkwallet 0x...` or `/linkwallet 0x...`');

      const owned = await fetchOwnedTokens(wallet);
      if (owned.length === 0) return message.reply('😢 You don’t currently own any Always Tired NFTs.');

      const limitedTokens = owned.slice(0, 10);
      const files = limitedTokens.map((tokenId) => ({
        attachment: `${IMAGE_BASE}/${tokenId}.jpg`,
        name: `sleepy-${tokenId}.jpg`
      }));

      const listedIds = limitedTokens.map(id => `Token ID: ${id}`).join('\n');
      try {
        return message.reply({ content: listedIds, files });
      } catch (err) {
        console.warn('⚠️ Could not send one or more images for mysleepys.', err);
        return message.reply({ content: listedIds });
      }
    } catch (err) {
      console.error(err);
      return message.reply('⚠️ Error fetching your Sleepys. Please try again later.');
    }
  }

  // !randomsleepy
  if (command === 'randomsleepy') {
    const tokenId = Math.floor(Math.random() * 4000) + 1;
    return handleSleepyToken(tokenId);
  }

  // !awareness (kept as requested)
  if (command === 'awareness') {
    const tokenId = Math.floor(Math.random() * 4000) + 1;
    return handleSleepyToken(tokenId, true);
  }

  // !sleepy<number> (e.g., !sleepy142)
  if (command.startsWith('sleepy') && command !== 'sleepy' && command !== 'mysleepys') {
    const tokenId = command.replace('sleepy', '');
    if (!/^\d+$/.test(tokenId)) {
      return message.reply('❌ Please enter a valid token number after `!sleepy` (e.g. `!sleepy142`)');
    }
    return handleSleepyToken(tokenId);
  }
});

// ---- Login ----

client.login(DISCORD_TOKEN);
