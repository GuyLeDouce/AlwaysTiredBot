const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const {
  singleRevivePhrases,
  killPhrases,
  deathPhrases,
  revivePhrases,
  lifePhrases,
  items,
  massKillEvents,
  massReviveEvents
} = require('./content');

const JOIN_EMOJI = '☕';
const MIN_PLAYERS = 2;
const ROUND_DELAY_MS = 4500;
const MAX_ROUNDS = 100;
const VESPA_ROLE_NAME = 'Vespa Killer';
const LOBBY_IMAGE_URL = 'https://i.imgur.com/CDFIPS9.jpeg';
const ALWAYS_TIRED_IMAGE_BASE = 'https://ipfs.chlewigen.ch/ipfs/QmcMWvNKhSzFqbvyCdcaiuBgQLTSEmHXWjys2N1dBUAHFe';
const ALWAYS_TIRED_SUPPLY = 7777;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const clone = [...list];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function uniqueById(players) {
  return Array.from(new Map(players.map(player => [player.id, player])).values());
}

function formatNames(players) {
  if (players.length === 1) {
    return players[0].mention;
  }
  if (players.length === 2) {
    return `${players[0].mention} and ${players[1].mention}`;
  }
  return `${players.slice(0, -1).map(player => player.mention).join(', ')}, and ${players[players.length - 1].mention}`;
}

function render(template, replacements) {
  return template.replace(/\{(\w+)\}/g, (_, key) => replacements[key] ?? `{${key}}`);
}

function buildRandomSleepyImageUrl() {
  const tokenId = randomInt(1, ALWAYS_TIRED_SUPPLY);
  return `${ALWAYS_TIRED_IMAGE_BASE}/${tokenId}.jpg`;
}

class FightService {
  constructor(client) {
    this.client = client;
    this.activeFights = new Map();
  }

  hasActiveFight(guildId) {
    const state = this.activeFights.get(guildId);
    return Boolean(state && !state.finished);
  }

  async createFightLobby(interaction) {
    if (!interaction.guildId || !interaction.channel) {
      await interaction.reply({ content: 'This command can only be used in a server channel.', ephemeral: true });
      return;
    }

    if (this.hasActiveFight(interaction.guildId)) {
      await interaction.reply({ content: 'There is already an active ME/CFS Warriors fight in this server.', ephemeral: true });
      return;
    }

    const type = interaction.options.getString('type', true);
    const timeSeconds = interaction.options.getInteger('time');

    if (type === 'normal' && (!timeSeconds || timeSeconds < 15)) {
      await interaction.reply({
        content: 'Normal fights require a countdown of at least 15 seconds.',
        ephemeral: true
      });
      return;
    }

    const startAt = type === 'normal' ? Date.now() + (timeSeconds * 1000) : null;
    const state = {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      hostId: interaction.user.id,
      hostMention: `<@${interaction.user.id}>`,
      type,
      createdAt: Date.now(),
      startAt,
      started: false,
      finished: false,
      cancelled: false,
      lobbyMessageId: null,
      participants: new Map(),
      timeouts: [],
      round: 0,
      alivePlayers: [],
      deadPlayers: [],
      eliminationOrder: [],
      playerStats: new Map(),
      totalEliminations: 0,
      totalRevives: 0,
      eventHistory: []
    };

    const embed = this.buildLobbyEmbed(state);
    await interaction.reply({ embeds: [embed], fetchReply: true });
    const lobbyMessage = await interaction.fetchReply();

    state.lobbyMessageId = lobbyMessage.id;
    this.activeFights.set(interaction.guildId, state);

    await lobbyMessage.react(JOIN_EMOJI).catch(() => null);
    await this.refreshLobbyParticipants(state);

    if (type === 'normal') {
      this.scheduleNormalFight(state);
    }
  }

