# Skill: error-handling

Use this skill whenever you are implementing error handling in controllers, use cases, or adapters. Apply consistent error mapping, logging, and response formatting across the entire project.

## Trigger

Invoke automatically when the user says things like:
- "trata erros em X"
- "adiciona error handling"
- "mapeia exceções"
- "resposta de erro"
- "erro de domínio / EntityNotFoundError / ExternalServiceError"

## Rules

### General constraints

- **Never leave an error unhandled** — no unhandled promise rejections.
- **Never expose stack traces to the client** in production.
- **Every error must be logged** with `correlationId` before being responded.
- The `X-Correlation-Id` header must be present in **every error response**, just as in success responses.

### HTTP status mapping

| Error type | HTTP status |
|---|---|
| `DomainError` (base) | 422 |
| `EntityNotFoundError` | 404 |
| Zod validation error | 400 — include field details |
| `ExternalServiceError` (Spotify, Claude API) | 502 — generic message only |
| Any other unexpected error | 500 — generic message only |

### Domain error hierarchy

Maintain and expand this hierarchy under `src/domain/errors/`:

```
DomainError (base)
├── EntityNotFoundError
├── InvalidValueError
└── ExternalServiceError   ← new — for Spotify and Claude API failures
```

All domain errors must carry a `code: string` property for structured logging and client responses.

### Mandatory error log template

Every `catch` block that handles an error within a request flow must log:

```typescript
logger.error({
  correlationId,
  error: err.message,
  stack: err.stack,
  code: err instanceof DomainError ? err.code : 'UNKNOWN'
}, 'ClassName.methodName - error occurred');
```

### Client error response format

Never expose stack traces. Always return:

```json
{
  "error": "clear message for the user",
  "code": "DOMAIN_ERROR_CODE",
  "correlationId": "xxxx"
}
```

The `correlationId` in the error response allows the user to report the issue and the team to find the exact corresponding log entry.

## Code patterns

### Centralized error handler in the controller / Fastify error hook

```typescript
fastify.setErrorHandler((err, request, reply) => {
  const correlationId = (request.headers['x-correlation-id'] as string) ?? 'unknown';
  logger.error({
    correlationId,
    error: err.message,
    stack: err.stack,
    code: err instanceof DomainError ? err.code : 'UNKNOWN'
  }, 'ErrorHandler - unhandled error');

  reply.header('X-Correlation-Id', correlationId);

  if (err instanceof EntityNotFoundError) {
    return reply.status(404).send({ error: err.message, code: err.code, correlationId });
  }
  if (err instanceof DomainError) {
    return reply.status(422).send({ error: err.message, code: err.code, correlationId });
  }
  if (err instanceof ZodError) {
    return reply.status(400).send({ error: 'Validation error', code: 'VALIDATION_ERROR', details: err.errors, correlationId });
  }
  if (err instanceof ExternalServiceError) {
    return reply.status(502).send({ error: 'External service unavailable', code: err.code, correlationId });
  }
  return reply.status(500).send({ error: 'Internal server error', code: 'INTERNAL_ERROR', correlationId });
});
```

### Use case / adapter catch block

```typescript
try {
  // ...
} catch (err) {
  logger.error({
    correlationId,
    error: (err as Error).message,
    stack: (err as Error).stack,
    code: err instanceof DomainError ? err.code : 'UNKNOWN'
  }, 'PrepareReadingSessionInteractor.execute - error occurred');
  throw err; // re-throw so the centralized handler maps it to HTTP
}
```

## Constraints

- Never swallow errors silently — always either re-throw or respond.
- Never return a stack trace in any JSON response field.
- Never handle the same error in both the use case and the controller — use case catches, logs, and re-throws; controller (or Fastify error hook) maps to HTTP.
- `ExternalServiceError` must be thrown by adapters when a third-party call fails, so use cases never need to know the HTTP status of Spotify or Claude API.
