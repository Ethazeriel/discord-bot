const { MessageAttachment } = require('discord.js');
const { logLine } = require('./logger.js');
const Canvas = require('canvas');
const db = require('./database.js');

function progressBar(size, duration, playhead, { start, end, barbefore, barafter, head } = {}) {
  start ??= '|';
  end ??= '|';
  barbefore ??= '-';
  barafter ??= '-';
  head ??= '0';
  let result = '';
  const playperc = (playhead / duration > 1) ? 1 : (playhead / duration);
  let before = parseInt((size - 2) * playperc) || 0;
  let after = parseInt((size - 2) * (1 - playperc)) || 0;
  while ((before + after + 1) > (size - 2)) { (before < after) ? after-- : before--; }
  while ((before + after + 1) < (size - 2)) { (before < after) ? before++ : after++; }
  result = result.concat(start);
  for (let i = 0; i < before; i++) { result = result.concat(barbefore); }
  result = result.concat(head);
  for (let i = 0; i < after; i++) { result = result.concat(barafter); }
  result = result.concat(end);
  return result;
}

function pickPride(type, detail) {
  const pridearray = ['agender', 'aromantic', 'asexual', 'bigender', 'bisexual', 'demisexual', 'gaymen', 'genderfluid', 'genderqueer', 'intersex', 'lesbian', 'nonbinary', 'pan', 'poly', 'pride', 'trans'];
  let ranpride = pridearray[Math.floor(Math.random() * pridearray.length)];
  if (ranpride == 'pride') {
    const pridearray2 = ['pride', 'progressive', 'poc'];
    ranpride = pridearray2[Math.floor(Math.random() * pridearray2.length)];
  }
  const prideStr = 'https://ethazeriel.net/pride/sprites/' + type + '_' + ranpride + '.png';
  if (detail === true) {
    return {
      url:prideStr,
      name:ranpride,
    };
  }
  return prideStr;
}

async function prideSticker(interaction, type) {
  const size = {
    heart:{ width:160, height:160 },
    dab:{ width:160, height:100 },
    fish:{ width:160, height:160 },
  };
  const prideChoice = interaction.options.getString('type');
  const canvas = Canvas.createCanvas(size[type].width, size[type].height);
  const context = canvas.getContext('2d');
  let result;
  if (prideChoice == 'random') {
    result = pickPride(type, true);
  } else {
    result = {
      url:`https://ethazeriel.net/pride/sprites/${type}_${prideChoice}.png`,
      name:prideChoice,
    };
  }
  const prideimg = await Canvas.loadImage(result.url);
  context.drawImage(prideimg, 0, 0, canvas.width, canvas.height);
  const attachment = new MessageAttachment(canvas.toBuffer(), `${type}_${result.name}.png`).setDescription(`${result.name} ${type}`);
  // console.log(attachment.description);
  await interaction.reply({ files: [attachment] });

}

function timeDisplay(seconds) {
  return new Date(seconds * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '');
}

// =================================
//               EMBEDS
// =================================

async function generateTrackEmbed(track, messagetitle) {
  const albumart = new MessageAttachment((track.spotify.art || track.youtube.art), 'art.jpg');
  const npEmbed = {
    color: 0x580087,
    author: {
      name: '\u200b',
      icon_url: pickPride('fish'),
    },
    fields: [
      { name: messagetitle, value: `${(track.artist.name || ' ')} - [${(track.spotify.name || track.youtube.name)}](https://youtube.com/watch?v=${track.youtube.id})\nAlbum - ${track.album.name || '\u200b'}` },
    ],
    thumbnail: {
      url: 'attachment://art.jpg',
    },
  };
  try {
    return { embeds: [npEmbed], files: [albumart] };
  } catch (error) {
    logLine('error', [error.stack]);
  }
}