  async startStaffFight(interaction) {
    const state = this.activeFights.get(interaction.guildId);

    if (!state || state.finished) {
      await interaction.reply({ content: 'There is no active fight lobby to start.', ephemeral: true });
      return;
    }

    if (state.type !== 'staff') {
      await interaction.reply({ content: 'Only staff-created fights can be started manually.', ephemeral: true });
      return;
    }

    if (state.hostId !== interaction.user.id) {
      await interaction.reply({ content: 'Only the user who created this staff fight can start it.', ephemeral: true });
      return;
    }

    if (state.started) {
      await interaction.reply({ content: 'This fight has already started.', ephemeral: true });
      return;
    }

    await interaction.reply({ content: 'Starting the ME/CFS Warriors fight now.' });
    await this.startFight(state);
  }

  async handleReactionAdd(reaction, user) {
    await this.handleLobbyReactionChange(reaction, user, true);
  }

  async handleReactionRemove(reaction, user) {
    await this.handleLobbyReactionChange(reaction, user, false);
  }

  async handleLobbyReactionChange(reaction, user, joined) {
    if (user.bot) {
      return;
    }

    const resolvedReaction = reaction.partial ? await reaction.fetch().catch(() => null) : reaction;
    if (!resolvedReaction || !resolvedReaction.message.guildId) {
      return;
    }

    const state = this.activeFights.get(resolvedReaction.message.guildId);
    if (!state || state.finished || state.started) {
      return;
    }

    if (resolvedReaction.message.id !== state.lobbyMessageId) {
      return;
    }

    if (resolvedReaction.emoji.name !== JOIN_EMOJI) {
      return;
    }

    if (joined) {
      const player = await this.buildPlayer(resolvedReaction.message.guild, user.id);
      if (player) {
        state.participants.set(player.id, player);
      }
    } else {
      state.participants.delete(user.id);
    }

    await this.updateLobbyMessage(state);
  }

  scheduleNormalFight(state) {
    const totalMs = Math.max(1000, state.startAt - Date.now());
    const reminders = [
      {
        elapsedMs: Math.floor(totalMs / 3),
        label: '2/3 time left'
      },
      {
        elapsedMs: Math.floor((totalMs * 2) / 3),
        label: '1/3 time left'
      },
      {
        elapsedMs: Math.max(totalMs - 5000, 1000),
        label: 'Starting soon'
      }
    ]
      .filter((entry, index, list) => entry.elapsedMs > 0 && entry.elapsedMs < totalMs
        && list.findIndex(other => other.elapsedMs === entry.elapsedMs) === index)
      .sort((a, b) => a.elapsedMs - b.elapsedMs);

    for (const reminder of reminders) {
      const timeout = setTimeout(async () => {
        if (!this.isStateStartable(state)) {
          return;
        }

        await this.refreshLobbyParticipants(state);
        await this.sendCountdownReminder(state, reminder.label);
      }, reminder.elapsedMs);
      state.timeouts.push(timeout);
    }

    const startTimeout = setTimeout(async () => {
      if (!this.isStateStartable(state)) {
        return;
      }

      await this.startFight(state);
    }, totalMs);

    state.timeouts.push(startTimeout);
  }

  isStateStartable(state) {
    const current = this.activeFights.get(state.guildId);
    return Boolean(current && current === state && !state.started && !state.finished);
  }

