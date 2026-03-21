const { EmbedBuilder, PermissionsBitField } = require('discord.js');

const PLAYER_STATS_TABLE = 'fight_player_stats';
const PLAYER_STATS_MONTHLY_TABLE = 'fight_player_stats_monthly';
const VESPA_ROLE_ID = '1428408018709512262';

class LeaderboardService {
  constructor(pool) {
    this.pool = pool;
  }

  async ensureTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${PLAYER_STATS_TABLE} (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        total_games_played INTEGER NOT NULL DEFAULT 0,
        total_wins INTEGER NOT NULL DEFAULT 0,
        total_top3 INTEGER NOT NULL DEFAULT 0,
        total_kills INTEGER NOT NULL DEFAULT 0,
        total_deaths INTEGER NOT NULL DEFAULT 0,
        total_revives INTEGER NOT NULL DEFAULT 0,
        total_vespa_kills INTEGER NOT NULL DEFAULT 0,
        has_vespa_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
        vespa_unlocked_at TIMESTAMPTZ NULL,
        last_played_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (guild_id, user_id)
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${PLAYER_STATS_MONTHLY_TABLE} (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        month_start DATE NOT NULL,
        display_name TEXT NOT NULL,
        total_games_played INTEGER NOT NULL DEFAULT 0,
        total_wins INTEGER NOT NULL DEFAULT 0,
        total_top3 INTEGER NOT NULL DEFAULT 0,
        total_kills INTEGER NOT NULL DEFAULT 0,
        total_deaths INTEGER NOT NULL DEFAULT 0,
        total_revives INTEGER NOT NULL DEFAULT 0,
        total_vespa_kills INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (guild_id, user_id, month_start)
      );
    `);
  }

  async preloadVespaProgress(guildId, userIds) {
    const progress = new Map();

    if (!guildId || userIds.length === 0) {
      return progress;
    }

    const res = await this.pool.query(
      `
        SELECT user_id, total_vespa_kills, has_vespa_unlocked
        FROM ${PLAYER_STATS_TABLE}
        WHERE guild_id = $1 AND user_id = ANY($2::text[])
      `,
      [guildId, userIds]
    );

    for (const row of res.rows) {
      progress.set(row.user_id, {
        totalVespaKills: Number(row.total_vespa_kills) || 0,
        hasVespaUnlocked: Boolean(row.has_vespa_unlocked)
      });
    }

    return progress;
  }

  async markVespaUnlocked(guildId, userId, displayName) {
    const now = new Date();
    await this.pool.query(
      `
        INSERT INTO ${PLAYER_STATS_TABLE} (
          guild_id,
          user_id,
          display_name,
          has_vespa_unlocked,
          vespa_unlocked_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, TRUE, $4, NOW(), NOW())
        ON CONFLICT (guild_id, user_id)
        DO UPDATE SET
          display_name = EXCLUDED.display_name,
          has_vespa_unlocked = TRUE,
          vespa_unlocked_at = COALESCE(${PLAYER_STATS_TABLE}.vespa_unlocked_at, EXCLUDED.vespa_unlocked_at),
          updated_at = NOW()
      `,
      [guildId, userId, displayName, now]
    );
  }

  async recordFightResults(guildId, playerResults) {
    const humanResults = playerResults.filter(player => !player.isBot);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    for (const player of humanResults) {
      const won = player.placement === 1 ? 1 : 0;
      const top3 = player.placement && player.placement <= 3 ? 1 : 0;
      const hasVespaUnlock = player.vespaKills > 0;

      await this.pool.query(
        `
          INSERT INTO ${PLAYER_STATS_TABLE} (
            guild_id,
            user_id,
            display_name,
            total_games_played,
            total_wins,
            total_top3,
            total_kills,
            total_deaths,
            total_revives,
            total_vespa_kills,
            has_vespa_unlocked,
            vespa_unlocked_at,
            last_played_at,
            updated_at
          )
          VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
          ON CONFLICT (guild_id, user_id)
          DO UPDATE SET
            display_name = EXCLUDED.display_name,
            total_games_played = ${PLAYER_STATS_TABLE}.total_games_played + EXCLUDED.total_games_played,
            total_wins = ${PLAYER_STATS_TABLE}.total_wins + EXCLUDED.total_wins,
            total_top3 = ${PLAYER_STATS_TABLE}.total_top3 + EXCLUDED.total_top3,
            total_kills = ${PLAYER_STATS_TABLE}.total_kills + EXCLUDED.total_kills,
            total_deaths = ${PLAYER_STATS_TABLE}.total_deaths + EXCLUDED.total_deaths,
            total_revives = ${PLAYER_STATS_TABLE}.total_revives + EXCLUDED.total_revives,
            total_vespa_kills = ${PLAYER_STATS_TABLE}.total_vespa_kills + EXCLUDED.total_vespa_kills,
            has_vespa_unlocked = ${PLAYER_STATS_TABLE}.has_vespa_unlocked OR EXCLUDED.has_vespa_unlocked,
            vespa_unlocked_at = COALESCE(${PLAYER_STATS_TABLE}.vespa_unlocked_at, EXCLUDED.vespa_unlocked_at),
            last_played_at = EXCLUDED.last_played_at,
            updated_at = NOW()
        `,
        [
          guildId,
          player.id,
          player.name,
          won,
          top3,
          player.kills,
          player.deaths,
          player.revives,
          player.vespaKills,
          hasVespaUnlock,
          hasVespaUnlock ? now : null,
          now
        ]
      );

      await this.pool.query(
        `
          INSERT INTO ${PLAYER_STATS_MONTHLY_TABLE} (
            guild_id,
            user_id,
            month_start,
            display_name,
            total_games_played,
            total_wins,
            total_top3,
            total_kills,
            total_deaths,
            total_revives,
            total_vespa_kills,
            updated_at
          )
          VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (guild_id, user_id, month_start)
          DO UPDATE SET
            display_name = EXCLUDED.display_name,
            total_games_played = ${PLAYER_STATS_MONTHLY_TABLE}.total_games_played + EXCLUDED.total_games_played,
            total_wins = ${PLAYER_STATS_MONTHLY_TABLE}.total_wins + EXCLUDED.total_wins,
            total_top3 = ${PLAYER_STATS_MONTHLY_TABLE}.total_top3 + EXCLUDED.total_top3,
            total_kills = ${PLAYER_STATS_MONTHLY_TABLE}.total_kills + EXCLUDED.total_kills,
            total_deaths = ${PLAYER_STATS_MONTHLY_TABLE}.total_deaths + EXCLUDED.total_deaths,
            total_revives = ${PLAYER_STATS_MONTHLY_TABLE}.total_revives + EXCLUDED.total_revives,
            total_vespa_kills = ${PLAYER_STATS_MONTHLY_TABLE}.total_vespa_kills + EXCLUDED.total_vespa_kills,
            updated_at = NOW()
        `,
        [
          guildId,
          player.id,
          monthStart,
          player.name,
          won,
          top3,
          player.kills,
          player.deaths,
          player.revives,
          player.vespaKills
        ]
      );
    }
  }

  async getGlobalLeaderboard(guildId, limit = 10) {
    const res = await this.pool.query(
      `
        SELECT user_id, display_name, total_wins, total_top3, total_kills, total_vespa_kills, total_games_played
        FROM ${PLAYER_STATS_TABLE}
        WHERE guild_id = $1
        ORDER BY total_wins DESC, total_top3 DESC, total_kills DESC, total_games_played DESC, updated_at ASC
        LIMIT $2
      `,
      [guildId, limit]
    );

    return res.rows;
  }

  async getMonthlyGlobalLeaderboard(guildId, monthStart, limit = 10) {
    const res = await this.pool.query(
      `
        SELECT user_id, display_name, total_wins, total_top3, total_kills, total_vespa_kills, total_games_played
        FROM ${PLAYER_STATS_MONTHLY_TABLE}
        WHERE guild_id = $1 AND month_start = $2
        ORDER BY total_wins DESC, total_top3 DESC, total_kills DESC, total_games_played DESC, updated_at ASC
        LIMIT $3
      `,
      [guildId, monthStart, limit]
    );

    return res.rows;
  }

  async getVespaLeaderboard(guildId, limit = 10) {
    const res = await this.pool.query(
      `
        SELECT user_id, display_name, total_vespa_kills, total_wins, total_kills, has_vespa_unlocked
        FROM ${PLAYER_STATS_TABLE}
        WHERE guild_id = $1 AND (total_vespa_kills >= 1 OR has_vespa_unlocked = TRUE)
        ORDER BY total_vespa_kills DESC, total_wins DESC, total_kills DESC, updated_at ASC
        LIMIT $2
      `,
      [guildId, limit]
    );

    return res.rows;
  }

  async resetVespaProgress(guildId) {
    const res = await this.pool.query(
      `
        UPDATE ${PLAYER_STATS_TABLE}
        SET
          total_vespa_kills = 0,
          has_vespa_unlocked = FALSE,
          vespa_unlocked_at = NULL,
          updated_at = NOW()
        WHERE guild_id = $1
          AND (
            total_vespa_kills <> 0
            OR has_vespa_unlocked = TRUE
            OR vespa_unlocked_at IS NOT NULL
          )
      `,
      [guildId]
    );

    return res.rowCount;
  }

  buildGlobalLeaderboardEmbed(rows, label = 'All Time') {
    const description = rows.length > 0
      ? rows.map((row, index) => `**#${index + 1} ${row.display_name}** - ${row.total_wins} wins | ${row.total_top3} top 3 | ${row.total_kills} kills | ${row.total_vespa_kills} vespa kills`).join('\n')
      : 'No fight records yet.';

    return new EmbedBuilder()
      .setColor(0x6b4f2a)
      .setTitle('Global Fight Leaderboard')
      .setDescription(description)
      .setFooter({ text: label });
  }

