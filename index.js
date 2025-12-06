// Sleepy Bot Setup with slash + legacy message commands:
// Slash: /sleepy, /mysleepys, /randomsleepy, /awareness, /linkwallet, /sleepyid
// Legacy: !sleepy, !mysleepys, !randomsleepy, !awareness, !linkwallet, !sleepy<id>

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  Events
} = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');
const { Pool } = require('pg');

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
  "ME/CFS affects people of all ages, races, genders, and income levels worldwide.",
  "CDC estimates that up to 3.3 million adults in the United States—about 1.3%—have ME/CFS, and most are still undiagnosed.",
  "Global estimates suggest tens of millions of people live with ME/CFS.",
  "Full recovery in adults is rare—recent reviews suggest only around 5% fully recover, and probably no more than 10%.",
  "ME/CFS often begins after an infection, such as Epstein–Barr virus, influenza, SARS, or COVID-19.",
  "Long COVID has shone a spotlight on ME/CFS—multiple studies find a significant proportion of long-COVID patients meet ME/CFS criteria.",
  "ME/CFS is more common than multiple sclerosis, lupus, and many cancers, yet far less recognized.",
  "Women are diagnosed with ME/CFS more often than men, but all genders are affected.",
  "Children and teens can develop ME/CFS and may miss months or years of school because of it.",
  "Core ME/CFS symptoms include disabling fatigue, post-exertional malaise (PEM), unrefreshing sleep, and cognitive problems.",
  "Post-exertional malaise (PEM) is a delayed worsening of symptoms after even minor physical, mental, or emotional effort.",
  "PEM can last days, weeks, or longer, and can be triggered by activities as basic as showering or talking.",
  "Two-day cardiopulmonary exercise tests (CPET) show objective drops in function on day two, providing measurable evidence of PEM.",
  "ME/CFS is a complex multi-system disease affecting the immune, nervous, endocrine, and cardiovascular systems.",
  "Research suggests ME/CFS disrupts cellular energy production and mitochondrial function.",
  "Immune abnormalities, including altered cytokines and immune cell function, are repeatedly reported in ME/CFS studies.",
  "Orthostatic intolerance—symptoms that worsen when upright, such as dizziness or rapid heart rate—is common in ME/CFS.",
  "Heart rate and blood pressure abnormalities, including POTS, frequently co-occur with ME/CFS.",
  "ME/CFS often overlaps with fibromyalgia, POTS, irritable bowel syndrome, mast cell disorders, and Ehlers–Danlos syndrome.",
  "Many people with ME/CFS experience chronic pain, including muscle pain, joint pain, and headaches.",
  "Cognitive problems—often called “brain fog”—include difficulty thinking, remembering, finding words, or processing information.",
  "People with ME/CFS can sleep long hours yet wake unrefreshed and feeling flu-like or poisoned.",
  "Light, sound, touch, temperature, chemical, and food sensitivities are common and can be disabling.",
  "Temperature regulation is often impaired—patients may feel unusually hot, cold, or fluctuate rapidly.",
  "Many with ME/CFS were previously healthy, active, and working or studying full-time before becoming ill.",
  "ME/CFS can strike suddenly after a single illness or more gradually over weeks or months.",
  "ME/CFS ranges from mild to very severe: some people can work part-time; others are housebound or bedbound for years.",
  "Around a quarter of people with ME/CFS are severely or very severely ill at some point, needing dark rooms, mobility aids, or even feeding tubes.",
  "Some patients cannot speak, move, or tolerate noise or light for long periods of time.",
  "ME/CFS symptoms can fluctuate from day to day or hour to hour, making planning life extremely difficult.",
  "ME/CFS is not “just tiredness” — it is profound, disabling exhaustion plus many other symptoms.",
  "Rest does not restore energy in ME/CFS the way it does in normal fatigue.",
  "Even small increases in activity, stress, or sensory input can trigger a crash in ME/CFS.",
  "Overexertion can cause severe crashes lasting days, weeks, or months.",
  "Many patients use heart-rate or activity monitors to help pace and avoid triggering PEM.",
  "NICE’s 2021 guideline recognizes PEM as a key symptom and warns against pushing through symptoms.",
  "Graded exercise therapy (GET) is no longer recommended by NICE because evidence shows it can cause harm in ME/CFS.",
  "Cognitive behavioural therapy (CBT) may help some people cope, but it is not a cure for ME/CFS.",
  "There are still no FDA- or EMA-approved disease-modifying treatments and no cure for ME/CFS.",
  "Treatment focuses on symptom management, pacing, and adapting life to an extremely limited energy envelope.",
  "ME/CFS diagnosis is clinical—there is currently no single definitive biomarker in routine use.",
  "Diagnostic criteria from the National Academy of Medicine (IOM) and NICE require fatigue, PEM, unrefreshing sleep, and cognitive issues or orthostatic intolerance.",
  "Suspected ME/CFS should be investigated to rule out other conditions, but negative tests do not mean the illness is “all in the mind.”",
  "Many people wait years for a diagnosis; studies show average delays of five years or more, and some registries report averages near 10–15 years.",
  "ME/CFS is frequently misdiagnosed as depression, anxiety, or stress‐related burnout.",
  "Suicide risk is elevated in ME/CFS, driven by severe symptoms, isolation, and medical disbelief—not by “just being sad.”",
  "ME/CFS has been documented for more than a century under various names, including “post-viral fatigue syndrome.”",
  "In 2015, the Institute of Medicine proposed the name Systemic Exertion Intolerance Disease (SEID), but ME/CFS remains the most used term.",
  "DecodeME, a 2025 genome-wide association study, identified eight genetic regions linked to ME/CFS, many involving immune and nervous system pathways.",
  "These genetic findings provide strong evidence that ME/CFS is a biological disease, not a psychological weakness.",
  "Some of the ME/CFS-linked genes are involved in infection response, pain pathways, and mitochondrial function.",
  "Experimental blood tests using epigenetic and immune markers are showing promise, but they are not yet validated for routine diagnosis.",
  "ME/CFS is one of the most underfunded diseases relative to its burden, receiving a fraction of the research funding seen in comparable illnesses.",
  "Analyses of NIH funding suggest ME/CFS would need an increase of more than ten-fold to match its disease burden.",
  "CDC estimates the economic cost of ME/CFS in the U.S. alone at roughly $18–$51 billion each year in medical expenses and lost income.",
  "Some newer models argue the true economic burden may be far higher once long COVID–related ME/CFS is included.",
  "Many people with ME/CFS lose jobs, careers, or education and may fall into poverty because of lost income and high medical costs.",
  "Disability benefits are often hard to obtain for ME/CFS because of outdated criteria and ongoing stigma.",
  "Homebound and bedbound patients are largely invisible in official statistics and research studies.",
  "ME/CFS is rarely taught in medical school, leaving many clinicians unsure how to diagnose or manage it.",
  "Medical gaslighting—having symptoms dismissed or blamed on stress—is a common trauma reported by patients.",
  "Social stigma and disbelief keep many people with ME/CFS from seeking care or support.",
  "Family and caregiver support can be life-saving for people with ME/CFS, especially in severe cases.",
  "Support groups and online communities provide connection, practical tips, and validation in a very isolating illness.",
  "Digital tools, pacing apps, and wearable devices can help some patients manage limited energy and avoid crashes.",
  "ME/CFS often overlaps with other infection-associated chronic conditions, and research into long COVID is helping drive new ME/CFS studies.",
  "Children and adolescents with ME/CFS generally have a better prognosis than adults, but the illness can still be long-lasting and severe.",
  "Sleep studies in ME/CFS show disrupted deep and REM sleep even when total hours slept are long.",
  "Speech, vision, balance, and movement can all worsen during crashes, making basic communication or self-care difficult.",
  "People with ME/CFS are not lazy—they are living with a serious, multi-system disease that turns everyday tasks into exhausting challenges.",
  "Awareness, updated medical training, and serious research funding are essential to change outcomes for people with ME/CFS.",
  "You can help by listening, believing, accommodating limits, and amplifying accurate information about ME/CFS."
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

