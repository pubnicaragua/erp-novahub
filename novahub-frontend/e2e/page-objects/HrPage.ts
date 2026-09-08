import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class HrPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openEmployees(): Promise<void> {
    await this.gotoModule('rh', 'empleados');
    await this.waitForAppShell();
    await expect(this.page.getByTestId('hr-new-employee')).toBeVisible({ timeout: 20_000 });
  }

  async createEmployee(input: {
    employeeNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    hireDate: string;
    departmentName: string;
    positionTitle: string;
    salary: number;
  }): Promise<void> {
    await this.page.getByTestId('hr-new-employee').click();
    await this.page.getByTestId('hr-employee-number').fill(input.employeeNumber);
    await this.page.getByTestId('hr-employee-first-name').fill(input.firstName);
    await this.page.getByTestId('hr-employee-last-name').fill(input.lastName);
    await this.page.getByTestId('hr-employee-email').fill(input.email);
    await this.page.getByTestId('hr-employee-hire-date').fill(input.hireDate);

    await this.page.getByTestId('hr-employee-department').click();
    await this.page.getByRole('option', { name: input.departmentName, exact: true }).click();
    await this.page.getByTestId('hr-employee-position').click();
    await this.page.getByRole('option', { name: input.positionTitle, exact: true }).click();
    await this.page.getByTestId('hr-employee-contract').click();
    await this.page.getByRole('option', { name: 'Tiempo completo', exact: true }).click();
    await this.page.getByTestId('hr-employee-salary').fill(String(input.salary));

    const responsePromise = this.page.waitForResponse((response) => (
      response.url().endsWith('/api/hr/employees') && response.request().method() === 'POST'
    ));
    await this.page.getByTestId('hr-employee-submit').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    await this.assertToast(/empleado guardado correctamente/i);
    await expect(this.page.getByText(input.firstName, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  }
}
