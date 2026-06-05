Antes de qualquer commit neste projeto, sempre execute obrigatoriamente
e nesta ordem:

1. npm run typecheck
2. npm run test:unit
3. npm run test:arch

Regras:
- Se qualquer um falhar, NÃO fazer o commit
- Corrigir todos os erros antes de prosseguir
- Só após os três passarem com zero erros, fazer o commit
- Logar o resultado de cada validação antes de commitar:
  "✓ typecheck passed"
  "✓ unit tests passed (X/X)"
  "✓ architecture tests passed (X/X)"
- Nunca pular esta validação com --no-verify ou argumentos similares
- Esta regra se aplica a qualquer commit, em qualquer branch

Esta skill é ativada automaticamente sempre que Claude for executar
um git commit neste repositório.
