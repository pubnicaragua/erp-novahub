import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contrastRatio,
  getReadableForeground,
  validateContrastPairs,
} from '../src/app/utils/color-contrast.ts';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const themePath = path.resolve(scriptDirectory, '../src/styles/theme.css');
const themeCss = fs.readFileSync(themePath, 'utf8');

function readRule(selector) {
  const match = themeCss.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`, 's'));
  if (!match) throw new Error(`No se encontró la regla ${selector}`);
  return Object.fromEntries(
    [...match[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)]
      .map(([, name, value]) => [name, value.trim()]),
  );
}

const semanticPairs = [
  ['primary-foreground', 'primary', 'primary'],
  ['accent-foreground', 'accent', 'accent'],
  ['sidebar-foreground', 'sidebar', 'sidebar'],
  ['sidebar-primary-foreground', 'sidebar-primary', 'sidebar-primary'],
  ['sidebar-accent-foreground', 'sidebar-accent', 'sidebar-accent'],
  ['card-foreground', 'card', 'card'],
  ['popover-foreground', 'popover', 'popover'],
];

const issues = [];
for (const [selector, themeName] of [[':root', 'claro'], ['\\.dark', 'oscuro']]) {
  const tokens = readRule(selector);
  const pairs = semanticPairs.map(([foreground, background, name]) => ({
    name: `${themeName}:${name}`,
    foreground: tokens[foreground],
    background: tokens[background],
  }));
  issues.push(...validateContrastPairs(pairs));
}

const configuredPalette = ['#10b981', '#f59e0b', '#8b5cf6', '#14b8a6', '#f97316'];
for (const background of configuredPalette) {
  const foreground = getReadableForeground(background);
  const ratio = contrastRatio(foreground, background);
  if (ratio === null || ratio < 4.5) {
    issues.push({
      name: `paleta configurada:${background}`,
      foreground,
      background,
      ratio,
    });
  }
}

if (/color:\s*#ffffff\s*!important/.test(themeCss.match(/\.odoo-highlight\s*\{([^}]*)\}/s)?.[1] || '')) {
  issues.push({
    name: '.odoo-highlight',
    foreground: '#ffffff',
    background: 'heredado',
    ratio: null,
  });
}

if (issues.length > 0) {
  console.error('Validación de contraste fallida:');
  for (const issue of issues) {
    console.error(`- ${issue.name}: ${issue.foreground} sobre ${issue.background} (ratio ${issue.ratio ?? 'no evaluable'})`);
  }
  process.exitCode = 1;
} else {
  console.log(`Contraste de tema validado: ${semanticPairs.length * 2 + configuredPalette.length} combinaciones WCAG AA.`);
}
