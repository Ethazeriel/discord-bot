const request = require('request');
const { writeFile } = require('fs/promises');
const { spotifyPattern, sanitize } = require('../regexes.js');

const auth = require('../../config.json');
auth.spotify.authOptions = {
  'url': 'https://accounts.spotify.com/api/token',
  'headers': {
    'Authorization': 'Basic ' + (Buffer.from(auth.spotify.client_id + ':' + auth.spotify.client_secret).toString('base64')),
  },
  'form': {
    'grant_type': 'client_credentials',
  },
  'json': true,
};

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

function spotifyGet(options) {
  return (new Promise((resolve, reject) => request.get(options, (error, response, body) => {
    if (!error) {
      if (response.statusCode === 200) {
        resolve(body);
      } else {
        reject(new Error('spotifyGet failing', { cause: { options: options, error: error, response: response, body:body } }));
      }
    } else {
      reject(new Error('spotifyGet failing', { cause: { options: options, error: error, response: response, body:body } }));
    }
  })));
}

function spotifyPost(options) {
  return (new Promise((resolve, reject) => request.post(options, async (error, response, body) => {
    if (!error) {
      if (response.statusCode === 200) {
        resolve(body);
      } else if (response.statusCode === 429) {
        const delayInSeconds = response.headers['Retry-After'];
        if (delayInSeconds) {
          await sleep((delayInSeconds * 1000));
          resolve(spotifyPost(options));
        } else {
          reject(new Error('spotifyPost failing', { cause: { options: options, error: error, response: response, body:body } }));
        }
      }
    } else {
      reject(new Error('spotifyPost failing', { cause: { options: options, error: error, response: response, body:body } }));
    }
  })));
}

(async () => {
  const fields = {
    playlist : '?fields=tracks.items(track(album(id,name,images),artists(id,name),track_number,id,name,duration_ms))',
    album : '', // is ignored, but should be '?fields=id,name,artists(id,name),images,tracks.items(track_number,id,name,duration_ms)',
    track : '', // is ignored, but should be '?fields=track_number,id,name,duration_ms,album(id,name,images),artists(id,name)',
    q : '', // hmm
  };

  /* can be a text search or direct track/album/playlist uri
  sample playlist: 'https://open.spotify.com/playlist/5PGhfyZ1v35ZrbFlZDqZDv?si=dcdb17285e0141f1'
  sample album: 'https://open.spotify.com/album/5LEXck3kfixFaA3CqVE7bC?si=JTmtA0s7Q8eLMUPBaVMJDg'
  sample track: 'https://open.spotify.com/track/47BBI51FKFwOMlIiX6m8ya?si=bdae2038850e480b'
  */
  const search = 'haken celestial elixir'.replace(sanitize, '');
  if (!search) {
    throw (new Error('search can\'t be null'));
  }

  let match = null;
  const notTextSearch = spotifyPattern.test(search);
  if (notTextSearch) {
    match = search.match(spotifyPattern); // match[1] = playlist, album, or track. match[2] = id
    console.log(`match: ${JSON.stringify(match, '', 2) + '\n'}`);
  } else {
    console.log(`regex match failed, presumably search is text: ${search}`);
  }

  const spotifyCredentials = await spotifyPost(auth.spotify.authOptions).catch(error => {
    console.log(JSON.stringify(error));
    throw (error); // crash instead of bothering with checks below
  });
  const spotifyOptions = {
    url: `${(notTextSearch) ? `https://api.spotify.com/v1/${match[1]}s/${match[2]}${fields[match[1]]}` : `https://api.spotify.com/v1/search?type=track&limit=1&q=${search}${fields['q']}`}`,
    headers: {
      'Authorization': 'Bearer ' + spotifyCredentials.access_token,
    },
    json: true,
  };

  console.log(`search: ${spotifyOptions.url}\n`);
  const result = await spotifyGet(spotifyOptions).catch(error => {
    console.log(JSON.stringify(error));
    throw (error); // crash instead of bothering with checks below
  });

  // these default to the fallbacks below to model usage, change them as desired and accordingly, or just set to nullish if that makes more sense
  const filePath = './testing/spotify/'; // you'll need to create the default path below or it'll crash. also just the folder path, not the file name/type
  const name = match[1];
  const description = ''; // perhaps 'with/ without fields', but will default to nothing if unset

  const save = true;
  const print = false;

  if (save) {
    await writeFile(`${(filePath) ? filePath : './testing/spotify/'}` + `${(name) ? name : (notTextSearch) ? match[1] : 'textSearch'}` + `${(description) ? `_${description}` : ''}.json`, (JSON.stringify(result, '', 2))).catch(error => {
      console.log(JSON.stringify(error, '', 2));
      throw (error); // may as well crash
    });
  }
  if (print) {
    console.log(JSON.stringify(result, '', 2));
  }

  /*
  const tests = [
  // 'https://open.spotify.com/track/2LbMR2ALLfhUt4FA1gqLtq?si=d35a11475afd470a',
  // 'https://open.spotify.com/playlist/5PGhfyZ1v35ZrbFlZDqZDv?si=bbff8ec69f084708',
  // 'https://open.spotify.com/album/3RBULTZJ97bvVzZLpxcB0j?si=XwWmuKf5QgSQfKB_i7u7mw',
  ];
  try {
    for (let i = 0; i < tests.length; i++) {
      if (spotifyPattern.test(tests[i])) {
        const match = tests[i].match(spotifyPattern);
        console.log(`match: ${JSON.stringify(match, '', 2) + '\n'}`);
        const spotifyCredentials = await spotifyPost(auth.spotify.authOptions);
        const spotifyOptions = {
          url: `https://api.spotify.com/v1/${match[1]}s/${match[2]}${fields[match[1]]}`,
          headers: {
            'Authorization': 'Bearer ' + spotifyCredentials.access_token,
          },
          json: true,
        };
        console.log(`search: ${spotifyOptions.url}\n`);

        const result = await spotifyGet(spotifyOptions);
        await writeFile('./result/spotify/test/_no_results.json', (JSON.stringify(result, '', 2)));
      }
    }
  } catch (error) {
    console.log(JSON.stringify(error, '', 2));
  } */
})();