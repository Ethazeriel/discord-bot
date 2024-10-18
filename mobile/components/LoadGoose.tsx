export async function LoadGoose() {
  try {
    const response = await fetch('http://172.16.12.119:2468/load', { method: 'GET', credentials: 'include' });
    // console.log(response);
    const json = await response.json();
    // console.log(JSON.stringify(json, null, 2));
    return json;
  } catch (error) { console.error(error); }
}

// export async function LogIn() { // fuck authentication
//   const discord = {
//     client_id:'888246723988840508',
//     redirect_uri:'http://172.16.12.119:2468/oauth2?type=discord',
//     idHash:'test'
//   };
//   const result = null;
//   // const result = await WebBrowser.openBrowserAsync(`https://discord.com/oauth2/authorize?client_id=${discord.client_id}&redirect_uri=${discord.redirect_uri}&state=${discord.idHash}&response_type=code&scope=identify%20email%20connections%20guilds%20guilds.members.read`)
//   console.log(result);
// }