const { EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

const DRIP_API_BASE = 'https://api.drip.re/api/v1';
const MANUAL_REWARD_CONTACT_ID = '1369110267463471234';

function floorSplit(total, weights) {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const raw = weights.map(weight => (total * weight) / weightSum);
  const base = raw.map(value => Math.floor(value));
  let remainder = total - base.reduce((sum, value) => sum + value, 0);

  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let i = 0; i < order.length && remainder > 0; i += 1) {
    base[order[i].index] += 1;
    remainder -= 1;
  }

  return base;
}

class DripService {
  constructor({
    apiToken,
    realmId,
    clientId,
    currencyId,
    logChannelId = null,
    initiatorId = null,
    senderId = null,
    transferSenderId = null,
    defaultSenderMemberId = null
  }) {
    this.apiToken = apiToken;
    this.realmId = realmId;
    this.clientId = clientId;
    this.currencyId = currencyId;
    this.logChannelId = logChannelId;
    this.initiatorId = initiatorId;
    this.senderId = senderId;
    this.transferSenderId = transferSenderId;
    this.defaultSenderMemberId = defaultSenderMemberId;
  }

  isConfigured() {
    return Boolean(this.apiToken && this.realmId);
  }

  getHeaders() {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json'
    };
  }

  log(event, details = {}) {
    console.log(`[DRIP] ${event}`, details);
  }

  normalizeId(value) {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return null;
    }

    const normalized = String(value).trim();
    if (
      !normalized
      || normalized === '[object Object]'
      || normalized === 'null'
      || normalized === 'undefined'
    ) {
      return null;
    }

    return normalized;
  }

  collectCandidateIds(values) {
    const seen = new Set();
    const candidates = [];

    for (const value of values) {
      const normalized = this.normalizeId(value);
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      candidates.push(normalized);
    }

    return candidates;
  }

  async requestJson(url, options = {}) {
    const response = await fetch(url, options);
    const rawBody = await response.text().catch(() => '');
    let data = {};

    if (rawBody) {
      try {
        data = JSON.parse(rawBody);
      } catch {
        data = { rawBody };
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      url,
      data,
      rawBody
    };
  }

  async fetchJsonWithFallback(candidates, options, { logLabel = 'request', suppress404 = true } = {}) {
    let lastError = null;

    for (const url of candidates) {
      let result;

      try {
        result = await this.requestJson(url, options);
      } catch (error) {
        lastError = error;
        this.log(`${logLabel} network failure`, {
          url,
          message: error?.message || String(error)
        });
        continue;
      }

      if (result.ok) {
        return result;
      }

      lastError = new Error(result.data?.message || result.rawBody || `HTTP ${result.status}`);
      lastError.status = result.status;
      lastError.data = result.data;
      lastError.url = url;

      if (result.status === 404 && suppress404) {
        continue;
      }

      this.log(`${logLabel} failure`, {
        url,
        status: result.status,
        body: result.rawBody || result.data
      });

      throw lastError;
    }

    throw lastError || new Error('DRIP request failed');
  }

  async searchMemberByDiscordId(discordId) {
    const query = `type=discord-id&values=${encodeURIComponent(discordId)}`;
    const routes = [
      `${DRIP_API_BASE}/realms/${this.realmId}/members/search?${query}`,
      `${DRIP_API_BASE}/realm/${this.realmId}/members/search?${query}`
    ];

    this.log('recipient search start', {
      discordId,
      routes
    });

    const { data, url } = await this.fetchJsonWithFallback(
      routes,
      { headers: this.getHeaders() },
      { logLabel: 'member search', suppress404: true }
    );

    const member = data?.data?.[0] || null;
    this.log('recipient search result', {
      discordId,
      route: url,
      recipientCandidates: this.collectCandidateIds([member?.id]),
      resolvedRecipientMemberId: member?.id || null
    });

    return member;
  }

  resolveConfiguredSenderMemberId() {
    const senderCandidates = this.collectCandidateIds([
      this.senderId,
      this.transferSenderId,
      this.defaultSenderMemberId
    ]);

    this.log('sender resolution', {
      senderCandidates,
      configuredSenderId: this.normalizeId(this.senderId),
      configuredTransferSenderId: this.normalizeId(this.transferSenderId),
      defaultSenderMemberId: this.normalizeId(this.defaultSenderMemberId),
      initiatorId: this.normalizeId(this.initiatorId),
      clientId: this.normalizeId(this.clientId)
    });

    if (senderCandidates.length === 0) {
      throw new Error('No DRIP transfer sender member ID is configured. Set DRIP_SENDER_ID or DRIP_TRANSFER_SENDER_ID.');
    }

    return {
      senderCandidates,
      senderMemberId: senderCandidates[0]
    };
  }

  async resolveRecipientMember({ discordId, recipientMemberIdOverride = null }) {
    const recipientCandidates = this.collectCandidateIds([recipientMemberIdOverride]);

    if (recipientCandidates.length > 0) {
      this.log('recipient resolution', {
        discordId,
        recipientCandidates,
        source: 'override'
      });

      return {
        recipientCandidates,
        recipientMemberId: recipientCandidates[0],
        displayName: null
      };
    }

    const member = await this.searchMemberByDiscordId(discordId);
    const resolvedCandidates = this.collectCandidateIds([member?.id]);

    this.log('recipient resolution', {
      discordId,
      recipientCandidates: resolvedCandidates,
      source: 'discord-id-search'
    });

    if (!member || resolvedCandidates.length === 0) {
      return {
        recipientCandidates: [],
        recipientMemberId: null,
        displayName: null
      };
    }

    return {
      recipientCandidates: resolvedCandidates,
      recipientMemberId: resolvedCandidates[0],
      displayName: member.displayName || member.username || discordId
    };
  }

  buildTransferPayloadVariants(tokens, recipientMemberId) {
    const variants = [];

    variants.push({
      label: this.currencyId ? 'amount+currencyId' : 'amount',
      payload: {
        amount: tokens,
        recipientId: recipientMemberId,
        ...(this.currencyId ? { currencyId: this.currencyId } : {})
      }
    });

    variants.push({
      label: this.currencyId ? 'tokens+realmPointId' : 'tokens',
      payload: {
        tokens,
        recipientId: recipientMemberId,
        ...(this.currencyId ? { realmPointId: this.currencyId } : {})
      }
    });

    return variants;
  }

  async transferTokensBetweenMembers({ senderMemberId, recipientMemberId, tokens, context = 'reward' }) {
    const url = `${DRIP_API_BASE}/realms/${this.realmId}/members/${senderMemberId}/transfer`;
    const attempts = this.buildTransferPayloadVariants(tokens, recipientMemberId);
    let lastError = null;

    for (const attempt of attempts) {
      this.log('transfer request', {
        context,
        url,
        senderMemberId,
        recipientMemberId,
        payload: attempt.payload,
        payloadVariant: attempt.label
      });

      let result;

      try {
        result = await this.requestJson(url, {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify(attempt.payload)
        });
      } catch (error) {
        lastError = error;
        this.log('transfer failure', {
          context,
          url,
          senderMemberId,
          recipientMemberId,
          payloadVariant: attempt.label,
          message: error?.message || String(error)
        });
        continue;
      }

      if (result.ok) {
        return result.data;
      }

      lastError = new Error(result.data?.message || result.rawBody || `HTTP ${result.status}`);
      lastError.status = result.status;
      lastError.data = result.data;
      lastError.url = url;

      this.log('transfer failure', {
        context,
        url,
        senderMemberId,
        recipientMemberId,
        payloadVariant: attempt.label,
        status: result.status,
        body: result.rawBody || result.data
      });
    }

    throw lastError || new Error('DRIP member transfer failed');
  }

  resolveCoffeeCurrencyId() {
    if (!this.currencyId) {
      throw new Error('DRIP_CURRENCY_ID is missing. It is required for project-level fallback awards.');
    }

    return this.currencyId;
  }

  async awardTokensToMemberId(memberId, tokens, { context = 'reward' } = {}) {
    const currencyId = this.resolveCoffeeCurrencyId();

    try {
      const balanceUrl = `${DRIP_API_BASE}/realms/${this.realmId}/members/${memberId}/balance`;
      const balancePayload = {
        amount: tokens,
        currencyId
      };

      this.log('project fallback request', {
        context,
        url: balanceUrl,
        payload: balancePayload
      });

      const { data } = await this.fetchJsonWithFallback(
        [balanceUrl],
        {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify(balancePayload)
        },
        { logLabel: 'project fallback balance', suppress404: false }
      );

      return data;
    } catch (balanceError) {
      const pointBalanceUrls = [
        `${DRIP_API_BASE}/realms/${this.realmId}/members/${memberId}/point-balance`,
        `${DRIP_API_BASE}/realm/${this.realmId}/members/${memberId}/point-balance`
      ];
      const pointBalancePayload = {
        tokens,
        realmPointId: currencyId
      };

      this.log('project fallback request', {
        context,
        urls: pointBalanceUrls,
        payload: pointBalancePayload
      });

      const { data } = await this.fetchJsonWithFallback(
        pointBalanceUrls,
        {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify(pointBalancePayload)
        },
        { logLabel: 'project fallback point-balance', suppress404: true }
      );

      return data;
    }
  }

  async payoutByDiscordId(discordId, tokens, { recipientMemberIdOverride = null, context = 'reward' } = {}) {
    this.log('reward start', {
      context,
      discordId,
      recipientMemberIdOverride: this.normalizeId(recipientMemberIdOverride),
      tokens
    });

    const recipient = await this.resolveRecipientMember({ discordId, recipientMemberIdOverride });
    const { recipientMemberId, recipientCandidates, displayName } = recipient;

    if (!recipientMemberId) {
      return {
        success: false,
        reason: 'member_not_found',
        discordId,
        displayName: null,
        tokens,
        recipientCandidates,
        senderCandidates: []
      };
    }

    let sender;
    try {
      sender = this.resolveConfiguredSenderMemberId();
    } catch (error) {
      return {
        success: false,
        reason: error?.message || String(error),
        discordId,
        dripMemberId: recipientMemberId,
        displayName,
        tokens,
        recipientCandidates,
        senderCandidates: []
      };
    }

    try {
      await this.transferTokensBetweenMembers({
        senderMemberId: sender.senderMemberId,
        recipientMemberId,
        tokens,
        context
      });

      return {
        success: true,
        reason: null,
        method: 'member_transfer',
        discordId,
        dripMemberId: recipientMemberId,
        senderDripMemberId: sender.senderMemberId,
        displayName,
        tokens,
        recipientCandidates,
        senderCandidates: sender.senderCandidates
      };
    } catch (transferError) {
      this.log('member transfer failed, using project fallback', {
        context,
        discordId,
        senderMemberId: sender.senderMemberId,
        recipientMemberId,
        status: transferError?.status || null,
        body: transferError?.data || transferError?.message || String(transferError)
      });

      try {
        await this.awardTokensToMemberId(recipientMemberId, tokens, {
          context: `${context}:project-fallback`
        });

        return {
          success: true,
          reason: null,
          method: 'project_fallback',
          fallbackUsed: true,
          discordId,
          dripMemberId: recipientMemberId,
          senderDripMemberId: sender.senderMemberId,
          displayName,
          tokens,
          recipientCandidates,
          senderCandidates: sender.senderCandidates
        };
      } catch (fallbackError) {
        return {
          success: false,
          reason: fallbackError?.message || String(fallbackError),
          method: 'project_fallback_failed',
          transferFailure: transferError?.message || String(transferError),
          discordId,
          dripMemberId: recipientMemberId,
          senderDripMemberId: sender.senderMemberId,
          displayName,
          tokens,
          recipientCandidates,
          senderCandidates: sender.senderCandidates
        };
      }
    }
  }

  async awardTokensByDiscordId(discordId, tokens) {
    return this.payoutByDiscordId(discordId, tokens, { context: 'manual-award' });
  }

  async manualAwardByDiscordId(discordId, tokens) {
    if (!this.isConfigured()) {
      return {
        success: false,
        reason: 'missing_config',
        discordId,
        displayName: null,
        tokens
      };
    }

    return this.payoutByDiscordId(discordId, tokens, { context: 'manual-award' }).catch(error => ({
      success: false,
      reason: error?.message || String(error),
      discordId,
      displayName: null,
      tokens
    }));
  }

  buildPayoutPlan(participantCount, rankedFinishers, vespaEligibleFinisher) {
    const totalPrizePool = participantCount * 15;
    const podiumPool = participantCount * 14;
    const vespaPool = participantCount;
    const podiumShares = floorSplit(podiumPool, [5, 3, 2]);

    return {
      totalPrizePool,
      podiumPool,
      vespaPool,
      podiumAwards: rankedFinishers.slice(0, 3).map((player, index) => ({
        placement: index + 1,
        player,
        tokens: podiumShares[index] || 0
      })),
      vespaAward: vespaEligibleFinisher
        ? {
            player: vespaEligibleFinisher,
            tokens: vespaPool
          }
        : null
    };
  }

  async payoutFightResults({ participantCount, rankedFinishers, vespaEligibleFinisher }) {
    if (!this.isConfigured()) {
      return {
        enabled: false,
        totalPrizePool: participantCount * 15,
        podiumResults: [],
        vespaResult: null
      };
    }

    const plan = this.buildPayoutPlan(participantCount, rankedFinishers, vespaEligibleFinisher);
    const podiumResults = [];

    for (const award of plan.podiumAwards) {
      if (!award.player || award.tokens <= 0 || award.player.isBot) {
        continue;
      }

      const result = await this.payoutByDiscordId(award.player.id, award.tokens, {
        context: `fight-payout:${award.placement}`
      }).catch(error => ({
        success: false,
        reason: error?.message || String(error),
        discordId: award.player.id,
        displayName: award.player.name,
        tokens: award.tokens
      }));

      podiumResults.push({
        placement: award.placement,
        player: award.player,
        tokens: award.tokens,
        ...result
      });
    }

    let vespaResult = null;
    if (plan.vespaAward && !plan.vespaAward.player.isBot && plan.vespaAward.tokens > 0) {
      vespaResult = await this.payoutByDiscordId(plan.vespaAward.player.id, plan.vespaAward.tokens, {
        context: 'fight-payout:vespa'
      })
        .then(result => ({
          player: plan.vespaAward.player,
          tokens: plan.vespaAward.tokens,
          ...result
        }))
        .catch(error => ({
          player: plan.vespaAward.player,
          tokens: plan.vespaAward.tokens,
          success: false,
          reason: error?.message || String(error),
          discordId: plan.vespaAward.player.id,
          displayName: plan.vespaAward.player.name
        }));
    }

    return {
      enabled: true,
      ...plan,
      podiumResults,
      vespaResult
    };
  }

  buildPayoutEmbed(payout) {
    const podiumLines = payout.podiumAwards?.length
      ? payout.podiumAwards.map(award => {
          const result = payout.podiumResults?.find(entry => entry.placement === award.placement);
          const suffix = result?.success === false ? ' (DRIP member not found / award failed)' : '';
          return `${award.placement}. ${award.player.name} - ${award.tokens} $COFFEE${suffix}`;
        }).join('\n')
      : 'No podium payouts.';

    const vespaLine = payout.vespaAward
      ? `${payout.vespaAward.player.name} - ${payout.vespaAward.tokens} $COFFEE${payout.vespaResult?.success === false ? ' (award failed)' : ''}`
      : 'No eligible Vespa Killer this match.';

    const description = payout.enabled
      ? `Prize pool funded by ${Math.floor(payout.totalPrizePool / 15)} real player joins.`
      : 'DRIP payout is not configured. Prize pool was calculated but not awarded.';

    return new EmbedBuilder()
      .setColor(0x6b4f2a)
      .setTitle('$COFFEE Prize Pool')
      .setDescription(description)
      .addFields(
        {
          name: 'Podium Pool',
          value: `${payout.podiumPool} $COFFEE\n${podiumLines}`,
          inline: false
        },
        {
          name: 'Vespa Killer Pool',
          value: `${payout.vespaPool} $COFFEE\n${vespaLine}`,
          inline: false
        }
      );
  }

  buildLogEmbed(payout) {
    const lines = [];
    const failures = [];

    for (const result of payout.podiumResults || []) {
      const label = result.placement === 1
        ? 'the top ME/CFS Warrior'
        : result.placement === 2
          ? 'the second ME/CFS Warrior'
          : 'the third ME/CFS Warrior';

      if (result.success) {
        lines.push(`<@${result.player.id}> was rewarded ${result.tokens} for being ${label}`);
      } else {
        failures.push(result);
        lines.push(`<@${result.player.id}> was NOT rewarded ${result.tokens} for being ${label}. <@${MANUAL_REWARD_CONTACT_ID}> will have to manually reward you.`);
      }
    }

    if (payout.vespaResult?.player) {
      if (payout.vespaResult.success) {
        lines.push(`<@${payout.vespaResult.player.id}> was rewarded ${payout.vespaResult.tokens} for being the top <@&1428408018709512262> ME/CFS Warrior`);
      } else {
        failures.push(payout.vespaResult);
        lines.push(`<@${payout.vespaResult.player.id}> was NOT rewarded ${payout.vespaResult.tokens} for being the top <@&1428408018709512262> ME/CFS Warrior. <@${MANUAL_REWARD_CONTACT_ID}> will have to manually reward you.`);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(failures.length > 0 ? 0xb04a3a : 0x4a7a44)
      .setTitle('DRIP Payout Receipt')
      .setDescription(
        payout.enabled
          ? (lines.join('\n').slice(0, 4096) || 'No eligible rewards this fight.')
          : 'DRIP payout was skipped because DRIP is not configured.'
      );

    return embed;
  }

  async testConnection() {
    if (!this.isConfigured()) {
      return {
        ok: false,
        reason: 'missing_config',
        message: 'DRIP_API_TOKEN or DRIP_REALM_ID is missing.'
      };
    }

    try {
      const response = await fetch(
        `${DRIP_API_BASE}/realms/${this.realmId}`,
        { headers: this.getHeaders() }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          ok: false,
          reason: 'api_error',
          message: data?.message || `HTTP ${response.status}`
        };
      }

      return {
        ok: true,
        reason: null,
        message: 'Connected to DRIP successfully.',
        data
      };
    } catch (error) {
      return {
        ok: false,
        reason: 'network_error',
        message: error?.message || String(error)
      };
    }
  }

  buildConnectionTestEmbed(result) {
    return new EmbedBuilder()
      .setColor(result.ok ? 0x4a7a44 : 0xb04a3a)
      .setTitle('DRIP Connection Test')
      .addFields(
        {
          name: 'Status',
          value: result.ok ? 'Connected' : 'Failed',
          inline: true
        },
        {
          name: 'Realm',
          value: this.realmId || 'Not configured',
          inline: true
        },
        {
          name: 'Client ID',
          value: this.clientId || 'Not configured',
          inline: true
        },
        {
          name: 'Sender Member ID',
          value: this.senderId || this.transferSenderId || this.defaultSenderMemberId || 'Not configured',
          inline: true
        },
        {
          name: 'Currency ID',
          value: this.currencyId || 'Not configured',
          inline: true
        },
        {
          name: 'Initiator ID',
          value: this.initiatorId || 'Not configured',
          inline: true
        },
        {
          name: 'Result',
          value: result.message.slice(0, 1024),
          inline: false
        }
      );
  }

  buildManualAwardEmbed({ targetName, amount, result, actorName, reason = null }) {
    const successLine = reason
      ? `${actorName} manually awarded a ${amount} $COFFEE sip to ${targetName} for ${reason}.`
      : `${actorName} manually awarded a ${amount} $COFFEE sip to ${targetName}.`;

    return new EmbedBuilder()
      .setColor(result.success ? 0x4a7a44 : 0xb04a3a)
      .setTitle('$COFFEE Gift')
      .setDescription(
        result.success
          ? successLine
          : `Failed to send ${amount} $COFFEE to ${targetName}.`
      )
      .addFields({
        name: 'Result',
        value: result.success
          ? `Transfer completed via ${result.method === 'project_fallback' ? 'project fallback' : 'member transfer'}.`
          : (result.reason || 'Unknown error').slice(0, 1024),
        inline: false
      });
  }

  buildManualAwardLogEmbed({ targetName, amount, result, actorName, actorId, targetId, reason = null }) {
    const successLine = reason
      ? `<@${actorId}> manually awarded a ${amount} $COFFEE sip to <@${targetId}> for ${reason}`
      : `<@${actorId}> manually awarded a ${amount} $COFFEE sip to <@${targetId}>`;

    const embed = new EmbedBuilder()
      .setColor(result.success ? 0x4a7a44 : 0xb04a3a)
      .setTitle('DRIP Manual Award Receipt')
      .setDescription(
        result.success
          ? successLine
          : `${actorName} attempted to manually award ${amount} $COFFEE to ${targetName}.`
      );

    if (!result.success) {
      embed.addFields(
        {
          name: 'Actor',
          value: `${actorName} (${actorId})`,
          inline: false
        },
        {
          name: 'Recipient',
          value: `${targetName} (${targetId})`,
          inline: false
        },
        {
          name: 'Result',
          value: (result.reason || 'Unknown error').slice(0, 1024),
          inline: false
        }
      );
    }

    return embed;
  }
}

module.exports = {
  DripService
};