async function fetchOwnedTokens(wallet) {
  const url = `https://api.etherscan.io/api?module=account&action=tokennfttx&address=${wallet}&contractaddress=${SLEEPY_CONTRACT}&page=1&offset=100&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  const owned = new Set();
  for (const tx of data.result) {
    if (tx.to.toLowerCase() === wallet.toLowerCase()) {
      owned.add(tx.tokenID);
    } else if (tx.from.toLowerCase() === wallet.toLowerCase()) {
      owned.delete(tx.tokenID);
    }
  }

  return Array.from(owned);
}

// ---- Slash Command Definitions ----

const GUILD_ID = '943847323690217482';

const commands = [
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
    )
].map(cmd => cmd.toJSON());

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
        ephemeral: true
      });
    }

    try {
      await setWalletLink(interaction.user.id, address);
      return interaction.reply({
        content: '✅ Wallet linked.',
        ephemeral: true
      });
    } catch (err) {
      console.error('Error saving wallet link:', err);
      return interaction.reply({
        content: '⚠️ Error saving your wallet link. Please try again later.',
        ephemeral: true
      });
    }
  }

  if (commandName === 'sleepy') {
    try {
      const wallet = await getWalletLink(interaction.user.id);
      if (!wallet) {
        return interaction.reply({
          content: '❌ Please link your wallet first using `/linkwallet 0x...`',
          ephemeral: true
        });
      }

      const owned = await fetchOwnedTokens(wallet);
      if (owned.length === 0) {
        return interaction.reply({
          content: '😢 You don’t own any Always Tired NFTs.',
          ephemeral: true
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
          ephemeral: true
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
          ephemeral: true
        });
      }

      const owned = await fetchOwnedTokens(wallet);
      if (owned.length === 0) {
        return interaction.reply({
          content: '😢 You don’t currently own any Always Tired NFTs.',
          ephemeral: true
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
          ephemeral: true
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
        ephemeral: true
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
