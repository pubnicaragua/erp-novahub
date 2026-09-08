import { expect } from '@playwright/test';
import type { E2eModuleDefinition } from '../module-catalog';
import { BasePage } from './BasePage';

/** POM común para recorrer módulos sin duplicar selectores de la shell. */
export class ModulePage extends BasePage {
  async open(definition: E2eModuleDefinition): Promise<void> {
    await this.gotoModule(definition.id, definition.subModule);
    await this.waitForAppShell();
  }

  async assertModuleAvailableOrProtected(definition: E2eModuleDefinition): Promise<void> {
    const body = this.page.locator('body');
    const text = await body.innerText();
    const expected = new RegExp(
      `${definition.label}|Acceso Denegado|No tienes permisos|no está habilitado|Dashboard|Mi Sucursal`,
      'i',
    );
    expect(text, `El módulo ${definition.id} no renderizó contenido ni protección de acceso`).toMatch(expected);
  }
}
