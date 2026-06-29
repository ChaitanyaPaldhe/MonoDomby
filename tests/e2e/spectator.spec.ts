import { test, expect } from '@playwright/test';
import { createPlayer, expectSameChecksum } from './helpers/browser';

test.describe('Spectator Flow', () => {
  test('spectator receives updates but cannot interact', async ({ browser }) => {
    // Tests that spectators join successfully, get the initial GameState, 
    // receive action_applied broadcasts, but their UI does not render ActionButtons.
    // Given the constraints of the UI, we would verify they do not see 'Available Actions'
    // This is currently a stub as UI for spectators joining explicitly needs a specific UI button
    test.skip('Implementation requires spectator join button in UI');
  });
});
