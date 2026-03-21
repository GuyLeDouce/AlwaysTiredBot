const { EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

const DRIP_API_BASE = 'https://api.drip.re/api/v1';

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
  constructor({ apiToken, realmId, clientId, currencyId, logChannelId = null }) {
    this.apiToken = apiToken;
    this.realmId = realmId;
    this.clientId = clientId;
    this.currencyId = currencyId;
    this.logChannelId = logChannelId;
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

  async fetchJsonWithFallback(candidates, options) {
    let lastError = null;

    for (const url of candidates) {
      try {
        const response = await fetch(url, options);
        const data = await response.json().catch(() => ({}));

        if (response.ok) {
          return { response, data, url };
        }

        lastError = new Error(data?.message || `HTTP ${response.status}`);
        lastError.status = response.status;
        lastError.data = data;

        // Keep trying only when the route itself looks wrong.
        if (response.status !== 404) {
          throw lastError;
        }
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('DRIP request failed');
  }

  async searchMemberByDiscordId(discordId) {
    const query = `type=discord-id&values=${encodeURIComponent(discordId)}`;
    const { data } = await this.fetchJsonWithFallback(
      [
        `${DRIP_API_BASE}/realm/${this.realmId}/members/search?${query}`,
        `${DRIP_API_BASE}/realms/${this.realmId}/members/search?${query}`
      ],
      { headers: this.getHeaders() }
    );

    return data?.data?.[0] || null;
  }

  resolveCoffeeCurrencyId() {
    if (!this.currencyId) {
      throw new Error('DRIP_CURRENCY_ID is missing. It is required as the $COFFEE currency identifier.');
    }

    return this.currencyId;
  }

  async awardTokensToMemberId(memberId, tokens) {
    const currencyId = this.resolveCoffeeCurrencyId();

    try {
      const { data } = await this.fetchJsonWithFallback(
        [
          `${DRIP_API_BASE}/realms/${this.realmId}/members/${memberId}/balance`
        ],
        {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify({
            amount: tokens,
            currencyId
          })
        }
      );

      return data;
    } catch (balanceError) {
      const { data } = await this.fetchJsonWithFallback(
        [
          `${DRIP_API_BASE}/realm/${this.realmId}/members/${memberId}/point-balance`,
          `${DRIP_API_BASE}/realms/${this.realmId}/members/${memberId}/point-balance`
        ],
        {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify({
            tokens,
            realmPointId: currencyId
          })
        }
      );

      return data;
    }
  }

  async awardTokensByDiscordId(discordId, tokens) {
    const member = await this.searchMemberByDiscordId(discordId);
    if (!member) {
      return {
        success: false,
        reason: 'member_not_found',
        discordId,
        displayName: null,
        tokens
      };
    }

    await this.awardTokensToMemberId(member.id, tokens);
    return {
      success: true,
      reason: null,
      discordId,
      dripMemberId: member.id,
      displayName: member.displayName || member.username || discordId,
      tokens
    };
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

    return this.awardTokensByDiscordId(discordId, tokens).catch(error => ({
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

      const result = await this.awardTokensByDiscordId(award.player.id, award.tokens).catch(error => ({
        success: false,
        reason: error.message,
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
      vespaResult = await this.awardTokensByDiscordId(plan.vespaAward.player.id, plan.vespaAward.tokens)
        .then(result => ({
          player: plan.vespaAward.player,
          tokens: plan.vespaAward.tokens,
          ...result
        }))
        .catch(error => ({
          player: plan.vespaAward.player,
          tokens: plan.vespaAward.tokens,
          success: false,
          reason: error.message,
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
    const failures = [
      ...(payout.podiumResults || []).filter(result => result.success === false),
      ...(payout.vespaResult && payout.vespaResult.success === false ? [payout.vespaResult] : [])
    ];

    const successCount = [
      ...(payout.podiumResults || []).filter(result => result.success === true),
      ...(payout.vespaResult && payout.vespaResult.success === true ? [payout.vespaResult] : [])
    ].length;

    const failureText = failures.length > 0
      ? failures
        .map(result => `${result.player?.name || result.displayName || result.discordId}: ${result.reason || 'unknown error'}`)
        .join('\n')
        .slice(0, 1024)
      : 'No payout errors.';

    return new EmbedBuilder()
      .setColor(failures.length > 0 ? 0xb04a3a : 0x4a7a44)
      .setTitle('DRIP Payout Receipt')
      .setDescription(
        payout.enabled
          ? `Processed a $COFFEE payout for ${Math.floor(payout.totalPrizePool / 15)} real player joins.`
          : 'DRIP payout was skipped because DRIP is not configured.'
      )
      .addFields(
        {
          name: 'Summary',
          value: `Successful awards: ${successCount}\nFailed awards: ${failures.length}`,
          inline: true
        },
        {
          name: 'Prize Pool',
          value: `Total: ${payout.totalPrizePool} $COFFEE\nPodium: ${payout.podiumPool} $COFFEE\nVespa: ${payout.vespaPool} $COFFEE`,
          inline: true
        },
        {
          name: 'Errors',
          value: failureText,
          inline: false
        }
      );
  }

  async testConnection() {
    if (!this.isConfigured()) {
      return {
        ok: false,
        reason: 'missing_config',
        message: 'DRIP_API_TOKEN or DRIP_REALM_ID is missing.'
      };
    }

    if (!this.currencyId) {
      return {
        ok: false,
        reason: 'missing_currency',
        message: 'DRIP_CURRENCY_ID is missing.'
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
          name: 'Currency ID',
          value: this.currencyId || 'Not configured',
          inline: true
        },
        {
          name: 'Result',
          value: result.message.slice(0, 1024),
          inline: false
        }
      );
  }

  buildManualAwardEmbed({ targetName, amount, result, actorName }) {
    return new EmbedBuilder()
      .setColor(result.success ? 0x4a7a44 : 0xb04a3a)
      .setTitle('$COFFEE Gift')
      .setDescription(
        result.success
          ? `${actorName} sent ${amount} $COFFEE to ${targetName}.`
          : `Failed to send ${amount} $COFFEE to ${targetName}.`
      )
      .addFields({
        name: 'Result',
        value: result.success ? 'Points awarded successfully.' : (result.reason || 'Unknown error').slice(0, 1024),
        inline: false
      });
  }

  buildManualAwardLogEmbed({ targetName, amount, result, actorName, actorId, targetId }) {
    return new EmbedBuilder()
      .setColor(result.success ? 0x4a7a44 : 0xb04a3a)
      .setTitle('DRIP Manual Award Receipt')
      .setDescription(
        result.success
          ? `${actorName} manually awarded ${amount} $COFFEE to ${targetName}.`
          : `${actorName} attempted to manually award ${amount} $COFFEE to ${targetName}.`
      )
      .addFields(
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
          value: result.success ? 'Points awarded successfully.' : (result.reason || 'Unknown error').slice(0, 1024),
          inline: false
        }
      );
  }
}

module.exports = {
  DripService
};
