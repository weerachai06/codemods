#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const transformPath = path.resolve(__dirname, '../dist/transform/forward-ref-to-ref-prop.js');
const files = process.argv[2] || './src/**/*.tsx';

try {
    execSync(`jscodeshift --parser=tsx -t ${transformPath} ${files}`, {
        stdio: 'inherit'
    });
} catch (error) {
    console.error('Transform failed:', error);
    process.exit(1);
}