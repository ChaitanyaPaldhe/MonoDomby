import { test, expect } from '@playwright/test';
import { createPlayer, expectSameChecksum, expectSameVersion } from './helpers/browser';

test.describe('Versioning Flow', () => {
  test('actions preserve versioning constraints', async ({ browser }) => {
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
    
    await p1.click('[data-testid="btn-start-game"]');
    
    await p1.keyboard.press('~');
    await p2.keyboard.press('~');

    // Initial version should be 0 or 1, but we just verify they match
    await expectSameVersion([p1, p2]);
    const initialVersionStr = await p1.locator('[data-testid="version"]').innerText();
    const initialVersion = parseInt(initialVersionStr);

    // Roll dice to bump version
    const p1Turn = await p1.locator('[data-testid="current-player"]').innerText();
    const activePage = p1Turn === 'p1' ? p1 : p2;
    await activePage.click('[data-testid="btn-roll-dice"]');
    
    // Wait for event to propagate
    await expect(activePage.locator('[data-testid="phase"]')).not.toHaveText('PRE_ROLL');

    // Verify version increased identically for both clients
    await expectSameVersion([p1, p2]);
    await expectSameChecksum([p1, p2]);

    const finalVersionStr = await p1.locator('[data-testid="version"]').innerText();
    const finalVersion = parseInt(finalVersionStr);
    expect(finalVersion).toBeGreaterThan(initialVersion);

    await context1.close();
    await context2.close();
  });
});
