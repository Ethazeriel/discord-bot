import { embedPage } from '../../regexes.js';
import Workspace from '../../workspace.js';

export const name = 'list';

export async function execute(interaction, which) {
  await interaction.deferUpdate({ ephemeral: true });
  const workspace = Workspace.getWorkspace(interaction.member.user.id);
  let match = interaction.message.embeds[0].fields[1]?.value.match(embedPage);
  if (!match) { match = [0, 1]; }
  const currentPage = Number(match[1]);
  let reply = 'uhoh';
  switch (which) {
    case 'prev': reply = await workspace.makeEmbed('Current Playlist:', (currentPage - 1), false); break;
    case 'refresh': reply = await workspace.makeEmbed('Current Playlist:', currentPage, false); break;
    case 'next': reply = await workspace.makeEmbed('Current Playlist:', (currentPage + 1), false); break;
    default: reply = 'everything is fucked'; break;
  }
  await interaction.editReply(reply);
}