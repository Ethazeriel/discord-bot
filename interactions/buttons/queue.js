const { embedPage } = require('../../regexes.js');
const utils = require('../../utils.js');
const music = require('../../music.js');
const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));


module.exports = {
  name:'queue',

  async execute(interaction, which) {
    let match = interaction.message.embeds[0].fields[2]?.value.match(embedPage);
    if (!match) { match = [0, 1]; }
    const currentPage = Number(match[1]);
    switch (which) {
    case 'prev': {
      const reply = await utils.generateQueueEmbed(music.getCurrentTrack(), music.queue, 'Current Queue:', (currentPage - 1), false);
      interaction.update(reply);
      break;
    }

    case 'refresh': {
      const reply = await utils.generateQueueEmbed(music.getCurrentTrack(), music.queue, 'Current Queue:', currentPage, false);
      interaction.update(reply);
      break;
    }

    case 'next': {
      const reply = await utils.generateQueueEmbed(music.getCurrentTrack(), music.queue, 'Current Queue:', (currentPage + 1), false);
      interaction.update(reply);
      break;
    }

    case 'loop': {
      music.toggleLoop();
      await sleep(100);
      const reply = await utils.generateQueueEmbed(music.getCurrentTrack(), music.queue, 'Current Queue:', currentPage, false);
      interaction.update(reply);
      break;
    }

    case 'shuffle': {
      const reply = await utils.generateQueueEmbed(music.getCurrentTrack(), music.queue, 'Current Queue:', currentPage, false);
      interaction.update(reply);
      break;
    }

    default:
      break;
    }
  },
};