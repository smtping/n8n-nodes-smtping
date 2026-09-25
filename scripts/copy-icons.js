// Copies node icons next to the compiled JS (tsc does not copy assets).
const fs = require('fs');
const path = require('path');

const pairs = [['nodes/Smtping/smtping.svg', 'dist/nodes/Smtping/smtping.svg']];
for (const [from, to] of pairs) {
	fs.mkdirSync(path.dirname(to), { recursive: true });
	fs.copyFileSync(from, to);
}
