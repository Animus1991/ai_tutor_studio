import https from 'https';

https.get('https://raw.githubusercontent.com/Animus1991/synaptic_new/main/README.md', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data));
}).on('error', (err) => console.error(err));
