
/**
 * This script analyzes and removes unused dependencies from the project
 * Run with: node scripts/cleanup-deps.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Files marked for deletion indicate unused components
const filesMarkedForDeletion = [
  'client/src/components/ui/resizable.tsx',
  'client/src/components/ui/skeleton.tsx',
  'client/src/components/ui/input-otp.tsx',
  'client/src/components/ui/pagination.tsx',
  'client/src/components/ui/chart.tsx',
  'client/src/components/ui/drawer.tsx',
  'client/src/hooks/use-mobile.tsx'
];

// Dependencies to remove based on files marked for deletion
const dependenciesToRemove = {
  // UI Components related
  'react-resizable-panels': 'Unused resizable panels component',
  'input-otp': 'Unused OTP input component',
  'recharts': 'Unused chart component',
  'vaul': 'Unused drawer component',
  
  // Duplicate icon libraries (as mentioned in optimize-deps.js)
  '@iconify/react': 'Standardize on lucide-react for icons',
  'react-icons': 'Standardize on lucide-react for icons',
  
  // Unused frameworks/components
  'framer-motion': 'Heavy dependency (~100KB), use CSS animations instead',
  'embla-carousel-autoplay': 'Can be replaced with CSS or simpler carousel',
  'embla-carousel-react': 'Can be replaced with CSS or simpler carousel',
  'cmdk': 'Command menu library not used in project',
  
  // Files that can be deleted
  '@types/react-helmet': 'react-helmet appears unused in the project',
  'react-helmet': 'Appears unused in the project',
  '@dnd-kit/core': 'Drag and drop functionality not used',
  '@dnd-kit/sortable': 'Drag and drop functionality not used',
  '@dnd-kit/utilities': 'Drag and drop functionality not used',
  '@tinymce/tinymce-react': 'Rich text editor not used',
  'ws': 'WebSockets not used in the application',
  '@types/ws': 'WebSockets not used in the application',
  'google-auth-library': 'Google auth not implemented',
  'google-spreadsheet': 'Google spreadsheet not used'
};

// Save original dependencies for reference
const originalDependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies
};

// Output the optimization plan
console.log('=== Dependency Cleanup Plan ===\n');
Object.entries(dependenciesToRemove).forEach(([dep, reason]) => {
  const exists = originalDependencies[dep] !== undefined;
  console.log(`${exists ? '✓' : '✗'} ${dep}`);
  console.log(`  ${reason}`);
  console.log(`  Currently installed: ${exists ? 'Yes' : 'No'}\n`);
});

// Create uninstall command
const depsToUninstall = Object.keys(dependenciesToRemove).filter(dep => 
  originalDependencies[dep] !== undefined
);

if (depsToUninstall.length > 0) {
  console.log(`To remove these dependencies, run:\n`);
  console.log(`npm uninstall ${depsToUninstall.join(' ')}\n`);
  
  // Automatically remove the dependencies
  try {
    console.log('Removing dependencies...');
    execSync(`npm uninstall ${depsToUninstall.join(' ')}`, { stdio: 'inherit' });
    console.log('Dependencies successfully removed!');
  } catch (error) {
    console.error('Error removing dependencies:', error.message);
  }
} else {
  console.log('No unused dependencies found to remove.');
}

// Create recommendations for remaining dependencies
const centralizeRadixImports = Object.keys(originalDependencies)
  .filter(dep => dep.startsWith('@radix-ui/'))
  .join('\n  - ');

if (centralizeRadixImports) {
  console.log('\nRecommendations for Radix UI components:');
  console.log('Consider creating a centralized import file for these dependencies:');
  console.log(`  - ${centralizeRadixImports}`);
  console.log('\nThis can reduce bundle size by ensuring components are only imported when needed.');
}
