import { Page, expect } from '@playwright/test';

export async function createPlayer(page: Page, playerName: string) {
  await page.goto('/');
  await page.fill('input#playerId', playerName);
  await page.click('[data-testid="btn-connect"]');
  await expect(page.locator('[data-testid="btn-create-room"]')).toBeEnabled();
}

export async function expectSameChecksum(pages: Page[]) {
  if (pages.length < 2) return;
  const checksums = await Promise.all(pages.map(p => p.locator('[data-testid="checksum"]').innerText()));
  const first = checksums[0];
  for (const c of checksums) {
    expect(c).toBe(first);
  }
}

export async function expectSameVersion(pages: Page[]) {
  if (pages.length < 2) return;
  const versions = await Promise.all(pages.map(p => p.locator('[data-testid="version"]').innerText()));
  const first = versions[0];
  for (const v of versions) {
    expect(v).toBe(first);
  }
}

export async function expectSocketConnected(page: Page) {
  await expect(page.locator('[data-testid="socket-status"]')).toHaveText('connected');
}

export async function expectCurrentPlayer(page: Page, expectedPlayerId: string) {
  await expect(page.locator('[data-testid="current-player"]')).toHaveText(expectedPlayerId);
}
