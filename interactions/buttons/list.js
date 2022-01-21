const { embedPage } = require('../../regexes.js');
const utils = require('../../utils.js');
const songlist = require('../../songlist.js');


module.exports = {
  name:'list',

  async execute(interaction, which) {
    const match = interaction.message.embeds[0].fields[1].value.match(embedPage);
    const currentPage = Number(match[1]);
    switch (which) {
    case 'prev': {
      const reply = await utils.generateListEmbed(songlist.list, 'Current Playlist:', (currentPage - 1), false);
      interaction.update(reply);
      break;
    }

    case 'refresh': {
      const reply = await utils.generateListEmbed(songlist.list, 'Current Playlist:', currentPage, false);
      interaction.update(reply);
      break;
    }

    case 'next': {
      const reply = await utils.generateListEmbed(songlist.list, 'Current Playlist:', (currentPage + 1), false);
      interaction.update(reply);
      break;
    }

    default:
      break;
    }
  },
};