  async startFight(state) {
    if (state.started || state.finished) {
      return;
    }

    state.started = true;
    state.timeouts.forEach(timeout => clearTimeout(timeout));
    state.timeouts = [];

    await this.refreshLobbyParticipants(state);
    await this.updateLobbyMessage(state);

    if (state.participants.size < MIN_PLAYERS) {
      await this.cancelFight(state, `Fight cancelled. Not enough warriors joined. Minimum required: ${MIN_PLAYERS}.`);
      return;
    }

    const players = shuffle(Array.from(state.participants.values()));
    state.alivePlayers = players.map(player => ({ ...player, items: [] }));
    state.deadPlayers = [];

    for (const player of state.alivePlayers) {
      state.playerStats.set(player.id, {
        id: player.id,
        mention: player.mention,
        name: player.name,
        kills: 0,
        deaths: 0,
        revives: 0,
        revivedCount: 0,
        vespaKills: 0,
        itemsUnlocked: [],
        eliminatedBy: null,
        placement: null,
        alive: true
      });
    }

    const channel = await this.fetchChannel(state.channelId);
    if (!channel) {
      state.finished = true;
      this.activeFights.delete(state.guildId);
      return;
    }

    const participantList = state.alivePlayers.map(player => player.mention).join(', ');
    const startEmbed = new EmbedBuilder()
      .setColor(0x6b4f2a)
      .setTitle('ME/CFS Warriors Fight Started')
      .setDescription(`The lobby is locked. ${state.alivePlayers.length} warriors shuffle into the chaos.`)
      .addFields(
        { name: 'Host', value: state.hostMention, inline: true },
        { name: 'Participants', value: participantList.slice(0, 1024), inline: false }
      )
      .setImage(buildRandomSleepyImageUrl());

    await channel.send({ embeds: [startEmbed] });
    await this.clearLobbyReactions(channel.guild, state);
    await this.runGameLoop(state, channel);
  }

  async runGameLoop(state, channel) {
    while (state.alivePlayers.length > 1 && state.round < MAX_ROUNDS) {
      state.round += 1;
      const lines = this.generateRoundLines(state);

      if (lines.length === 0) {
        break;
      }

      state.eventHistory.push({ round: state.round, lines: [...lines] });

      const embed = new EmbedBuilder()
        .setColor(0x8f6a3a)
        .setTitle(`Round ${state.round}`)
        .setDescription(lines.join('\n'))
        .addFields(
          { name: 'Alive', value: `${state.alivePlayers.length}`, inline: true },
          { name: 'Fallen', value: `${state.deadPlayers.length}`, inline: true }
        )
        .setImage(buildRandomSleepyImageUrl());

      await channel.send({ embeds: [embed] });
      await sleep(ROUND_DELAY_MS);
    }

    await this.finishFight(state, channel);
  }

  generateRoundLines(state) {
    const lines = [];
    const lineTarget = randomInt(2, 5);
    let eliminationsThisRound = 0;

    if (state.alivePlayers.length > 1) {
      const forcedLine = this.generateEliminationLine(state);
      if (forcedLine) {
        lines.push(forcedLine);
        eliminationsThisRound += 1;
      }
    }

    while (lines.length < lineTarget && state.alivePlayers.length > 0) {
      const eventType = this.chooseEventType(state, eliminationsThisRound);
      const line = this.executeEvent(state, eventType);

      if (!line) {
        continue;
      }

      lines.push(line);

      if (['kill', 'death', 'itemKill'].includes(eventType)) {
        eliminationsThisRound += 1;
      }

      if (eventType === 'massKill') {
        eliminationsThisRound += 2;
      }

      if (state.alivePlayers.length <= 1) {
        break;
      }
    }

    return lines.slice(0, 5);
  }

  chooseEventType(state, eliminationsThisRound) {
    const weighted = [];
    const lateGame = state.alivePlayers.length <= 3;

    if (state.alivePlayers.length >= 2) {
      weighted.push(...Array(5).fill('kill'));
    }

    if (state.alivePlayers.length >= 1) {
      weighted.push(...Array(eliminationsThisRound === 0 ? 4 : 2).fill('death'));
      weighted.push(...Array(5).fill('life'));
      weighted.push(...Array(3).fill('itemUnlock'));
    }

    if (state.deadPlayers.length >= 1 && !lateGame) {
      weighted.push(...Array(2).fill('revive'));
    }

    if (state.deadPlayers.length >= 2 && !lateGame) {
      weighted.push('massRevive');
    }

    if (this.getAlivePlayersWithItems(state).length >= 1 && state.alivePlayers.length >= 2) {
      weighted.push(...Array(3).fill('itemKill'));
    }

    if (state.alivePlayers.length >= 4) {
      weighted.push('massKill');
    }

    return pickRandom(weighted);
  }

