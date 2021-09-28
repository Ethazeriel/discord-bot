const { MessageAttachment, MessageEmbed } = require('discord.js');

function pickPride(type) {
  const pridearray = ['agender', 'aromantic', 'asexual', 'bigender', 'bisexual', 'demisexual', 'gaymen', 'genderfluid', 'genderqueer', 'intersex', 'lesbian', 'nonbinary', 'pan', 'poly', 'pride', 'trans'];
  const ranpride = pridearray[Math.floor(Math.random() * pridearray.length)];
  const prideStr = 'https://ethazeriel.net/pride/sprites/' + type + '_' + ranpride + '.png';
  return prideStr;
}


async function generateTrackReply(interaction, track, messagetitle) {

  const albumart = new MessageAttachment(track.albumart);
  const npEmbed = new MessageEmbed()
    .setAuthor(messagetitle, pickPride('fish'))
    .setColor('#580087')
    .addFields(
      { name: track.title, value: '** **' },
      { name: track.artist, value: '** **', inline: true },
      { name: '\u200b', value: '** **', inline: true },
      { name: track.album, value: '** **', inline: true },
    )
    .setThumbnail('attachment://albumart.jpg');
  await interaction.reply({ embeds: [npEmbed], files: [albumart] });


}

exports.generateTrackReply = generateTrackReply;
exports.pickPride = pickPride;