// T-100 F-4 guards. Browser-measured contrast (rendered pixels, both design modes, light and dark, 360 and 1280 px) is the evidence;
// these static checks only stop the specific regressions from coming back: dimmed action buttons and too-light completed titles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = (name) => readFileSync(fileURLToPath(new URL(`../src/styles/${name}`, import.meta.url)), 'utf8');
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const taskTitle = (file, nth) => [...css(file).matchAll(/--lg-task-title:\s*(#[0-9a-f]{6})/gi)][nth][1];

test('F-4: task action buttons are not dimmed at rest', () => {
  assert.doesNotMatch(css('design.css').replace(/\/\*[\s\S]*?\*\//g, ''), /\.task-actions\s*\{[^}]*opacity:\s*0?\.\d+/);
});

test('F-4: completed task title tokens keep AA against the lightest and darkest measured backgrounds', () => {
  // Backgrounds are the worst measured cases: Vibrant light about 0.568 luminance, Vibrant dark about 0.075 to 0.111, Minimal light white.
  assert.ok(lum(taskTitle('liquid.css', 0)) <= 0.08, 'vibrant light completed title too light');
  assert.ok(lum(taskTitle('liquid.css', 1)) >= 0.68, 'vibrant dark completed title too dark for the purple panel');
  assert.ok(ratio(taskTitle('dashboardMinimal.css', 0), '#ffffff') >= 4.5, 'minimal light completed title below 4.5 to 1');
  assert.ok(ratio(taskTitle('dashboardMinimal.css', 1), '#111113') >= 4.5, 'minimal dark completed title below 4.5 to 1');
});
