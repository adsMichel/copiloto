#!/usr/bin/env node

import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

// Remove stale Next.js lock file that can prevent `next dev` from starting in some environments.
// This is a developer convenience only; Next.js normally manages this itself.
const lockPath = join(process.cwd(), '.next', 'dev', 'lock');
if (existsSync(lockPath)) {
  console.log('Removing stale Next.js dev lock:', lockPath);
  rmSync(lockPath, { force: true });
}

const args = ['dev', ...process.argv.slice(2)];

const child = spawn('next', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 0));
