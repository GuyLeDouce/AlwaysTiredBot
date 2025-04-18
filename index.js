const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

const SLEEPY_CONTRACT = '0x3CCBd9C381742c04D81332b5db461951672F6A99';
const IMAGE_BASE = 'https://ipfs.io/ipfs/bafybeigqhrsckizhwjow3dush4muyawn7jud2kbmy3akzxyby457njyr5e';

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

  // !linkwallet
  if (command === 'linkwallet') {
    const address = args[0];
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return message.reply('❌ Please enter a valid Ethereum wallet address.');
    }
    walletLinks[message.author.id] = address;
    fs.writeFileSync('walletLinks.json', JSON.stringify(walletLinks, null, 2));
    return message.reply(`✅ Wallet linked: ${address}`);
  }

  // !sleepy - random NFT from linked wallet
  if (command === 'sleepy') {
    const wallet = walletLinks[message.author.id];
    if (!wallet) {
      return message.reply('❌ Please link your wallet first using `!linkwallet 0x...`');
    }

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
      const imgUrl = `${IMAGE_BASE}/${randomToken}.jpg`;

      return message.reply({
        content: `Token ID: ${randomToken}`,
        files: [{
          attachment: imgUrl,
          name: `sleepy-${randomToken}.jpg`
        }]
      });

    } catch (err) {
      console.error(err);
      return message.reply('⚠️ Error fetching your Sleepys. Please try again later.');
    }
  }

  // !mysleepys - list up to 10 owned
  if (command === 'mysleepys') {
    const wallet = walletLinks[message.author.id];
    if (!wallet) {
      return message.reply('❌ Please link your wallet first using `!linkwallet 0x...`');
    }

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
      if (tokenArray.length === 0) {
        return message.reply('😢 You don’t currently own any Always Tired NFTs.');
      }

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

  // !sleepy[TOKEN_ID] - show any Sleepy with rarity (fallback to image only if needed)
  if (command.startsWith('sleepy') && command !== 'sleepy' && command !== 'mysleepys') {
    const tokenId = command.replace('sleepy', '');

    if (!/^\d+$/.test(tokenId)) {
      return message.reply('❌ Please enter a valid token number after `!sleepy` (e.g. `!sleepy142`)');
    }

    const imgUrl = `${IMAGE_BASE}/${tokenId}.jpg`;
    const rarityApiUrl = `https://api-mainnet.magiceden.dev/v2/eth/tokens/${SLEEPY_CONTRACT}/${tokenId}`;

    try {
      const res = await fetch(rarityApiUrl);
      const data = await res.json();

      if (data.rank && data.rarityScore) {
        return message.reply({
          content: `Token ID: ${tokenId}\nRank: #${data.rank}\nRarity Score: ${data.rarityScore}`,
          files: [{
            attachment: imgUrl,
            name: `sleepy-${tokenId}.jpg`
          }]
        });
      } else {
        throw new Error('Rarity not found');
      }
    } catch (err) {
      console.warn(`⚠️ Could not fetch rarity for Sleepy #${tokenId}. Showing image only.`);
      return message.reply({
        content: `Token ID: ${tokenId}`,
        files: [{
          attachment: imgUrl,
          name: `sleepy-${tokenId}.jpg`
        }]
      });
    }
  }
});

client.login(DISCORD_TOKEN);
