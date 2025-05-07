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
  "Many ME/CFS patients find community and hope through online support networks.",
    "ME/CFS symptoms can fluctuate daily, even hourly.",
  "Many people with ME/CFS were previously healthy and active.",
  "There is no single biomarker for ME/CFS — diagnosis is clinical.",
  "Energy production dysfunction is a suspected cause of ME/CFS.",
  "Cognitive impairment in ME/CFS is often called 'brain fog'.",
  "ME/CFS is sometimes triggered by physical trauma or surgery.",
  "Long COVID has brought renewed attention to ME/CFS research.",
  "Many ME/CFS patients report worsening symptoms after vaccinations or infections.",
  "Temperature regulation is often impaired in people with ME/CFS.",
  "Even minor stress can cause symptom flare-ups in ME/CFS.",
  "Heart rate and blood pressure abnormalities are common in ME/CFS.",
  "Digestive issues like IBS are frequent in ME/CFS patients.",
  "ME/CFS affects more women than men, but all genders are impacted.",
  "Hormonal fluctuations can worsen ME/CFS symptoms.",
  "ME/CFS research funding is less than $10 per patient per year.",
  "The average time to diagnosis is over 5 years for ME/CFS.",
  "Social stigma prevents many people with ME/CFS from getting help.",
  "Family and caregiver support is vital for ME/CFS management.",
  "Many people with ME/CFS are misdiagnosed with depression or anxiety.",
  "Rest does not restore energy in ME/CFS — it is not regular fatigue.",
  "Many patients with ME/CFS experience sensory overload in public spaces.",
  "ME/CFS can impair speech and verbal processing during crashes.",
  "Some ME/CFS patients are unable to speak, move, or tolerate light for years.",
  "Overexertion in ME/CFS can cause crashes lasting days, weeks, or longer.",
  "Patients often track their activity using heart rate monitors.",
  "Graded exercise therapy has harmed many ME/CFS patients.",
  "People with ME/CFS are not lazy — they are fighting to survive daily life.",
  "Sleep studies in ME/CFS often show disrupted REM and deep sleep.",
  "No two ME/CFS patients experience the exact same set of symptoms.",
  "Many people with ME/CFS are forced to give up careers they loved.",
  "Medical gaslighting is a common trauma for ME/CFS patients.",
  "Relapses in ME/CFS can be triggered by infection, stress, or overexertion.",
  "Homebound and bedbound patients are often invisible in ME/CFS statistics.",
  "The severest cases of ME/CFS are among the most neglected patients in medicine.",
  "There are promising diagnostic tests in development — but none are official yet.",
  "The IOM renamed ME/CFS as SEID (Systemic Exertion Intolerance Disease) in 2015.",
  "Support groups are essential for mental health in ME/CFS.",
  "Many ME/CFS patients lose friends and social ties due to isolation.",
  "Disability benefits are hard to obtain with ME/CFS due to lack of understanding.",
  "Some ME/CFS patients experience changes in voice, vision, or movement.",
  "ME/CFS advocacy is growing thanks to patients, allies, and researchers.",
  "Sharing ME/CFS facts helps break stigma and educate the public.",
  "Awareness campaigns have increased due to Long COVID parallels.",
  "Many people with ME/CFS live in poverty due to medical expenses and job loss.",
  "ME/CFS remains under-taught in medical schools globally.",
  "The economic cost of ME/CFS in the U.S. is estimated at $24 billion per year.",
  "ME/CFS has been reported worldwide for over a century under different names.",
  "Digital tools like health journals and pacing apps help patients manage symptoms.",
  "ME/CFS is real, physical, and devastating — but often misunderstood.",
  "You can help people with ME/CFS by listening, believing, and supporting them."
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
  const randomFact = mecfsFacts[Math.floor(Math.random() * mecfsFacts.length)];

  try {
    const messageText = `Token ID: ${tokenId}` + (includeFact ? `\n\n💡 **ME/CFS Fact:** ${randomFact}` : '');
    return message.reply({
      content: messageText,
      files: [{ attachment: imgUrl, name: `sleepy-${tokenId}.jpg` }]
    });
  } catch (err) {
    console.warn(`⚠️ Could not send image for Sleepy #${tokenId}.`);
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
