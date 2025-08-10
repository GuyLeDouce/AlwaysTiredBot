// Sleepy Bot Full Setup with !sleepy, !mysleepys, !randomsleepy, !awareness

const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

const SLEEPY_CONTRACT = '0x3CCBd9C381742c04D81332b5db461951672F6A99';
const IMAGE_BASE = 'https://ipfs.io/ipfs/bafybeigqhrsckizhwjow3dush4muyawn7jud2kbmy3akzxyby457njyr5e';

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