  generateEliminationLine(state) {
    const candidates = [];

    if (state.alivePlayers.length >= 2) {
      candidates.push('kill');
      if (this.getAlivePlayersWithItems(state).length >= 1) {
        candidates.push('itemKill');
      }
    }

    if (state.alivePlayers.length >= 1) {
      candidates.push('death');
    }

    if (state.alivePlayers.length >= 4) {
      candidates.push('massKill');
    }

    while (candidates.length > 0) {
      const pick = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
      const line = this.executeEvent(state, pick);
      if (line) {
        return line;
      }
    }

    return null;
  }

  executeEvent(state, eventType) {
    switch (eventType) {
      case 'kill':
        return this.handleKillEvent(state);
      case 'death':
        return this.handleDeathEvent(state);
      case 'revive':
        return this.handleReviveEvent(state);
      case 'life':
        return this.handleLifeEvent(state);
      case 'itemUnlock':
        return this.handleItemUnlockEvent(state);
      case 'itemKill':
        return this.handleItemKillEvent(state);
      case 'massKill':
        return this.handleMassKillEvent(state);
      case 'massRevive':
        return this.handleMassReviveEvent(state);
      default:
        return null;
    }
  }

  handleKillEvent(state) {
    if (state.alivePlayers.length < 2) {
      return null;
    }

    const [killer, target] = shuffle(state.alivePlayers).slice(0, 2);
    const phrase = render(pickRandom(killPhrases), {
      p1: killer.mention,
      p2: target.mention
    });
    const isVespa = /Vespa/i.test(phrase);
    this.eliminatePlayer(state, target.id, { killerId: killer.id, isVespa });
    this.incrementKiller(state, killer.id, isVespa);
    return phrase;
  }

  handleDeathEvent(state) {
    if (state.alivePlayers.length < 1) {
      return null;
    }

    const target = pickRandom(state.alivePlayers);
    const phrase = render(pickRandom(deathPhrases), { p1: target.mention });
    this.eliminatePlayer(state, target.id, { killerId: null, isVespa: false });
    return phrase;
  }

  handleReviveEvent(state) {
    if (state.deadPlayers.length < 1) {
      return null;
    }

    const target = pickRandom(state.deadPlayers);
    const phrase = render(pickRandom([...revivePhrases, ...singleRevivePhrases]), { p1: target.mention });
    this.revivePlayer(state, target.id);
    return phrase;
  }

  handleLifeEvent(state) {
    if (state.alivePlayers.length < 1) {
      return null;
    }

    const target = pickRandom(state.alivePlayers);
    return render(pickRandom(lifePhrases), { p1: target.mention });
  }

  handleItemUnlockEvent(state) {
    if (state.alivePlayers.length < 1) {
      return null;
    }

    const player = pickRandom(state.alivePlayers);
    const availableItems = items.filter(item => !player.items.includes(item.name));
    if (availableItems.length === 0) {
      return this.handleLifeEvent(state);
    }

    const item = pickRandom(availableItems);
    player.items.push(item.name);
    const stats = state.playerStats.get(player.id);
    stats.itemsUnlocked.push(item.name);
    return render(pickRandom(item.unlockPhrases), { p1: player.mention });
  }

  handleItemKillEvent(state) {
    const itemUsers = this.getAlivePlayersWithItems(state);
    if (itemUsers.length < 1 || state.alivePlayers.length < 2) {
      return null;
    }

    const killer = pickRandom(itemUsers);
    const targets = state.alivePlayers.filter(player => player.id !== killer.id);
    if (targets.length === 0) {
      return null;
    }

    const target = pickRandom(targets);
    const item = pickRandom(items.filter(entry => killer.items.includes(entry.name)));
    if (!item) {
      return null;
    }

    const phrase = render(pickRandom(item.killPhrases), {
      p1: killer.mention,
      p2: target.mention
    });
    const isVespa = item.tags.includes('vespa');

    this.eliminatePlayer(state, target.id, { killerId: killer.id, isVespa });
    this.incrementKiller(state, killer.id, isVespa);
    return phrase;
  }

