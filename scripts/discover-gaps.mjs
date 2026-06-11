#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

/**
 * discover-gaps.mjs
 * 
 * This script analyzes the codebase to identify gaps in tests, documentation, and structure.
 * It follows the self-sustaining loop workflow defined in AGENTS.md.
 */

const PROJECT_ROOT = process.cwd();

function analyze() {
  const gaps = [];

  // 1. Missing Unit Tests
  const utilsDir = path.join(PROJECT_ROOT, 'server/utils');
  const testsDir = path.join(PROJECT_ROOT, 'server/utils/tests');
  if (fs.existsSync(utilsDir) && fs.statSync(utilsDir).isDirectory()) {
    const utils = fs.readdirSync(utilsDir).filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'));
    const tests = fs.existsSync(testsDir) ? fs.readdirSync(testsDir) : [];
    
    utils.forEach(util => {
      const base = util.replace('.ts', '');
      if (!tests.some(t => t.startsWith(base))) {
        gaps.push({
          type: 'Test implementation',
          title: `Add unit tests for ${util}`,
          description: `The utility file \`server/utils/${util}\` is missing unit tests in \`server/utils/tests\`. Implement comprehensive Vitest tests covering core logic and edge cases.`
        });
      }
    });
  }

  // 2. Fuzz Testing
  gaps.push({
    type: 'Performance & Fuzzing',
    title: 'Expand Fuzz Testing to other utilities',
    description: 'Fuzz testing is currently implemented for ID and Slug generation. Expand it to other critical utilities like task reordering logic or input validation to ensure robustness against malformed data.'
  });

  // 3. Refactoring (Large Components)
  const componentsDir = path.join(PROJECT_ROOT, 'app/components');
  if (fs.existsSync(componentsDir)) {
    const components = fs.readdirSync(componentsDir).filter(f => f.endsWith('.vue'));
    components.forEach(comp => {
      const filePath = path.join(componentsDir, comp);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').length;
      if (lines > 500) {
        gaps.push({
          type: 'Refactoring',
          title: `Refactor ${comp}`,
          description: `The component \`app/components/${comp}\` is quite large (${lines} lines). Consider breaking it down into smaller, reusable components to improve maintainability and testability.`
        });
      }
    });
  }

  // 4. Security
  gaps.push({
    type: 'Security',
    title: 'Security Audit: API Rate Limiting',
    description: 'Audit critical API endpoints (authentication, board/task creation) and implement rate limiting if missing to prevent brute-force attacks and abuse.'
  });

  return gaps;
}

const gaps = analyze();

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(gaps, null, 2));
} else {
  console.log('--- Project Gap Analysis ---');
  if (gaps.length === 0) {
    console.log('No obvious gaps found! Great job.');
  } else {
    gaps.forEach((gap, i) => {
      console.log(`${i + 1}. [${gap.type.toUpperCase()}] ${gap.title}`);
      console.log(`   ${gap.description}`);
      console.log();
    });
  }
  console.log('--- End of Analysis ---');
}
