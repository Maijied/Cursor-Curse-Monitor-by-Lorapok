import '@testing-library/jest-dom';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteDataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../site-data.json');

if (!process.env.SITE_DATA_FILE && existsSync(siteDataPath)) {
  process.env.SITE_DATA_FILE = siteDataPath;
}
