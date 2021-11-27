const { MessageAttachment } = require('discord.js');
const music = require('./music.js');
const { logLine } = require('./logger.js');

function pickPride(type) {
  const pridearray = ['agender', 'aromantic', 'asexual', 'bigender', 'bisexual', 'demisexual', 'gaymen', 'genderfluid', 'genderqueer', 'intersex', 'lesbian', 'nonbinary', 'pan', 'poly', 'pride', 'trans'];
  let ranpride = pridearray[Math.floor(Math.random() * pridearray.length)];
  if (ranpride == 'pride') {
    const pridearray2 = ['pride', 'progressive', 'poc'];
    ranpride = pridearray2[Math.floor(Math.random() * pridearray2.length)];
  }
  const prideStr = 'https://ethazeriel.net/pride/sprites/' + type + '_' + ranpride + '.png';
  return prideStr;
}


async function generateTrackEmbed(interaction, track, messagetitle) {
  const albumart = new MessageAttachment((track.spotify.art || track.youtube.art), 'art.jpg');
  const npEmbed = {
    color: 0x580087,
    author: {
      name: messagetitle,
      icon_url: pickPride('fish'),
    },
    fields: [
      { name: (track.spotify.name || track.youtube.name), value: '** **' },
      { name: (track.artist.name || '\u200b'), value: '** **', inline: true },
      { name: '\u200b', value: '** **', inline: true },
      { name: (track.album.name || '\u200b'), value: '** **', inline: true },
    ],
    thumbnail: {
      url: 'attachment://art.jpg',
    },
  };
  try {
    await interaction.followUp({ embeds: [npEmbed], files: [albumart] });
  } catch (error) {
    logLine('error', [error.stack]);
  }
}


async function generateQueueEmbed(interaction, track, queue, messagetitle, page) {
  const albumart = new MessageAttachment((track.spotify.art || track.youtube.art), 'art.jpg');
  const pages = Math.ceil(queue.length / 10); // this should be the total number of pages? rounding up
  const queuePart = queue.slice((page - 1) * 10, page * 10);
  if (page > pages) {
    await interaction.followUp({ content: `Invalid page number ${page}. Please try again.`, ephemeral: true });
  } else {
    let queueStr = '';
    for (let i = 0; i < queuePart.length; i++) {
      const part = '**' + ((page - 1) * 10 + (i + 1)) + '.   **' + (queuePart[i].artist.name || ' ') + ' - ' + (queuePart[i].spotify.name || queuePart[i].youtube.name) + '\n';
      queueStr = queueStr.concat(part);
    }
    const queueEmbed = {
      color: 0x3277a8,
      author: {
        name: messagetitle,
        icon_url: pickPride('fish'),
      },
      thumbnail: {
        url: 'attachment://art.jpg',
      },
      fields: [
        { name: 'Current Track:', value: `${(track.artist.name || ' ')} - ${(track.spotify.name || track.youtube.name)}` },
        { name: 'Next Up:', value: queueStr },
        { name: '\u200b', value: `Page ${page} of ${pages}`, inline: true }, { name: '\u200b', value: `Queue length: ${queue.length} tracks`, inline: true },
        { name: `Loop Status: ${music.getLoop()}`, value: '** **' },
      ],
    };
    try {
      await interaction.followUp({ embeds: [queueEmbed], files: [albumart] });
    } catch (error) {
      logLine('error', [error.stack]);
    }
  }
}


async function generateListEmbed(interaction, queue, messagetitle, page) {
  const pages = Math.ceil(queue.length / 10); // this should be the total number of pages? rounding up
  const queuePart = queue.slice((page - 1) * 10, page * 10);
  if (page > pages) {
    await interaction.followUp({ content: `Invalid page number ${page}. Please try again.`, ephemeral: true });
  } else {
    let queueStr = '';
    for (let i = 0; i < queuePart.length; i++) {
      const part = '**' + ((page - 1) * 10 + (i + 1)) + '.   **' + (queuePart[i].artist.name || ' ') + ' - ' + (queuePart[i].spotify.name || queuePart[i].youtube.name) + '\n';
      queueStr = queueStr.concat(part);
    }
    const queueEmbed = {
      color: 0x3277a8,
      author: {
        name: messagetitle,
        icon_url: pickPride('fish'),
      },
      thumbnail: {
        url: pickPride('dab'),
      },
      fields: [
        { name: 'Horse:', value: queueStr },
        { name: '\u200b', value: `Page ${page} of ${pages}`, inline: true }, { name: '\u200b', value: `Playlist length: ${queue.length} tracks`, inline: true },
      ],
    };
    try {
      await interaction.followUp({ embeds: [queueEmbed] });
    } catch (error) {
      logLine('error', [error.stack]);
    }
  }
}


exports.generateTrackEmbed = generateTrackEmbed;
exports.pickPride = pickPride;
exports.generateQueueEmbed = generateQueueEmbed;
exports.generateListEmbed = generateListEmbed;