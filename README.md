# Vitoria

Plataforma independente para análise estatística da Mega-Sena, geração de combinações e organização de bolões.

## Objetivos

- Analisar o histórico de concursos e apresentar estatísticas de frequência, atraso, soma e paridade.
- Gerar jogos com dezenas fixas ou excluídas e filtros configuráveis.
- Criar desdobramentos e fechamentos combinatórios.
- Organizar bolões, participantes, cotas e conferência de resultados.

## Dados históricos

O arquivo [`resultados_ate_3087.csv`](./resultados_ate_3087.csv) contém os resultados usados como carga inicial, dos concursos 1 a 3087. As regras de importação e o escopo funcional estão descritos no [PRD](./PRD.md).

## Tecnologias previstas

- Next.js (App Router) e TypeScript
- Tailwind CSS e shadcn/ui
- PostgreSQL / Supabase

## Situação

Este repositório está em fase de definição do MVP. Os requisitos funcionais, dados, arquitetura proposta e critérios de aceite estão no [PRD](./PRD.md).

## Aviso importante

Este projeto é independente e não possui vínculo com a Caixa Econômica Federal. Não realiza apostas financeiras e não garante premiações. As estatísticas e combinações geradas não aumentam a probabilidade matemática de ganhar.
