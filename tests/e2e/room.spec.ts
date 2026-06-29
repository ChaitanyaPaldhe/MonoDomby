import { test, expect } from '@playwright/test';
import { createPlayer, expectSocketConnected } from './helpers/browser';

test.describe('Room Flow', () => {
  test('create room, join room, and start game', async ({ browser }) => {
    // Isolated contexts for Player 1 and Player 2
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const p1 = await context1.newPage();
    const p2 = await context2.newPage();

    // Player 1 connects and creates a room
    await createPlayer(p1, 'p1');
    await expectSocketConnected(p1);
    await p1.click('[data-testid="btn-create-room"]');
    
    // Wait for room to be created and navigate to lobby
    await expect(p1).toHaveURL(/\/room\/.+/);
    
    // Extract room ID
    const url = p1.url();
    const roomId = url.split('/').pop()!;
    
    // Player 2 connects and joins the room
    await createPlayer(p2, 'p2');
    await expectSocketConnected(p2);
    
    await p2.fill('input#roomId', roomId);
    await p2.click('[data-testid="btn-join-room"]');
    
    // Wait for Player 2 to enter the lobby
    await expect(p2).toHaveURL(/\/room\/.+/);

    // Verify both players see each other in the lobby
    await expect(p1.locator(`[data-testid="player-lobby-item-p1"]`)).toBeVisible();
    await expect(p1.locator(`[data-testid="player-lobby-item-p2"]`)).toBeVisible();
    
    await expect(p2.locator(`[data-testid="player-lobby-item-p1"]`)).toBeVisible();
    await expect(p2.locator(`[data-testid="player-lobby-item-p2"]`)).toBeVisible();

    // Start Game
    await p1.click('[data-testid="btn-start-game"]');
    
    // Both should transition to the Game page
    await expect(p1).toHaveURL(/\/game\/.+/);
    await expect(p2).toHaveURL(/\/game\/.+/);

    // Open debug overlay to verify phase
    await p1.keyboard.press('~');
    await expect(p1.locator('[data-testid="phase"]')).toBeVisible();

    await context1.close();
    await context2.close();
  });
});