async function generateQueueEmbed(player, messagetitle, page, fresh = true) {
  const track = player.getCurrent();
  const queue = player.getQueue();
  page = Math.abs(page) || 1;
  const albumart = fresh ? new MessageAttachment((track.spotify.art || track.youtube.art), 'art.jpg') : null;
  const pages = Math.ceil(queue.length / 10); // this should be the total number of pages? rounding up
  if (pages === 0) {
    return fresh ? { embeds: [{ color: 0xfc1303, title: 'Nothing to show!', thumbnail: { url: 'attachment://art.jpg' } }], files: [albumart], ephemeral: true } : { embeds: [{ color: 0xfc1303, title: 'Nothing to show!', thumbnail: { url: 'attachment://art.jpg' } }], ephemeral: true };
  }
  if (page > pages) {
    page = pages;
  }
  const queuePart = queue.slice((page - 1) * 10, page * 10);
  let queueStr = '';
  for (let i = 0; i < queuePart.length; i++) {
    const songNum = ((page - 1) * 10 + (i + 1));
    const dbtrack = await db.getTrack({ 'goose.id':queuePart[i].goose.id });
    const part = `**${songNum}.** ${((songNum - 1) == player.getPlayhead()) ? '**' : ''}${(dbtrack.artist.name || ' ')} - [${(dbtrack.spotify.name || dbtrack.youtube.name)}](https://youtube.com/watch?v=${dbtrack.youtube.id}) - ${timeDisplay(dbtrack.youtube.duration)}${((songNum - 1) == player.getPlayhead()) ? '**' : ''} \n`;
    queueStr = queueStr.concat(part);
  }
  let queueTime = 0;
  for (const item of queue) {
    queueTime = queueTime + Number(item.youtube.duration || item.spotify.duration);
  }
  let elapsedTime = 0;
  for (const [i, item] of queue.entries()) {
    if (i < player.getPlayhead()) {
      elapsedTime = elapsedTime + Number(item.youtube.duration || item.spotify.duration);
    } else { break;}
  }
  const bar = {
    start: track.goose?.bar?.start || '[',
    end: track.goose?.bar?.end || ']',
    barbefore: track.goose?.bar?.barbefore || '#',
    barafter: track.goose?.bar?.barafter || '-',
    head: track.goose?.bar?.head || '#',
  };
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
      { name: 'Now Playing:', value: `**${player.getPlayhead() + 1}. **${(track.artist.name || ' ')} - [${(track.spotify.name || track.youtube.name)}](https://youtube.com/watch?v=${track.youtube.id}) - ${timeDisplay(track.youtube.duration)}` },
      { name: 'Queue:', value: queueStr },
      { name: '\u200b', value: `Loop: ${player.getLoop() ? '🟢' : '🟥'}`, inline: true },
      { name: '\u200b', value: `Page ${page} of ${pages}`, inline: true },
      { name: '\u200b', value: `${queue.length} tracks`, inline: true },
      { name: `\` ${progressBar(45, queueTime, elapsedTime, bar)} \``, value: `Elapsed: ${timeDisplay(elapsedTime)} | Total: ${timeDisplay(queueTime)}` },
    ],
  };
  const buttonEmbed = [
    {
      'type': 1,
      'components': [
        {
          'type': 2,
          'custom_id': 'queue-prev',
          'style':2,
          'label':'Previous',
          'disabled': (page === 1) ? true : false,
        },
        {
          'type': 2,
          'custom_id': 'queue-refresh',
          'style':1,
          'label':'Refresh',
        },
        {
          'type': 2,
          'custom_id': 'queue-next',
          'style':2,
          'label':'Next',
          'disabled': (page === pages) ? true : false,
        },
      ],
    },
    {
      'type': 1,
      'components': [
        {
          'type': 2,
          'custom_id': 'queue-loop',
          'style':(player.getLoop()) ? 4 : 3,
          'label':(player.getLoop()) ? 'Disable loop' : 'Enable loop',
        },
        {
          'type': 2,
          'custom_id': 'queue-shuffle',
          'style':1,
          'label':'Shuffle',
          'disabled': true,
        },
      ],
    },
  ];
  return fresh ? { embeds: [queueEmbed], components: buttonEmbed, files: [albumart] } : { embeds: [queueEmbed], components: buttonEmbed };
}


