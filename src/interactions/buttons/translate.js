import Translator from '../../translate.js';
import * as db from '../../database.js';
export const name = 'translate';

export async function execute(interaction, which) {
  await interaction.deferUpdate({ ephemeral: true });
  let reply = 'uhoh';
  const user = await db.getUser(interaction.user.id);
  switch (which) {
    case 'refresh': if (user.discord.locale) {
      Translator.subscribe(interaction.channelId, interaction.user.id, user.discord.locale, interaction);
      reply = `Messages in this channel will now be translated to your locale: ${user.discord.locale}`;
    } else {reply = 'You need to se your locale using "/locale" first';} break;
    default: reply = 'everything is fucked'; break;
  }
  await interaction.editReply({ content: reply, components: [] });
}