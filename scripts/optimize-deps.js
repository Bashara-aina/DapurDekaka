
#!/usr/bin/env node

/**
 * This script analyzes the project dependencies and recommends which can be removed
 * Run with: node scripts/optimize-deps.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read package.json
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// List of dependencies to check
const dependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies
};

// Recommended optimizations
const optimizations = [
  {
    type: 'REDUNDANT',
    name: ['clsx', 'tailwind-merge'],
    action: 'Keep both but use only through our centralized "cn" utility function',
    reason: 'These are used together for class merging'
  },
  {
    type: 'DUPLICATE',
    name: ['@iconify/react', 'react-icons', 'lucide-react'],
    action: 'Standardize on lucide-react for all icons',
    reason: 'Multiple icon libraries add unnecessary weight'
  },
  {
    type: 'LARGE',
    name: ['framer-motion'],
    action: 'Use CSS animations or a lighter alternative when possible',
    reason: 'Adds ~100KB to bundle size'
  },
  {
    type: 'RADIX_UI',
    name: Object.keys(dependencies).filter(dep => dep.startsWith('@radix-ui/')),
    action: 'Import only used components through dependency-manager.ts',
    reason: '24 separate packages increase bundle size significantly'
  }
];

console.log('=== Dependency Optimization Report ===\n');

optimizations.forEach(opt => {
  console.log(`${opt.type}: ${Array.isArray(opt.name) ? opt.name.join(', ') : opt.name}`);
  console.log(`Action: ${opt.action}`);
  console.log(`Reason: ${opt.reason}\n`);
});

console.log('To implement these optimizations:');
console.log('1. Use the dependency-manager.ts file for imports');
console.log('2. Update component imports to use the centralized exports');
console.log('3. Consider running "npm prune" after removing unused dependencies');
