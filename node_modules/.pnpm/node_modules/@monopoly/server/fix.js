const fs = require('fs');
const file = 'd:/Monopoly/apps/server/src/engine/CardHandlers.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/amount\r?\n\s*\}/g, 'amountPerPlayer: amount\n      }');
content = content.replace(/newPosition: /g, 'toPosition: ');
content = content.replace(/player\.properties\.jailCards/g, 'player.jailCards');
content = content.replace(/p\.properties\.jailCards/g, 'p.jailCards');
content = content.replace(/players\[(.*?)\] = \{ \.\.\.(.*?), money: (.*?) \};/g, "players[$1] = { ...$2, money: $3 } as import('@monopoly/shared').PlayerState;");
content = content.replace(/players\[(.*?)\] = \{ \.\.\.(.*?), jailCards: (.*?) \};/g, "players[$1] = { ...$2, jailCards: $3 } as import('@monopoly/shared').PlayerState;");

fs.writeFileSync(file, content);
