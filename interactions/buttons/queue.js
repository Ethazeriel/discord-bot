const { embedPage } = require('../../regexes.js');
const utils = require('../../utils.js');
const Player = require('../../player.js');

module.exports = {
  name:'queue',

  async execute(interaction, which) {
    const player = await Player.getPlayer(interaction);
    if (player) {
      let match = interaction.message.embeds[0].fields[3]?.value.match(embedPage);
      if (!match) { match = [0, 1]; }
      const currentPage = Number(match[1]);
      switch (which) {
        case 'prev': {
          const reply = await utils.generateQueueEmbed(player, 'Current Queue:', (currentPage - 1), false);
          interaction.update(reply);
          break;
        }

        case 'refresh': {
          const reply = await utils.generateQueueEmbed(player, 'Current Queue:', currentPage, false);
          interaction.update(reply);
          break;
        }

        case 'next': {
          const reply = await utils.generateQueueEmbed(player, 'Current Queue:', (currentPage + 1), false);
          interaction.update(reply);
          break;
        }

        case 'loop': {
          player.toggleLoop();
          const reply = await utils.generateQueueEmbed(player, 'Current Queue:', currentPage, false);
          interaction.update(reply);
          break;
        }

        case 'shuffle': {
          const reply = await utils.generateQueueEmbed(player, 'Current Queue:', currentPage, false);
          interaction.update(reply);
          break;
        }

        default:
          break;
      }
    }
  },
};