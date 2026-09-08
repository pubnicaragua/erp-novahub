import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ActivitiesPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openTasks(): Promise<void> {
    await this.gotoModule('actividades', 'tareas');
    await this.waitForAppShell();
    await expect(this.page.getByTestId('activities-new-task')).toBeVisible({ timeout: 20_000 });
  }

  async createTask(input: { title: string; description: string; priority: string }): Promise<string> {
    await this.page.getByTestId('activities-new-task').click();
    await this.page.getByTestId('activities-task-title').fill(input.title);
    await this.page.getByTestId('activities-task-description').fill(input.description);
    await this.page.getByTestId('activities-task-priority').selectOption(input.priority);
    const responsePromise = this.page.waitForResponse((response) => (
      response.url().endsWith('/api/activities/tasks') && response.request().method() === 'POST'
    ));
    const refreshPromise = this.page.waitForResponse((response) => (
      response.url().includes('/api/activities/tasks') && response.request().method() === 'GET'
    ));
    await this.page.getByTestId('activities-task-submit').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    const body = await response.json() as { id?: string };
    if (!body.id) throw new Error(`La tarea no devolvió id: ${JSON.stringify(body)}`);
    await refreshPromise;
    await this.assertToast(/tarea creada exitosamente/i);
    await expect(this.page.getByText(input.title, { exact: true }).last()).toBeVisible({ timeout: 20_000 });
    return body.id;
  }

  async completeTask(id: string, evidenceUrl: string): Promise<void> {
    await this.page.getByTestId(`activities-complete-${id}`).last().click();
    await this.page.getByTestId('activities-task-evidence-url').fill(evidenceUrl);
    const responsePromise = this.page.waitForResponse((response) => (
      response.url().endsWith(`/api/activities/tasks/${id}/complete`) && response.request().method() === 'POST'
    ));
    await this.page.getByTestId('activities-task-complete-submit').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    await this.assertToast(/tarea completada exitosamente/i);
  }
}
