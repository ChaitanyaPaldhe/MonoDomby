import { test, expect } from '@playwright/test';
import { createPlayer, expectSameChecksum, expectSocketConnected } from './helpers/browser';

test.describe('Reconnect Flow', () => {
  test('disconnect and reconnect restores state', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    let p1 = await context1.newPage();
    const p2 = await context2.newPage();

    // Setup room
    await createPlayer(p1, 'p1');
    await p1.click('[data-testid="btn-create-room"]');
    await expect(p1).toHaveURL(/\/room\/.+/);
    const roomId = p1.url().split('/').pop()!;
    
    await createPlayer(p2, 'p2');
    await p2.fill('input#roomId', roomId);
    await p2.click('[data-testid="btn-join-room"]');
    await p1.click('[data-testid="btn-start-game"]');
    
    // Toggle debug
    await p1.keyboard.press('~');
    await p2.keyboard.press('~');

    await expectSameChecksum([p1, p2]);
    const initialChecksum = await p1.locator('[data-testid="checksum"]').innerText();

    // Simulate Player 1 closing their browser tab
    await p1.close();
    
    // Wait for the server to recognize the disconnect (if heartbeat timeout were low, but we'll just reconnect immediately)
    // Player 1 comes back on a new page
    p1 = await context1.newPage();
    await createPlayer(p1, 'p1');
    await expectSocketConnected(p1);
    
    // Rejoin the room using the UUID
    await p1.fill('input#roomId', roomId);
    await p1.click('[data-testid="btn-join-room"]');
    
    // Should immediately transition back to the game page because the game has started
    await expect(p1).toHaveURL(/\/game\/.+/);
    await p1.keyboard.press('~');

    // Verify state was completely restored
    const restoredChecksum = await p1.locator('[data-testid="checksum"]').innerText();
    expect(restoredChecksum).toBe(initialChecksum);
    
    await expectSameChecksum([p1, p2]);

    await context1.close();
    await context2.close();
  });
});
