const Player = require('../../player.js');
const { logDebug } = require('../../logger.js');

module.exports = {
  name: 'media',

  async execute(interaction, which) {
    (which === 'showqueue') ? await interaction.deferReply({ ephemeral: true }) : await interaction.deferUpdate({ ephemeral: true });
    const player = await Player.getPlayer(interaction);
    if (player) {
      if (player.getQueue().length) {
        switch (which) {
          case 'refresh': break;
          case 'prev': await player.prev(); break;
          case 'pause': await player.togglePause(); break;
          case 'next': await player.next(); break;
          case 'showqueue': /* empty case as is handled through ternaries */ break;
          default: logDebug(`media buttons—bad case: ${which}`); return;
        }
        const embed = (which === 'showqueue') ? await player.queueEmbed('Current Queue:', undefined, false) : await player.mediaEmbed(false);
        const action = (which === 'refresh' || which === 'showqueue') ? (async () => await interaction.editReply(embed)) : (() => player.sync(interaction, 'media', embed));
        await Promise.all([player.register(interaction, (which === 'showqueue') ? 'queue' : 'media', embed), action()]);
      } else { await player.decommission(interaction, 'media', player.mediaEmbed(false), 'Queue is empty.'); }
    }
  },
};