  handleMassKillEvent(state) {
    if (state.alivePlayers.length < 4) {
      return null;
    }

    const maxVictims = Math.min(4, state.alivePlayers.length - 1);
    const victimCount = randomInt(2, maxVictims);
    const victims = shuffle(state.alivePlayers).slice(0, victimCount);
    const event = pickRandom(massKillEvents);

    for (const victim of victims) {
      this.eliminatePlayer(state, victim.id, { killerId: null, isVespa: false });
    }

    return `**${event.name}**: ${render(event.phrase, { players: formatNames(victims) })}`;
  }

  handleMassReviveEvent(state) {
    if (state.deadPlayers.length < 2) {
      return null;
    }

    const reviveCount = randomInt(2, Math.min(3, state.deadPlayers.length));
    const revivedPlayers = shuffle(state.deadPlayers).slice(0, reviveCount);
    const event = pickRandom(massReviveEvents);

    for (const player of revivedPlayers) {
      this.revivePlayer(state, player.id);
    }

    return `**${event.name}**: ${render(event.phrase, { players: formatNames(revivedPlayers) })}`;
  }

  getAlivePlayersWithItems(state) {
    return state.alivePlayers.filter(player => Array.isArray(player.items) && player.items.length > 0);
  }

  incrementKiller(state, killerId, isVespa) {
    const killerStats = state.playerStats.get(killerId);
    if (!killerStats) {
      return;
    }

    killerStats.kills += 1;
    if (isVespa) {
      killerStats.vespaKills += 1;
    }
  }

  eliminatePlayer(state, playerId, { killerId, isVespa }) {
    const playerIndex = state.alivePlayers.findIndex(player => player.id === playerId);
    if (playerIndex === -1) {
      return;
    }

    const [player] = state.alivePlayers.splice(playerIndex, 1);
    state.deadPlayers.push(player);
    state.totalEliminations += 1;

    const stats = state.playerStats.get(playerId);
    if (!stats) {
      return;
    }

    stats.deaths += 1;
    stats.alive = false;
    stats.placement = state.alivePlayers.length + 1;
    stats.eliminatedBy = killerId ? `<@${killerId}>` : null;

    if (isVespa && killerId) {
      stats.eliminatedBy = `<@${killerId}> via Mini Vespa`;
    }

    state.eliminationOrder.push(playerId);
  }

  revivePlayer(state, playerId) {
    const deadIndex = state.deadPlayers.findIndex(player => player.id === playerId);
    if (deadIndex === -1) {
      return;
    }

    const [player] = state.deadPlayers.splice(deadIndex, 1);
    state.alivePlayers.push(player);
    state.totalRevives += 1;

    const stats = state.playerStats.get(playerId);
    if (!stats) {
      return;
    }

    stats.revivedCount += 1;
    stats.revives += 1;
    stats.alive = true;
    stats.placement = null;
  }

