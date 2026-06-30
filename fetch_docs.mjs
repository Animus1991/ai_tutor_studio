import https from 'https';
import fs from 'fs';

const files = [
  'ARCHITECTURE.md',
  'STUDY_WORKSPACE.md',
  'CONTENT_PIPELINE.md',
  'ALGORITHMS.md',
  'AGENT_RAG.md'
];

async function fetchFile(file) {
  return new Promise((resolve, reject) => {
    https.get(`https://raw.githubusercontent.com/Animus1991/synaptic_new/main/${file}`, (res) => {
      if (res.statusCode !== 200) {
        resolve(`Failed to fetch ${file}: ${res.statusCode}`);
        return;
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(`--- ${file} ---\n${data}\n`));
    }).on('error', reject);
  });
}

async function main() {
  for (const file of files) {
    const content = await fetchFile(file);
    console.log(content.substring(0, 500) + '... (truncated for brevity)');
    fs.writeFileSync(file.replace('/', '_'), content);
  }
}

main();
