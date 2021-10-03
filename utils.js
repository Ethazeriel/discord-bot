const { MessageAttachment } = require('discord.js');

function pickPride(type) {
  const pridearray = ['agender', 'aromantic', 'asexual', 'bigender', 'bisexual', 'demisexual', 'gaymen', 'genderfluid', 'genderqueer', 'intersex', 'lesbian', 'nonbinary', 'pan', 'poly', 'pride', 'trans'];
  const ranpride = pridearray[Math.floor(Math.random() * pridearray.length)];
  const prideStr = 'https://ethazeriel.net/pride/sprites/' + type + '_' + ranpride + '.png';
  return prideStr;
}


async function generateTrackEmbed(interaction, track, messagetitle) {
  const albumart = new MessageAttachment(track.albumart);
  const npEmbed = {
    color: 0x580087,
    author: {
      name: messagetitle,
      icon_url: pickPride('fish'),
    },
    fields: [
      { name: track.title, value: '** **' },
      { name: track.artist, value: '** **', inline: true },
      { name: '\u200b', value: '** **', inline: true },
      { name: track.album, value: '** **', inline: true },
    ],
    thumbnail: {
      url: 'attachment://albumart.jpg',
    },
  };
  await interaction.reply({ embeds: [npEmbed], files: [albumart] });
}


async function generateQueueEmbed(interaction, track, queue, messagetitle, page) {
  const albumart = new MessageAttachment(track.albumart);
  const pages = Math.ceil(queue.length / 10); // this should be the total number of pages? rounding up
  const queuePart = queue.slice((page - 1) * 10, page * 10);
  if (page > pages) {
    await interaction.reply({ content: `Invalid page number ${page}. Please try again.`, ephemeral: true });
  } else {
    let queueStr = '';
    for (let i = 0; i < queuePart.length; i++) {
      const part = '**' + ((page - 1) * 10 + (i + 1)) + '.**' + queuePart[i].artist + ' - ' + queuePart[i].title + '\n';
      queueStr = queueStr.concat(part);
    }
    const queueEmbed = {
      color: 0x3277a8,
      author: {
        name: messagetitle,
        icon_url: pickPride('fish'),
      },
      thumbnail: {
        url: 'attachment://albumart.jpg',
      },
      fields: [
        { name: 'Current Track:', value: `${track.artist} - ${track.title}` },
        { name: 'Next Up:', value: queueStr },
        { name: '\u200b', value: `Page ${page} of ${pages}`, inline: true }, { name: '\u200b', value: `Queue length ${queue.length}`, inline: true },
      ],
    };
    await interaction.reply({ embeds: [queueEmbed], files: [albumart] });
  }
}
exports.generateTrackEmbed = generateTrackEmbed;
exports.pickPride = pickPride;
exports.generateQueueEmbed = generateQueueEmbed;