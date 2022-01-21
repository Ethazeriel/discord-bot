const db = require('../../database.js');
const utils = require('../../utils.js');
const { fetch } = require('../../acquire.js');

module.exports = {
  name : 'remap',

  async execute(interaction, which) { // button selection function
    switch (which) {

    case 'db': {
      const match = interaction.message.embeds[0].footer.text.match(/([\w-]{11})([0-3])/);
      const result = await db.switchAlternate(match[1], match[2]);
      if (result) {
        const reply = {
          embeds:
      [
        {
          color: 0xd64004,
          author: {
            name: 'Confirmed:',
            icon_url: utils.pickPride('fish'),
          },
          fields: [
            { name: 'Track Remapped.', value: '** **' },
          ],
          image: {
            url: 'attachment://combined.png',
            height: 0,
            width: 0,
          },
        },
      ],
          components:[] };
        await interaction.update(reply);
      } else {
        const reply = {
          embeds:
      [
        {
          color: 0xd64004,
          author: {
            name: 'Failure:',
            icon_url: utils.pickPride('fish'),
          },
          fields: [
            { name: 'Something went wrong;', value: 'please try again.' },
          ],
          image: {
            url: 'attachment://combined.png',
            height: 0,
            width: 0,
          },
        },
      ],
          components:[] };
        await interaction.update(reply);
      }
      break;
    }

    case 'new': {
      const match = interaction.message.embeds[0].footer.text.match(/([\w-]{11})([\w-]{11})/);
      const track = await db.getTrack({ 'youtube.id': match[1] });
      if (!Object.keys(track).length) {
        await interaction.followUp({ content:'We don\'t appear to have that track.', ephemeral: true });
        return;
      }
      const newtrack = await fetch(`https://www.youtube.com/watch?v=${match[2]}`);
      if (!newtrack.length) {
        await interaction.update({ content:'Invalid newtrack URL', ephemeral: true });
        return;
      }

      if (newtrack[0].ephemeral) { // ephemeral track - we can just do an update by spotify ID
        const query = { 'spotify.id':newtrack[0].spotify.id };
        const update = { $set: { 'youtube':newtrack[0].youtube } };
        if (track.keys.length && (track.keys != newtrack[0].keys)) {
          const newkeys = track.keys.concat(newtrack[0].keys);
          update['$set']['keys'] = newkeys;
        }
        if (Object.keys(track.playlists).length && (track.playlists != newtrack[0].playlists)) {
          const newplaylists = Object.assign(track.playlists, newtrack[0].playlists);
          update['$set']['playlists'] = newplaylists;
        }
        if (track.spotify.id.length && (track.spotify.id != newtrack[0].spotify.id)) {
          const newid = track.spotify.id.concat(newtrack[0].spotify.id);
          update['$set']['spotify.id'] = newid;
        }

        await db.updateTrack(query, update);
        await db.removeTrack(track.youtube.id);
      } else {
        const query = { 'youtube.id':newtrack[0].youtube.id };
        const update = { $set: {} };
        if (track.keys.length && (track.keys != newtrack[0].keys)) {
          const newkeys = track.keys.concat(newtrack[0].keys);
          update['$set']['keys'] = newkeys;
        }
        if (Object.keys(track.playlists).length && (track.playlists != newtrack[0].playlists)) {
          const newplaylists = Object.assign(track.playlists, newtrack[0].playlists);
          update['$set']['playlists'] = newplaylists;
        }
        if (track.spotify.id.length && (track.spotify.id != newtrack[0].spotify.id)) {
          const newid = track.spotify.id.concat(newtrack[0].spotify.id);
          update['$set']['spotify.id'] = newid;
        }
        if (Object.keys(update.$set).length > 0) {
          await db.updateTrack(query, update);
        }
        await db.removeTrack(track.youtube.id);
      }
      const reply = {
        embeds:
    [
      {
        color: 0xd64004,
        author: {
          name: 'Remapped:',
          icon_url: utils.pickPride('fish'),
        },
        fields: [
          { name: 'From:', value: `[${track.youtube.name}](https://youtube.com/watch?v=${track.youtube.id}) - ${new Date(track.youtube.duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
          { name: 'To:', value: `[${newtrack[0].youtube.name}](https://youtube.com/watch?v=${newtrack[0].youtube.id}) - ${new Date(newtrack[0].youtube.duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
        ],
        image: {
          url: 'attachment://combined.png',
          height: 0,
          width: 0,
        },
      },
    ],
        components:[],
        files: [] };
      await interaction.update(reply);
      break;
    }

    case 'no': {
      const reply = {
        embeds:
      [
        {
          color: 0xd64004,
          author: {
            name: 'Cancelled remap.',
            icon_url: utils.pickPride('fish'),
          },
          image: {
            url: 'attachment://combined.png',
            height: 0,
            width: 0,
          },
        },
      ],
        components:[] };
      await interaction.update(reply);
      break;
    }
    default:
      break;
    }
  },
};