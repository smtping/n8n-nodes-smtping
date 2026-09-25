// Copies node and credential icons next to the compiled JS (tsc does not copy assets).
const fs = require('fs');
const path = require('path');

const pairs = [
	['nodes/Smtping/smtping.svg', 'dist/nodes/Smtping/smtping.svg'],
	['nodes/Smtping/smtping.dark.svg', 'dist/nodes/Smtping/smtping.dark.svg'],
	['credentials/smtping.svg', 'dist/credentials/smtping.svg'],
	['credentials/smtping.dark.svg', 'dist/credentials/smtping.dark.svg'],
];
for (const [from, to] of pairs) {
	fs.mkdirSync(path.dirname(to), { recursive: true });
	fs.copyFileSync(from, to);
}