  buildVespaLeaderboardEmbed(rows) {
    const description = rows.length > 0
      ? rows.map((row, index) => `**#${index + 1} ${row.display_name}** - ${row.total_vespa_kills} vespa kills | ${row.total_wins} wins | ${row.total_kills} kills`).join('\n')
      : 'No one has unlocked the Vespa tier yet.';

    return new EmbedBuilder()
      .setColor(0x8f6a3a)
      .setTitle('Vespa Leaderboard')
      .setDescription(description)
      .setFooter({ text: 'Unlocked at 1 lifetime Vespa kill' });
  }

  buildVespaUnlockEmbed(playerName) {
    return new EmbedBuilder()
      .setColor(0xd4af37)
      .setTitle('VESPA TIER UNLOCKED')
      .setDescription(`${playerName} has entered the Vespa Killer ranks and now qualifies for the Vespa Leaderboard.`);
  }

  buildVespaResetEmbed(roleRemovalCount, recordResetCount, roleFound) {
    const roleLine = roleFound
      ? `Members who lost the Vespa Killer role: ${roleRemovalCount}`
      : 'Vespa Killer role not found. Stats were still reset.';

    return new EmbedBuilder()
      .setColor(0x7a7a7a)
      .setTitle('Vespa System Reset')
      .setDescription('Removed the Vespa Killer role from all members and reset all Vespa leaderboard progress.')
      .addFields(
        { name: 'Role Removal', value: roleLine, inline: false },
        { name: 'Player Records Reset', value: `${recordResetCount}`, inline: true }
      );
  }