async function generateListEmbed(queue, messagetitle, page, fresh = true) {
  page = Math.abs(page) || 1;
  const thumb = fresh ? (new MessageAttachment(pickPride('dab'), 'thumb.jpg')) : null;
  const pages = Math.ceil(queue.length / 10); // this should be the total number of pages? rounding up
  if (pages === 0) {
    return fresh ? { embeds: [{ color: 0xfc1303, title: 'Nothing to show!', thumbnail: { url: 'attachment://thumb.jpg' } }], files: [thumb], ephemeral: true } : { embeds: [{ color: 0xfc1303, title: 'Nothing to show!', thumbnail: { url: 'attachment://thumb.jpg' } }], ephemeral: true };
  }
  if (page > pages) {
    page = pages;
  }
  const queuePart = queue.slice((page - 1) * 10, page * 10);
  let queueStr = '';
  for (let i = 0; i < queuePart.length; i++) {
    const part = `**${((page - 1) * 10 + (i + 1))}. **${(queuePart[i].artist.name || ' ')} - [${(queuePart[i].spotify.name || queuePart[i].youtube.name)}](https://youtube.com/watch?v=${queuePart[i].youtube.id}) - ${timeDisplay(queuePart[i].youtube.duration)} \n`;
    queueStr = queueStr.concat(part);
  }
  let queueTime = 0;
  for (const item of queue) {
    queueTime = queueTime + Number(item.youtube.duration || item.spotify.duration);
  }
  const queueEmbed = {
    color: 0x3277a8,
    author: {
      name: messagetitle,
      icon_url: pickPride('fish'),
    },
    thumbnail: {
      url: 'attachment://thumb.jpg',
    },
    fields: [
      { name: 'Horse:', value: queueStr },
      { name: '\u200b', value: `Page ${page} of ${pages}`, inline: true },
      { name: '\u200b', value: `Playlist length: ${queue.length} tracks`, inline: true },
      { name: '\u200b', value: `Duration: ${timeDisplay(queueTime)}`, inline: true },
    ],
  };
  const buttonEmbed = [
    {
      'type': 1,
      'components': [
        {
          'type': 2,
          'custom_id': 'list-prev',
          'style':2,
          'label':'Previous',
          'disabled': (page === 1) ? true : false,
        },
        {
          'type': 2,
          'custom_id': 'list-refresh',
          'style':1,
          'label':'Refresh',
        },
        {
          'type': 2,
          'custom_id': 'list-next',
          'style':2,
          'label':'Next',
          'disabled': (page === pages) ? true : false,
        },
      ],
    },
  ];
  return fresh ? { embeds: [queueEmbed], components: buttonEmbed, files: [thumb] } : { embeds: [queueEmbed], components: buttonEmbed };
}

function mediaEmbed(player, fresh = true) {
  const thumb = fresh ? (new MessageAttachment(pickPride('dab'), 'thumb.jpg')) : null;
  const track = player.getCurrent();
  const embed = {
    color: 0x3277a8,
    author: {
      name: 'Current Track:',
      icon_url: pickPride('fish'),
    },
    thumbnail: {
      url: 'attachment://thumb.jpg',
    },
    fields: [
      { name: '\u200b', value: (track) ? `${(track.artist.name || ' ')} - [${(track.spotify.name || track.youtube.name)}` : 'None' },
    ],
  };
  const buttons = [
    {
      'type': 1,
      'components': [
        {
          'type': 2,
          'custom_id': 'media-prev',
          'style': 1,
          'label': 'Previous',
          'disabled': false,
        },
        {
          'type': 2,
          'custom_id': 'media-pause',
          'style': 3,
          'label': (player.getPause()) ? 'Play' : 'Pause',
          'disabled': false,
        },
        {
          'type': 2,
          'custom_id': 'media-next',
          'style': (player.getNext()) ? 1 : 2,
          'label': 'Next',
          'disabled': (player.getNext()) ? false : true,
        },
        {
          'type': 2,
          'custom_id': 'media-refresh',
          'style': 1,
          'label': 'Refresh',
          'disabled': false,
        },
        /* {
          'type': 2,
          'custom_id': '',
          'style': 2,
          'label': '',
          'disabled': false,
        },*/
      ],
    },
  ];
  return fresh ? { embeds: [embed], components: buttons, files: [thumb] } : { embeds: [embed], components: buttons };
}

exports.generateTrackEmbed = generateTrackEmbed;
exports.pickPride = pickPride;
exports.generateQueueEmbed = generateQueueEmbed;
exports.generateListEmbed = generateListEmbed;
exports.prideSticker = prideSticker;
exports.progressBar = progressBar;
exports.mediaEmbed = mediaEmbed;