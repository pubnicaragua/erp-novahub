import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const componentPath = resolve(here, '../src/app/components/admin/EnterpriseGroupSetupView.tsx');
const source = readFileSync(componentPath, 'utf8');
const sourceFile = ts.createSourceFile(componentPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const requiredStateProps = {
  GroupConfigurationView: ['salesIntegrationTouched'],
  IdentityStep: ['salesIntegrationTouched', 'setSalesIntegrationTouched'],
};

function findComponentProps(componentName) {
  let props;
  const visit = (node) => {
    const opening = ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node) ? node : null;
    if (opening?.tagName.getText(sourceFile) === componentName) {
      props = new Map(opening.attributes.properties.filter(ts.isJsxAttribute).map((attribute) => [
        attribute.name.getText(sourceFile),
        ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression?.getText(sourceFile) : undefined,
      ]));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return props;
}

function findDestructuredProps(functionName) {
  let names = new Set();
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) {
      const binding = node.parameters[0]?.name;
      if (binding && ts.isObjectBindingPattern(binding)) {
        names = new Set(binding.elements.map((element) => element.propertyName?.getText(sourceFile) || element.name.getText(sourceFile)));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
}

test('sales integration touch state is passed to both group views that use it', () => {
  for (const [componentName, stateNames] of Object.entries(requiredStateProps)) {
    const props = findComponentProps(componentName);
    const parameters = findDestructuredProps(componentName);

    for (const stateName of stateNames) {
      assert.equal(props?.get(stateName), stateName, `${componentName} must receive ${stateName}`);
      assert.ok(parameters.has(stateName), `${componentName} must read ${stateName} from props`);
    }
  }
});
