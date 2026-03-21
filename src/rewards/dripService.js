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
  constructor({ apiToken, realmId, clientId, logChannelId = null }) {
    this.apiToken = apiToken;
    this.realmId = realmId;
    this.clientId = clientId;
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

  async searchMemberByDiscordId(discordId) {
    const url = `${DRIP_API_BASE}/realm/${this.realmId}/members/search?type=discord-id&values=${encodeURIComponent(discordId)}`;
    const response = await fetch(url, { headers: this.getHeaders() });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || `DRIP member search failed with status ${response.status}`);
    }

    return data?.data?.[0] || null;
  }

  async awardTokensToMemberId(memberId, tokens) {
    const body = { tokens };
    if (this.clientId) {
      body.clientId = this.clientId;
    }

    const response = await fetch(
      `${DRIP_API_BASE}/realm/${this.realmId}/members/${memberId}/point-balance`,
      {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      }
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || `DRIP point award failed with status ${response.status}`);
    }

    return data;
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
}

module.exports = {
  DripService
};
