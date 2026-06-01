/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-domain-to-adapters',
      severity: 'error',
      comment: 'Domain layer must never depend on Adapters',
      from: { path: '^src/domain' },
      to: { path: '^src/adapters' },
    },
    {
      name: 'no-domain-to-application',
      severity: 'error',
      comment: 'Domain layer must never depend on Application layer',
      from: { path: '^src/domain' },
      to: { path: '^src/application' },
    },
    {
      name: 'no-ports-to-adapters',
      severity: 'error',
      comment: 'Ports (interfaces) must never depend on Adapters',
      from: { path: '^src/ports' },
      to: { path: '^src/adapters' },
    },
    {
      name: 'no-application-to-adapters',
      severity: 'error',
      comment: 'Application use cases must never depend on concrete Adapters',
      from: { path: '^src/application' },
      to: { path: '^src/adapters' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'No circular dependencies anywhere',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/[^/]+' },
    },
  },
};
