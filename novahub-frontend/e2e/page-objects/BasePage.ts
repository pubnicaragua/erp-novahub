import { expect, type Page } from '@playwright/test';

export class BasePage {
  constructor(protected readonly page: Page) {}

  async gotoModule(moduleId: string, subModule?: string): Promise<void> {
    const params = new URLSearchParams({ m: moduleId });
    if (subModule) params.set('sm', subModule);
    await this.page.goto(`/?${params.toString()}`);
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.locator('#root').waitFor({ state: 'visible', timeout: 30_000 });
  }

  async waitForAppShell(): Promise<void> {
    await expect(this.page.locator('#root')).toBeVisible({ timeout: 30_000 });
    await this.page.locator('main, aside, nav, [role="main"]').first().waitFor({ state: 'visible', timeout: 30_000 });
    await this.dismissGuidedTour();
  }

  async dismissGuidedTour(): Promise<void> {
    const tour = this.page.locator('[role="dialog"][aria-modal="true"]').filter({ hasText: /salir del tutorial/i }).first();
    try {
      await tour.waitFor({ state: 'visible', timeout: 5_000 });
      await tour.getByText('Salir del tutorial', { exact: true }).click();
    } catch {
      // No todas las vistas muestran el tutorial; la espera está limitada a
      // la aparición del control accesible y no usa sleeps fijos.
    }
  }

  async assertNoViewportOverflow(): Promise<void> {
    const overflowing = await this.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflowing, `Existe overflow horizontal en ${this.page.url()}`).toBeFalsy();
  }

  async assertResponsiveLayout(): Promise<void> {
    await this.waitForAppShell();
    await this.assertNoViewportOverflow();
    const interactive = this.page.locator('button, a, input, select, textarea');
    await expect.poll(async () => {
      const count = await interactive.count();
      for (let index = 0; index < count; index += 1) {
        if (await interactive.nth(index).isVisible()) return true;
      }
      return false;
    }, { timeout: 15_000, message: 'La vista debe renderizar al menos un control interactivo visible' }).toBe(true);
  }

  async assertToast(message?: string | RegExp): Promise<void> {
    const toast = this.page.locator('[data-sonner-toast]').last();
    await expect(toast, 'La operación no mostró feedback visual Sonner').toBeVisible({ timeout: 5_000 });
    if (message) await expect(toast).toContainText(message);
  }

  async expectAccessDeniedOrModule(label: string): Promise<void> {
    const body = this.page.locator('body');
    await expect(body).toContainText(new RegExp(`${label}|Acceso Denegado|No tienes permisos|no está habilitado`, 'i'), { timeout: 30_000 });
  }
}
