import * as db from '../../database.js';
import * as utils from '../../utils.js';
import ytdl from 'ytdl-core';

export const name = 'remap';

export async function execute(interaction, which) { // button selection function
  switch (which) {

    case 'db': {
      const match = interaction.message.embeds[0].footer.text.match(/([\w-]{11})([0-3])/);
      const result = await db.switchAlternate(match[1], match[2]);
      if (result) {
        const reply = {
          embeds: [
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
          components:[],
        };
        await interaction.update(reply);
      } else {
        const reply = {
          embeds: [
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
          components:[],
        };
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
      // const newtrack = await fetch(`https://www.youtube.com/watch?v=${match[2]}`, interaction.id);
      const newtrack = await db.getTrack({ 'youtube.id': match[2] });
      let newtube;
      if (newtrack?.length) {
        newtube = newtrack.youtube;
      } else {
        try {
          const ytdlResult = await ytdl.getBasicInfo(match[2], { requestOptions: { family:4 } });
          newtube = {
            id:match[2],
            name:ytdlResult?.videoDetails.title,
            art:`https://i.ytimg.com/vi/${match[2]}/hqdefault.jpg`,
            duration:Number(ytdlResult?.videoDetails?.lengthSeconds),
          };
        } catch (error) {
          await interaction.update({ content:`Error remapping: ${error.message}`, ephemeral: true });
          return;
        }
      }
      const query = { 'goose.id':track.goose.id };
      const update = { $set: { youtube:newtube } };
      await db.updateTrack(query, update);

      const reply = {
        embeds: [
          {
            color: 0xd64004,
            author: {
              name: 'Remapped:',
              icon_url: utils.pickPride('fish'),
            },
            fields: [
              { name: 'From:', value: `[${track.youtube.name}](https://youtube.com/watch?v=${track.youtube.id}) - ${new Date(track.youtube.duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
              { name: 'To:', value: `[${newtube.name}](https://youtube.com/watch?v=${newtube.id}) - ${new Date(newtube.duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
            ],
            image: {
              url: 'attachment://combined.png',
              height: 0,
              width: 0,
            },
          },
        ],
        components:[],
        files: [],
      };
      await interaction.update(reply);
      break;
    }

    case 'no': {
      const reply = {
        embeds: [
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
        components:[],
      };
      await interaction.update(reply);
      break;
    }

    default:
      break;
  }
}