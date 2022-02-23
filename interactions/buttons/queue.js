const { embedPage } = require('../../regexes.js');
const utils = require('../../utils.js');
const Player = require('../../player.js');
const { logDebug } = require('../../logger.js');

module.exports = {
  name:'queue',

  async execute(interaction, which) {
    await interaction.deferUpdate({ ephemeral: true });
    const player = await Player.getPlayer(interaction);
    if (player) {
      if (player.getQueue().length) {
        const match = interaction.message.embeds[0].fields[3]?.value.match(embedPage);
        let page = (match) ? Number(match[1]) : 1;
        switch (which) {
          case 'prev': page--; break;
          case 'refresh': break;
          case 'next': page++; break;
          case 'loop': player.toggleLoop(); break;
          case 'shuffle': player.shuffle(); break;
          default: logDebug(`queue buttons—bad case: ${which}`); return;
        }
        const embed = await utils.generateQueueEmbed(player, 'Current Queue:', page, false);
        const action = (which === 'loop' || which === 'shuffle') ? (() => player.sync(interaction, 'queue', embed)) : (async () => await interaction.editReply(embed));
        await Promise.all([player.register(interaction, 'queue', embed), action()]);
      } else { player.decommission(interaction, 'queue', await utils.generateQueueEmbed(player), 'Queue is empty.'); }
    }
  },
};