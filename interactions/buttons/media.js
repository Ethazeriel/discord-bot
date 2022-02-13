const utils = require('../../utils.js');
// const music = require('../../music.js');
const Player = require('../../player.js');
// const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));


module.exports = {
  name: 'media',

  async execute(interaction, which) {
    const player = await Player.getPlayer(interaction);
    if (player) {
      switch (which) {
        case 'prev': {
          if (player.getQueue().length) { await player.prev(); }
          interaction.update(utils.mediaEmbed(player, false));
          break;
        }

        case 'pause': {
          if (player.getQueue().length) { await player.togglePause(); }
          interaction.update(utils.mediaEmbed(player, false));
          break;
        }

        case 'next': {
          if (player.getQueue().length) { await player.next(); }
          interaction.update(utils.mediaEmbed(player, false));
          break;
        }

        case 'refresh': {
          interaction.update(utils.mediaEmbed(player, false));
          break;
        }

        default:
          break;
      }
    }
  },
};