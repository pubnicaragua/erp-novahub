import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export interface CreateTaskInput {
  title: string;
  description: string;
  priority: string;
  /** Etiqueta visible en el select de categoría (ej. "Sistemas"). */
  category?: string;
  /** Presets de campos personalizados: { servicioAfectado: 'CRM' }. */
  customFields?: Record<string, string>;
}

export class ActivitiesPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openTasks(): Promise<void> {
    await this.gotoModule('actividades', 'tareas');
    await this.waitForAppShell();
    await expect(this.page.getByTestId('activities-new-task')).toBeVisible({ timeout: 20_000 });
  }

  /** Selecciona una opción en un Select de Radix abierto desde su trigger. */
  private async selectRadixOption(triggerTestId: string, optionName: string): Promise<void> {
    await this.page.getByTestId(triggerTestId).click();
    await this.page.getByRole('option', { name: optionName, exact: true }).click();
  }

  async createTask(input: CreateTaskInput): Promise<string> {
    await this.page.getByTestId('activities-new-task').click();
    await this.page.getByTestId('activities-task-title').fill(input.title);
    await this.page.getByTestId('activities-task-description').fill(input.description);
    await this.selectRadixOption('activities-task-priority', PRIORITY_LABELS[input.priority] ?? input.priority);
    if (input.category) {
      await this.selectRadixOption('activities-task-category', input.category);
    }
    if (input.customFields) {
      for (const [key, value] of Object.entries(input.customFields)) {
        await this.page.getByTestId(`activities-task-custom-${key}`).fill(value);
      }
    }
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

  /** Toma la tarea para el usuario actual y espera a que desaparezca el botón. */
  async claimTask(id: string): Promise<void> {
    const responsePromise = this.page.waitForResponse((response) => (
      response.url().endsWith(`/api/activities/tasks/${id}/claim`) && response.request().method() === 'POST'
    ));
    await this.page.getByTestId(`activities-claim-${id}`).last().click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    await this.assertToast(/tarea tomada/i);
    await expect(this.page.getByTestId(`activities-claim-${id}`)).toHaveCount(0, { timeout: 15_000 });
  }

  /**
   * Reasigna la tarea desde el modal. Elige al primer usuario disponible del
   * lookup (el tenant E2E tiene un solo usuario) y envía el motivo indicado.
   */
  async reassignTask(id: string, reason: string): Promise<void> {
    await this.page.getByTestId(`activities-reassign-${id}`).last().click();
    await expect(this.page.getByTestId('reassign-assignee')).toBeVisible({ timeout: 15_000 });
    const responsePromise = this.page.waitForResponse((response) => (
      response.url().endsWith(`/api/activities/tasks/${id}/reassign`) && response.request().method() === 'POST'
    ));
    await this.page.getByTestId('reassign-assignee').click();
    await this.page.getByRole('option').first().click();
    await this.page.getByTestId('reassign-reason').fill(reason);
    await this.page.getByTestId('reassign-submit').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    await this.assertToast(/tarea reasignada/i);
    await expect(this.page.getByTestId('reassign-assignee')).toHaveCount(0, { timeout: 15_000 });
  }

  async openDetail(id: string): Promise<void> {
    await this.page.getByTestId(`activities-open-detail-${id}`).last().click();
    await expect(this.page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
  }

  async closeDetail(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.page.getByRole('dialog')).toHaveCount(0, { timeout: 10_000 });
  }

  async searchTasks(term: string): Promise<void> {
    await this.page.getByTestId('activities-task-search').fill(term);
  }

  async selectCategoryFilter(label: string): Promise<void> {
    await this.selectRadixOption('activities-task-category-filter', label);
  }
}
