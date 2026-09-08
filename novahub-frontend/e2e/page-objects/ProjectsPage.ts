import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface ProjectCreateInput {
  name: string;
  description: string;
  plannedBudget: number;
}

export class ProjectsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openPortfolio(): Promise<void> {
    await this.gotoModule('proyectos', 'proyectos');
    await this.waitForAppShell();
    await expect(this.page.getByTestId('projects-new-project')).toBeVisible({ timeout: 20_000 });
  }

  async createProject(input: ProjectCreateInput): Promise<{ id: string; code: string }> {
    await this.page.getByTestId('projects-new-project').click();
    await expect(this.page.getByTestId('projects-form-submit')).toBeVisible();
    await this.page.getByTestId('projects-form-name').fill(input.name);
    await this.page.getByTestId('projects-form-description').fill(input.description);
    await this.page.locator('#projects-form-start-date').click();
    const today = new Date();
    const day = today.getDate();
    await this.page.locator('button:visible').filter({ hasText: new RegExp(`^${day}$`) }).last().click();
    const budgetInput = this.page.getByTestId('projects-form-planned-budget');
    await budgetInput.fill(String(input.plannedBudget));
    await expect(budgetInput).toHaveValue(String(input.plannedBudget));

    const responsePromise = this.page.waitForResponse((response) => (
      response.url().endsWith('/api/projects') && response.request().method() === 'POST'
    ));
    await this.page.getByTestId('projects-form-submit').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    const body = await response.json() as { id?: string; code?: string };
    if (!body.id) throw new Error(`El proyecto no devolvió id: ${JSON.stringify(body)}`);
    await this.assertToast(/proyecto creado/i);
    await expect(this.page.getByText(input.name, { exact: true })).toBeVisible({ timeout: 20_000 });
    return { id: body.id, code: String(body.code || '') };
  }

  async openProject(name: string): Promise<void> {
    await this.page.getByText(name, { exact: true }).first().click();
    await expect(this.page.getByText(name, { exact: true }).last()).toBeVisible({ timeout: 20_000 });
  }
}
