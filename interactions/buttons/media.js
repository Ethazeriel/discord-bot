const Player = require('../../player.js');
const { logDebug } = require('../../logger.js');

module.exports = {
  name: 'media',

  async execute(interaction, which) {
    await interaction.deferUpdate({ ephemeral: true });
    const player = await Player.getPlayer(interaction);
    if (player) {
      if (player.getQueue().length) {
        switch (which) {
          case 'refresh': break;
          case 'prev': await player.prev(); break;
          case 'pause': await player.togglePause(); break;
          case 'next': await player.next(); break;
          case 'showqueue': break;
          default: logDebug(`media buttons—bad case: ${which}`); return;
        }
        const embed = player.mediaEmbed(false);
        const action = (which === 'refresh') ? (async () => await interaction.editReply(embed)) : (() => player.sync(interaction, 'media', embed));
        await Promise.all([player.register(interaction, 'media', embed), action()]);
      } else { await player.decommission(interaction, 'media', player.mediaEmbed(false), 'Queue is empty.'); }
    }
  },
};