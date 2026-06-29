const fs = require('fs');
const path = require('path');
const dir = 'apps/server/src/game';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  let content = fs.readFileSync(path.join(dir, file), 'utf8');
  
  // Clean up existing imports first
  content = content.replace(/import \{([^}]*)\} from '@monopoly\/shared';/g, '');
  content = content.replace(/import \{([^}]*)\} from '@monopoly\/engine';/g, '');

  let newImports = "import { PlayerId, ClientAction, GameState, GameEvent } from '@monopoly/shared';\n";
  newImports += "import { GameEngine } from '@monopoly/engine';\n";

  content = newImports + content.trim();

  // In ReplayManager, event has id. GameEvent uses `id` or `eventId`?
  content = content.replace(/event\.eventId/g, "event.id");

  fs.writeFileSync(path.join(dir, file), content);
}