  async assignVespaRole(guild, userId) {
    const role = guild.roles.cache.get(VESPA_ROLE_ID)
      || await guild.roles.fetch(VESPA_ROLE_ID).catch(() => null);

    if (!role) {
      return { assigned: false, reason: 'missing_role' };
    }

    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!me || !me.permissions.has(PermissionsBitField.Flags.ManageRoles) || role.position >= me.roles.highest.position) {
      return { assigned: false, reason: 'missing_permissions' };
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return { assigned: false, reason: 'missing_member' };
    }

    if (!member.roles.cache.has(role.id)) {
      await member.roles.add(role).catch(() => null);
    }

    return { assigned: true, reason: null };
  }

  async removeVespaRoleFromEveryone(guild) {
    const role = guild.roles.cache.get(VESPA_ROLE_ID)
      || await guild.roles.fetch(VESPA_ROLE_ID).catch(() => null);

    if (!role) {
      return { removed: 0, roleFound: false };
    }

    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!me || !me.permissions.has(PermissionsBitField.Flags.ManageRoles) || role.position >= me.roles.highest.position) {
      return { removed: 0, roleFound: true };
    }

    await guild.members.fetch().catch(() => null);

    let removed = 0;
    for (const member of role.members.values()) {
      await member.roles.remove(role).catch(() => null);
      removed += 1;
    }

    return { removed, roleFound: true };
  }
}

module.exports = {
  LeaderboardService
};
