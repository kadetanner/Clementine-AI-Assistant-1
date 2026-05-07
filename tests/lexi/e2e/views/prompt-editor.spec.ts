import { test, expect } from '@playwright/test';

test.describe('Prompt editor styling', () => {
  test.beforeEach(async ({ page }) => {
    // Suppress the onboarding tour modal before any script runs
    await page.addInitScript(() => {
      try { localStorage.setItem('lexi-onboarding-seen', '999'); } catch { /* ignore */ }
    });
    const r = await page.goto('/#/agents').catch(() => null);
    if (!r || r.status() >= 400) test.skip(true, 'dashboard not running on :3030');
  });

  test('textarea has min-height >= 240px and full width', async ({ page }) => {
    // Click the first agent that has a prompt (Lexi or Jonah from screenshot)
    const firstAgent = page.locator('lexi-agents-view .agent-row').first();
    await firstAgent.waitFor({ state: 'visible', timeout: 5000 });
    await firstAgent.click();
    const ta = page.locator('lexi-prompt-editor textarea');
    await expect(ta).toBeVisible();
    const box = await ta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(240);
    expect(box!.width).toBeGreaterThanOrEqual(400);
  });

  test('toolbar shows label, save, cancel with proper spacing', async ({ page }) => {
    const firstAgent = page.locator('lexi-agents-view .agent-row').first();
    await firstAgent.waitFor({ state: 'visible', timeout: 5000 });
    await firstAgent.click();
    const editor = page.locator('lexi-prompt-editor');
    await expect(editor.locator('.toolbar .label')).toHaveText('System prompt');
    await expect(editor.locator('button[data-save]')).toBeVisible();
    await expect(editor.locator('button[data-cancel]')).toBeVisible();
    const toolbarBox = await editor.locator('.toolbar').boundingBox();
    expect(toolbarBox!.height).toBeGreaterThanOrEqual(36);
  });

  test('save button is disabled when not dirty', async ({ page }) => {
    const firstAgent = page.locator('lexi-agents-view .agent-row').first();
    await firstAgent.waitFor({ state: 'visible', timeout: 5000 });
    await firstAgent.click();
    const save = page.locator('lexi-prompt-editor button[data-save]');
    await expect(save).toBeDisabled();
  });
});
