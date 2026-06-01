/**
 * Architecture tests — enforce Hexagonal Architecture boundaries at the code level.
 * These run in CI and fail the build if any layer imports from a forbidden layer.
 *
 * Rules:
 *   domain   → can only import from domain itself
 *   ports    → can import from domain only
 *   application → can import from domain and ports only
 *   adapters → can import from anywhere (they are the outermost layer)
 */

import * as path from 'path';
import * as fs from 'fs';

const SRC = path.resolve(__dirname, '../../src');

function getAllTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap(e =>
    e.isDirectory()
      ? getAllTsFiles(path.join(dir, e.name))
      : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : [],
  );
}

function getImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const matches = content.matchAll(/^import .+ from ['"]([^'"]+)['"]/gm);
  return [...matches].map(m => m[1]);
}

function isInternalImport(importPath: string): boolean {
  return importPath.startsWith('.') || importPath.startsWith('@domain') ||
    importPath.startsWith('@ports') || importPath.startsWith('@application') ||
    importPath.startsWith('@adapters');
}

function resolveImportLayer(importPath: string, fromFile: string): string | null {
  const resolved = importPath.startsWith('.')
    ? path.resolve(path.dirname(fromFile), importPath)
    : null;

  if (!resolved) {
    if (importPath.startsWith('@domain')) return 'domain';
    if (importPath.startsWith('@ports')) return 'ports';
    if (importPath.startsWith('@application')) return 'application';
    if (importPath.startsWith('@adapters')) return 'adapters';
    return null;
  }

  const rel = path.relative(SRC, resolved);
  if (rel.startsWith('domain')) return 'domain';
  if (rel.startsWith('ports')) return 'ports';
  if (rel.startsWith('application')) return 'application';
  if (rel.startsWith('adapters')) return 'adapters';
  return null;
}

function getFileLayer(filePath: string): string | null {
  const rel = path.relative(SRC, filePath);
  if (rel.startsWith('domain')) return 'domain';
  if (rel.startsWith('ports')) return 'ports';
  if (rel.startsWith('application')) return 'application';
  if (rel.startsWith('adapters')) return 'adapters';
  return null;
}

const FORBIDDEN: Record<string, string[]> = {
  domain: ['adapters', 'application'],
  ports: ['adapters'],
  application: ['adapters'],
};

describe('Hexagonal Architecture boundary tests', () => {
  const allFiles = getAllTsFiles(SRC);

  allFiles.forEach(file => {
    const fileLayer = getFileLayer(file);
    if (!fileLayer || !FORBIDDEN[fileLayer]) return;

    const imports = getImports(file).filter(isInternalImport);
    const rel = path.relative(SRC, file);

    imports.forEach(imp => {
      const importLayer = resolveImportLayer(imp, file);
      if (!importLayer) return;

      const forbidden = FORBIDDEN[fileLayer] ?? [];

      it(`[${fileLayer}] ${rel} must not import from [${importLayer}]`, () => {
        expect(forbidden).not.toContain(importLayer);
      });
    });
  });

  it('domain layer exists and has entities', () => {
    const domainFiles = allFiles.filter(f => getFileLayer(f) === 'domain');
    expect(domainFiles.length).toBeGreaterThan(0);
  });

  it('ports layer exists and has driving/driven ports', () => {
    const portFiles = allFiles.filter(f => getFileLayer(f) === 'ports');
    expect(portFiles.length).toBeGreaterThan(0);
  });

  it('application layer does not directly reference adapter classes', () => {
    const appFiles = allFiles.filter(f => getFileLayer(f) === 'application');
    appFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/InMemory|PgUser|SpotifyApiAdapter|UuidGenerator/);
    });
  });

  it('domain layer does not reference any framework packages', () => {
    const domainFiles = allFiles.filter(f => getFileLayer(f) === 'domain');
    const forbidden = ['fastify', 'express', 'nestjs', 'typeorm', 'prisma', 'mongoose'];
    domainFiles.forEach(file => {
      const imports = getImports(file).filter(i => !isInternalImport(i));
      imports.forEach(imp => {
        const isForbidden = forbidden.some(pkg => imp.includes(pkg));
        expect(isForbidden).toBe(false);
      });
    });
  });
});
