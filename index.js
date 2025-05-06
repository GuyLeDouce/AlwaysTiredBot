// Sleepy Bot Full Setup with !sleepy, !mysleepys, !randomsleepy, !awareness

const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

const SLEEPY_CONTRACT = '0x3CCBd9C381742c04D81332b5db461951672F6A99';
const IMAGE_BASE = 'https://ipfs.io/ipfs/bafybeigqhrsckizhwjow3dush4muyawn7jud2kbmy3akzxyby457njyr5e';

const mecfsFacts = [
  "ME/CFS affects all races, genders, income levels, and ages. Recovery is rare — less than 5%.",
  "ME/CFS is more common than multiple sclerosis, lupus, and many types of cancer.",
  "ME/CFS has no FDA-approved treatments and no cure.",
  "Physical or mental exertion can lead to a 'crash' known as post-exertional malaise (PEM).",
  "Many people with ME/CFS are bedbound or housebound for months or years.",
  "ME/CFS can follow viral infections, including Epstein-Barr, SARS, and COVID-19.",
  "25% of ME/CFS patients are severely ill and may need feeding tubes, full-time care, or dark rooms.",
  "ME/CFS is a neurological disease that affects energy production and immune function.",
  "People with ME/CFS often sleep for long periods but still feel unrefreshed.",
  "People with ME/CFS can have memory issues and difficulty concentrating — sometimes called 'brain fog'.",
  "The CDC estimates over 2.5 million Americans have ME/CFS — most are undiagnosed.",
  "Many doctors are unaware of how to recognize or manage ME/CFS.",
  "ME/CFS can make even basic tasks like showering, cooking, or walking exhausting.",
  "There is no single test for ME/CFS — diagnosis is based on symptoms and exclusion.",
  "ME/CFS can worsen over time. Some patients deteriorate gradually while others decline rapidly.",
  "ME/CFS is one of the most underfunded diseases relative to its burden.",
  "Research funding per patient is lower than for almost any other major illness.",
  "ME/CFS often co-occurs with fibromyalgia, POTS, IBS, and mast cell disorders.",
  "People with ME/CFS can be sensitive to light, sound, touch, chemicals, and even food.",
  "Some ME/CFS patients spend decades seeking a diagnosis.",
  "Suicide risk is elevated due to isolation, suffering, and medical disbelief.",
  "ME/CFS is not 'just tiredness' — it is a complex multi-system disease.",
  "Children and teens can get ME/CFS too, often missing school or being misdiagnosed.",
  "ME/CFS research is growing but still severely under-resourced.",
  "Awareness and understanding are key to improving lives for those with ME/CFS.",
  "Many ME/CFS patients find community and hope through online support networks."
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let walletLinks = {};
if (fs.existsSync('walletLinks.json')) {
  walletLinks = JSON.parse(fs.readFileSync('walletLinks.json'));
}

client.on('ready', () => {
  console.log(`😴 Sleepy Bot logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('!') || message.author.bot) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'linkwallet') {
    const address = args[0];
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return message.reply('❌ Please enter a valid Ethereum wallet address.');
    }
    walletLinks[message.author.id] = address;
    fs.writeFileSync('walletLinks.json', JSON.stringify(walletLinks, null, 2));

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

    return message.channel.send(`✅ Wallet linked.`);
  }

  const handleSleepyToken = async (tokenId, includeFact = false) => {
    const imgUrl = `${IMAGE_BASE}/${tokenId}.jpg`;
    const rarityApiUrl = `https://api-mainnet.magiceden.dev/v2/eth/tokens/${SLEEPY_CONTRACT}/${tokenId}`;
    const randomFact = mecfsFacts[Math.floor(Math.random() * mecfsFacts.length)];

    try {
      const res = await fetch(rarityApiUrl);
      const data = await res.json();

      const fileCheck = await fetch(imgUrl);
      if (!fileCheck.ok) throw new Error('Image not found');

      const messageText = `Token ID: ${tokenId}\nRank: #${data.rank}` +
        (includeFact ? `\n\n💡 **ME/CFS Fact:** ${randomFact}` : '');

      return message.reply({
        content: messageText,
        files: [{ attachment: imgUrl, name: `sleepy-${tokenId}.jpg` }]
      });
    } catch (err) {
      console.warn(`⚠️ Could not fetch data or image for Sleepy #${tokenId}. Showing fallback.`);
      const fallbackText = `Token ID: ${tokenId}` + (includeFact ? `\n\n💡 **ME/CFS Fact:** ${randomFact}` : '');
      return message.reply({ content: fallbackText });
    }
  };

  if (command === 'sleepy') {
    const wallet = walletLinks[message.author.id];
    if (!wallet) return message.reply('❌ Please link your wallet first using `!linkwallet 0x...`');

    const url = `https://api.etherscan.io/api?module=account&action=tokennfttx&address=${wallet}&contractaddress=${SLEEPY_CONTRACT}&page=1&offset=100&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
    try {
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

      if (owned.size === 0) return message.reply('😢 You don’t own any Always Tired NFTs.');

      const tokenArray = Array.from(owned);
      const randomToken = tokenArray[Math.floor(Math.random() * tokenArray.length)];
      return handleSleepyToken(randomToken);
    } catch (err) {
      console.error(err);
      return message.reply('⚠️ Error fetching your Sleepys. Please try again later.');
    }
  }

  if (command === 'mysleepys') {
    const wallet = walletLinks[message.author.id];
    if (!wallet) return message.reply('❌ Please link your wallet first using `!linkwallet 0x...`');

    const url = `https://api.etherscan.io/api?module=account&action=tokennfttx&address=${wallet}&contractaddress=${SLEEPY_CONTRACT}&page=1&offset=100&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
    try {
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

      const tokenArray = Array.from(owned);
      if (tokenArray.length === 0) return message.reply('😢 You don’t currently own any Always Tired NFTs.');

      const limitedTokens = tokenArray.slice(0, 10);
      const files = limitedTokens.map((tokenId) => ({
        attachment: `${IMAGE_BASE}/${tokenId}.jpg`,
        name: `sleepy-${tokenId}.jpg`
      }));

      const listedIds = limitedTokens.map(id => `Token ID: ${id}`).join('\n');
      return message.reply({ content: listedIds, files });
    } catch (err) {
      console.error(err);
      return message.reply('⚠️ Error fetching your Sleepys. Please try again later.');
    }
  }

  if (command === 'randomsleepy') {
    const tokenId = Math.floor(Math.random() * 4000) + 1;
    return handleSleepyToken(tokenId);
  }

  if (command === 'awareness') {
    const tokenId = Math.floor(Math.random() * 4000) + 1;
    return handleSleepyToken(tokenId, true);
  }

  if (command.startsWith('sleepy') && command !== 'sleepy' && command !== 'mysleepys') {
    const tokenId = command.replace('sleepy', '');
    if (!/^\d+$/.test(tokenId)) {
      return message.reply('❌ Please enter a valid token number after `!sleepy` (e.g. `!sleepy142`)');
    }
    return handleSleepyToken(tokenId);
  }
});

client.login(DISCORD_TOKEN);