  async finishFight(state, channel) {
    if (state.finished) {
      return;
    }

    state.finished = true;

    const winner = state.alivePlayers[0] || null;
    if (winner) {
      const winnerStats = state.playerStats.get(winner.id);
      if (winnerStats) {
        winnerStats.placement = 1;
        winnerStats.alive = true;
      }
    }

    const placements = Array.from(state.playerStats.values()).sort((a, b) => {
      const placeA = a.placement ?? Number.MAX_SAFE_INTEGER;
      const placeB = b.placement ?? Number.MAX_SAFE_INTEGER;
      return placeA - placeB || b.kills - a.kills;
    });

    if (winner) {
      await channel.send(`${winner.mention} is the winner of this fight!`);
      const winnerEmbed = new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle('ME/CFS Warriors Winner')
        .setDescription(`${winner.mention} survived the espresso storms, the PEM crashes, and the chaos.`)
        .setThumbnail(await this.getPlayerAvatarUrl(channel.guild, winner.id));
      await channel.send({ embeds: [winnerEmbed] });
    } else {
      await channel.send('No one survived the ME/CFS Warriors fight. The lobby dissolves into pure brain fog.');
    }

    const topKills = [...state.playerStats.values()]
      .sort((a, b) => b.kills - a.kills || (a.placement ?? 999) - (b.placement ?? 999))
      .slice(0, 3);

    const vespaKillers = [...state.playerStats.values()].filter(stats => stats.vespaKills > 0);
    const comebackPlayer = [...state.playerStats.values()]
      .sort((a, b) => b.revivedCount - a.revivedCount || b.kills - a.kills)[0];

    const resultsEmbed = new EmbedBuilder()
      .setColor(0x5a3921)
      .setTitle('Final Fight Results')
      .addFields(
        { name: 'Winner', value: winner ? winner.mention : 'None', inline: true },
        { name: '2nd Place', value: this.findPlacement(placements, 2), inline: true },
        { name: '3rd Place', value: this.findPlacement(placements, 3), inline: true },
        {
          name: 'Top Eliminators',
          value: topKills.length > 0
            ? topKills.map((stats, index) => `${index + 1}. ${stats.mention} - ${stats.kills} kills`).join('\n')
            : 'No eliminations recorded',
          inline: false
        },
        {
          name: 'Vespa Killers',
          value: vespaKillers.length > 0
            ? vespaKillers.map(stats => `${stats.mention} (${stats.vespaKills})`).join('\n')
            : 'None this fight',
          inline: false
        },
        {
          name: 'Fight Totals',
          value: `Eliminations: ${state.totalEliminations}\nRevives: ${state.totalRevives}\nRounds: ${state.round}`,
          inline: true
        },
        {
          name: 'Most Chaotic',
          value: topKills[0] ? `${topKills[0].mention} with ${topKills[0].kills} kills` : 'No chaos recorded',
          inline: true
        },
        {
          name: 'Comeback Player',
          value: comebackPlayer && comebackPlayer.revivedCount > 0
            ? `${comebackPlayer.mention} (${comebackPlayer.revivedCount} revivals)`
            : 'No comeback story this time',
          inline: true
        }
      );

    await channel.send({ embeds: [resultsEmbed] });
    await this.assignVespaRole(channel.guild, vespaKillers);
    this.activeFights.delete(state.guildId);
  }

  findPlacement(placements, place) {
    const entry = placements.find(stats => stats.placement === place);
    return entry ? entry.mention : 'N/A';
  }

  async cancelFight(state, reason) {
    state.cancelled = true;
    state.finished = true;
    state.timeouts.forEach(timeout => clearTimeout(timeout));
    state.timeouts = [];

    const channel = await this.fetchChannel(state.channelId);
    if (channel) {
      const embed = new EmbedBuilder()
        .setColor(0x7a7a7a)
        .setTitle('Fight Cancelled')
        .setDescription(reason)
        .setImage(buildRandomSleepyImageUrl());
      await channel.send({ embeds: [embed] });
    }

    this.activeFights.delete(state.guildId);
  }

  async buildPlayer(guild, userId) {
    try {
      const member = await guild.members.fetch(userId);
      return {
        id: member.id,
        name: member.displayName,
        mention: `<@${member.id}>`
      };
    } catch {
      const user = await this.client.users.fetch(userId).catch(() => null);
      if (!user) {
        return null;
      }

      return {
        id: user.id,
        name: user.globalName || user.username,
        mention: `<@${user.id}>`
      };
    }
  }

  buildLobbyEmbed(state) {
    const countdownText = state.type === 'normal'
      ? `<t:${Math.floor(state.startAt / 1000)}:R>`
      : 'Waiting for the host to run `/startfight`.';

    const participants = Array.from(state.participants.values());
    const playerList = participants.length > 0
      ? participants.map(player => player.mention).join(', ').slice(0, 1024)
      : 'No one has joined yet.';

    return new EmbedBuilder()
      .setColor(state.started ? 0x8f6a3a : 0x4b2e1f)
      .setTitle('ME/CFS Warriors Fight Lobby')
      .setDescription(`React with ${JOIN_EMOJI} to join the fight.`)
      .addFields(
        { name: 'Mode', value: state.type === 'staff' ? 'Staff' : 'Normal', inline: true },
        { name: 'Host', value: state.hostMention, inline: true },
        {
          name: state.type === 'staff' ? 'Start' : 'Countdown',
          value: state.started ? 'The fight has started.' : countdownText,
          inline: true
        },
        { name: `Joined (${participants.length})`, value: playerList, inline: false }
      )
      .setImage(LOBBY_IMAGE_URL)
      .setFooter({ text: state.started ? 'Lobby locked' : 'Join before the fight starts' });
  }

