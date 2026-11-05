import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as colorContrast from '../src/app/utils/color-contrast.ts';

const { contrastRatio, getReadableForeground, validateContrastPairs } = colorContrast;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const themePath = path.resolve(scriptDirectory, '../src/styles/theme.css');
const themeCss = fs.readFileSync(themePath, 'utf8');
const appSourcePath = path.resolve(scriptDirectory, '../src/app');
const htmlPath = path.resolve(scriptDirectory, '../index.html');
const appHtml = fs.readFileSync(htmlPath, 'utf8');
const uiPath = (name) => path.resolve(scriptDirectory, '../src/app/components/ui', name);
const tableUi = fs.readFileSync(uiPath('EditableDataTable.tsx'), 'utf8');
const multiSelectUi = fs.readFileSync(uiPath('MultiSelect.tsx'), 'utf8');
const productImageUi = fs.readFileSync(uiPath('ProductImage.tsx'), 'utf8');
const exportMenuUi = fs.readFileSync(uiPath('ExportMenu.tsx'), 'utf8');
const pdfDownloadUi = fs.readFileSync(uiPath('PdfDownloadButton.tsx'), 'utf8');

function readAppSources(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return readAppSources(entryPath);
    return /\.(?:tsx?|jsx?)$/.test(entry.name) ? [fs.readFileSync(entryPath, 'utf8')] : [];
  }).join('\n');
}

const appSource = readAppSources(appSourcePath);

assert.match(appHtml, /localStorage\.getItem\('novahub:manager-theme'\)/, 'el modo inicial debe leer el fallback guardado de Manager antes de React');
assert.match(appHtml, /managerTheme\.mode === 'dark'[^\n]+managerTheme\.mode === 'light'/, 'el modo inicial debe respetar dark y light del fallback guardado');
assert.doesNotMatch(tableUi, /text-primary\/[0-9]+/, 'el texto de selección de filas debe mantener contraste completo');
assert.doesNotMatch(multiSelectUi, /isSelected \? "text-primary\/[0-9]+"/, 'las opciones seleccionadas deben mantener contraste completo');
assert.doesNotMatch(productImageUi, /"text-primary\/[0-9]+"/, 'el icono alternativo del producto debe mantener contraste legible');
assert.doesNotMatch(exportMenuUi, /text-emerald-600/, 'los iconos de exportación deben usar el token primario del tema');
assert.doesNotMatch(pdfDownloadUi, /\[&_svg\]:text-emerald-600/, 'los iconos de exportación deben usar el token primario del tema');
assert.doesNotMatch(appSource, /text-primary\/[0-9]+/, 'el texto de marca no debe reducir opacidad y perder contraste en modo oscuro');

function readRule(selector) {
  const match = themeCss.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`, 's'));
  if (!match) throw new Error(`No se encontró la regla ${selector}`);
  return Object.fromEntries(
    [...match[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)]
      .map(([, name, value]) => [name, value.trim()]),
  );
}

function resolveCssVariables(value, tokens, ancestors = new Set()) {
  return value.replace(/var\(--([\w-]+)\)/g, (reference, name) => {
    const token = tokens[name];
    if (!token || ancestors.has(name)) return reference;
    return resolveCssVariables(token, tokens, new Set([...ancestors, name]));
  });
}

function readResolvedRule(selector) {
  const tokens = readRule(selector);
  return Object.fromEntries(Object.entries(tokens).map(([name, value]) => [
    name,
    resolveCssVariables(value, tokens, new Set([name])),
  ]));
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

const primarySurfacePairs = [
  ['primary', 'background', 4.5],
  ['primary', 'card', 4.5],
  ['primary', 'popover', 4.5],
];

const issues = [];
const themeTokens = new Map();
for (const [selector, themeName] of [[':root', 'claro'], ['\\.dark', 'oscuro']]) {
  const tokens = readResolvedRule(selector);
  themeTokens.set(themeName, tokens);
  const pairs = semanticPairs.map(([foreground, background, name]) => ({
    name: `${themeName}:${name}`,
    foreground: tokens[foreground],
    background: tokens[background],
  }));
  issues.push(...validateContrastPairs(pairs));

  issues.push(...validateContrastPairs(primarySurfacePairs.map(([foreground, background, minRatio]) => ({
    name: `${themeName}:${foreground}-sobre-${background}`,
    foreground: tokens[foreground],
    background: tokens[background],
    minRatio,
  }))));
}

if (themeTokens.get('oscuro')?.primary === themeTokens.get('claro')?.primary) {
  issues.push({
    name: 'primario por modo',
    foreground: themeTokens.get('oscuro')?.primary || '',
    background: themeTokens.get('claro')?.primary || '',
    ratio: null,
  });
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

assert.equal(typeof colorContrast.ensureReadableBrandColor, 'function', 'el tema oscuro debe poder derivar una variante de marca legible');
const darkSurfaces = ['oklch(0.205 0.005 155)', 'oklch(0.245 0.005 155)', 'oklch(0.235 0.005 155)'];
const derivedDarkPrimary = colorContrast.ensureReadableBrandColor('#01422c', darkSurfaces, 4.5);
assert.equal(derivedDarkPrimary, themeTokens.get('oscuro')?.primary, 'el fallback CSS debe coincidir con la variante dinámica de marca');
assert.equal(themeTokens.get('oscuro')?.['primary-foreground'], getReadableForeground(derivedDarkPrimary), 'el texto sobre el primario oscuro debe usar el foreground legible');
assert.equal(colorContrast.ensureReadableBrandColor('#10b981', darkSurfaces, 4.5), '#10b981', 'los colores personalizados que ya son legibles deben conservarse');
for (const background of darkSurfaces) {
  assert.ok((contrastRatio(derivedDarkPrimary, background) || 0) >= 4.5, `la variante ${derivedDarkPrimary} debe ser legible sobre ${background}`);
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
  console.log(`Contraste de tema validado: ${(semanticPairs.length + primarySurfacePairs.length) * 2 + configuredPalette.length} combinaciones WCAG AA.`);
}
