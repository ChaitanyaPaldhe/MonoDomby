import { test, expect } from '@playwright/test';
import { createPlayer, expectSameChecksum, expectSameVersion, expectCurrentPlayer } from './helpers/browser';

test.describe('Gameplay Flow', () => {
  test('roll dice and end turn', async ({ browser }) => {
    // Start game
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const p1 = await context1.newPage();
    const p2 = await context2.newPage();

    await createPlayer(p1, 'p1');
    await p1.click('[data-testid="btn-create-room"]');
    await expect(p1).toHaveURL(/\/room\/.+/);
    const roomId = p1.url().split('/').pop()!;
    
    await createPlayer(p2, 'p2');
    await p2.fill('input#roomId', roomId);
    await p2.click('[data-testid="btn-join-room"]');
    await expect(p2).toHaveURL(/\/room\/.+/);

    await p1.click('[data-testid="btn-start-game"]');
    
    // Toggle debug overlay
    await p1.keyboard.press('~');
    await p2.keyboard.press('~');

    // Whoever is first, roll dice
    const p1Turn = await p1.locator('[data-testid="current-player"]').innerText();
    const activePage = p1Turn === 'p1' ? p1 : p2;
    const inactivePage = p1Turn === 'p1' ? p2 : p1;

    // Verify initial checksum equality
    await expectSameChecksum([p1, p2]);
    await expectSameVersion([p1, p2]);

    // Active player rolls dice
    await activePage.click('[data-testid="btn-roll-dice"]');
    
    // Expect phase to transition
    await expect(activePage.locator('[data-testid="phase"]')).not.toHaveText('PRE_ROLL');

    // Verify action ordering / events
    await expect(activePage.locator('[data-testid="event-log"]')).toContainText('ROLL_DICE');
    await expect(inactivePage.locator('[data-testid="event-log"]')).toContainText('ROLL_DICE');

    // Both clients must remain synchronized
    await expectSameChecksum([p1, p2]);

    await context1.close();
    await context2.close();
  });
});