  async sendCountdownReminder(state, label) {
    const channel = await this.fetchChannel(state.channelId);
    if (!channel || state.started || state.finished) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x8f6a3a)
      .setTitle('Fight Countdown')
      .setDescription(`${label}. ${Array.from(state.participants.values()).length} warriors are in the lobby.`)
      .addFields({
        name: 'Starts',
        value: `<t:${Math.floor(state.startAt / 1000)}:R>`,
        inline: true
      })
      .setImage(buildRandomSleepyImageUrl());

    await channel.send({ embeds: [embed] }).catch(() => null);
  }

  async updateLobbyMessage(state) {
    const channel = await this.fetchChannel(state.channelId);
    if (!channel) {
      return;
    }

    const message = await channel.messages.fetch(state.lobbyMessageId).catch(() => null);
    if (!message) {
      return;
    }

    await message.edit({ embeds: [this.buildLobbyEmbed(state)] }).catch(() => null);
  }

  async refreshLobbyParticipants(state) {
    const channel = await this.fetchChannel(state.channelId);
    if (!channel) {
      return;
    }

    const message = await channel.messages.fetch(state.lobbyMessageId).catch(() => null);
    if (!message) {
      return;
    }

    const reaction = message.reactions.cache.find(entry => entry.emoji.name === JOIN_EMOJI);
    if (!reaction) {
      await this.updateLobbyMessage(state);
      return;
    }

    const users = await reaction.users.fetch().catch(() => null);
    if (!users) {
      await this.updateLobbyMessage(state);
      return;
    }

    const players = [];
    for (const [, user] of users) {
      if (user.bot) {
        continue;
      }

      const player = await this.buildPlayer(channel.guild, user.id);
      if (player) {
        players.push(player);
      }
    }

    const dedupedPlayers = uniqueById(players);
    state.participants = new Map(dedupedPlayers.map(player => [player.id, player]));
    await this.updateLobbyMessage(state);
  }

  async clearLobbyReactions(guild, state) {
    const channel = await this.fetchChannel(state.channelId);
    if (!channel) {
      return;
    }

    const message = await channel.messages.fetch(state.lobbyMessageId).catch(() => null);
    if (!message) {
      return;
    }

    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    const canManageMessages = me?.permissions.has(PermissionsBitField.Flags.ManageMessages);
    if (canManageMessages) {
      await message.reactions.removeAll().catch(() => null);
    }
  }

  async assignVespaRole(guild, vespaKillers) {
    if (!vespaKillers.length) {
      return;
    }

    const role = guild.roles.cache.find(entry => entry.name === VESPA_ROLE_NAME)
      || await guild.roles.fetch().then(roles => roles.find(entry => entry.name === VESPA_ROLE_NAME)).catch(() => null);

    if (!role) {
      return;
    }

    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!me || !me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return;
    }

    for (const stats of vespaKillers) {
      const member = await guild.members.fetch(stats.id).catch(() => null);
      if (member && !member.roles.cache.has(role.id)) {
        await member.roles.add(role).catch(() => null);
      }
    }
  }

  async fetchChannel(channelId) {
    return this.client.channels.fetch(channelId).catch(() => null);
  }

  async getPlayerAvatarUrl(guild, userId) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      return member.displayAvatarURL({ extension: 'png', size: 256 });
    }

    const user = await this.client.users.fetch(userId).catch(() => null);
    return user ? user.displayAvatarURL({ extension: 'png', size: 256 }) : null;
  }
}

module.exports = {
  FightService,
  JOIN_EMOJI
};
