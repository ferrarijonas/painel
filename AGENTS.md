# AGENTS.md — painel

Protocolo vinculante para sessões de trabalho neste repositório.
Lido por agentes antes de qualquer mudança.

## O que é este projeto

Painel da padaria "Pão de Verdade" — **linha do balanço** (Line of Balance /
flowline) do dia de produção 8h–18h, exibido numa TV na produção e controlado
por controle remoto (D-pad) ou celular. O coração é um **agendador automático**
por recursos: você escolhe as tarefas, o sistema encaixa sozinho em sequência
ou paralelo e re-encaixa dependentes quando algo é empurrado.

Metáfora: o maquinista do dia — você põe as tarefas na linha; o sistema traça a ferrovia no tempo.

Stack: JS puro (sem framework), compatível com Firefox 68 (TV box), Firebase
Realtime Database (sync entre clientes), GitHub Pages (hosting).

## Regra de ouro do fluxo de trabalho

**Toda mudança vai para o GitHub e é testada lá.** A versão oficial é a
publicada, não a local. Sequência obrigatória:

1. Editar (código e/ou specs)
2. Testar local: `node build.js` + `node test-scheduler.js` (+ `node test-render.js` quando mexer em render/boot)
3. `git add` + `git commit` + `node versao.js` (grava o hash do deploy) + `git add versao.json` + `git commit` + `git push origin main`
4. Aguardar o GitHub Pages atualizar (~60–75s)
5. Testar em `https://ferrarijonas.github.io/painel/` via `node diag-edge.js https://ferrarijonas.github.io/painel/ online`

O painel mostra um aviso "nova versão · OK para atualizar" quando detecta um
deploy novo (via `versao.json`) — dados do dia (Firebase) sincronizam sozinhos;
código novo exige um reload da página.

Não parar antes do passo 5. Página oficial: `https://ferrarijonas.github.io/painel/`.

## Specs — fonte da verdade

As specs vivem fora do repo, em `../ZenSpecKit/`:

| Arquivo | Papel |
|---|---|
| `painel.concept-spec.md` | o porquê (Concept) |
| `painel.eng-spec.md` | a estrutura (Eng) |
| `painel.stack-spec.md` | a stack |
| `scheduler.zenspec.md` | ZenSpec do agendador |

Regra Zen (`ZenSpec.md`): **spec prevalece sobre código**; mudança de
comportamento exige mudança prévia de spec. Na prática, iterações visuais
rápidas podem ir direto ao código a pedido do dono — mas o comportamento do
`scheduler` nunca deve divergir da spec sem atualizá-la.

## Arquitetura (Eng §3)

Módulos em `js/` (IIFE, expostos em `window`, carregados por `<script>` na ordem):

| Módulo | Papel |
|---|---|
| `scheduler` | calcula/recalcula o encaixe do dia (regras de recurso + dependências) |
| `resourceRegistry` | conhece os recursos e tipos de ocupação |
| `personCounter` | pessoas presentes (1..4) |
| `dayStore` | persiste dias por data |
| `deviceSync` | sincroniza estado compartilhado (Firebase; fallback local em 8s) |
| `timelineRenderer` | desenha a linha do balanço (pistas, trilhas, conectores) |
| `remoteNav` | foco/seleção por D-pad |

### Taxonomia de recursos

`exclusivo` (1 por vez) · `capacidade-N` (até N) · `passivo` (não bloqueia) ·
`pessoa-ativa` (exige pessoa presente) · `livre` (sem recurso).

Flags de tarefa: `dependeDe[]` (cadeia), `ateFim: true` (ocupa até 18h),
`cor` (cor opcional da barra).

### Seed do dia

`js/main.js` tem `SEED_VERSION` (marca a versão do seed). O seed **só
preenche dia vazio** — o dia do usuário persiste para sempre; não há
re-seed por versão (bump de seed **não** reseta mais o dia). Para forçar
reset do demo, esvazie `tarefas` da data no Firebase. O seed só é gravado
na nuvem após o 1º snapshot real (evita sobrescrever um dia existente
com rede lenta/modo local).

## Modelo visual (padrão ouro da indústria)

- Tempo na **horizontal** (8h–18h); eixo Y = **postos** em ordem de fluxo.
- Cada receita/fornada = linha diagonal (conectores SVG) cruzando os postos.
- Barras que se sobrepõem na mesma pista **empilham em trilhas**.
- Barra selecionada ganha **garras**: `corpo` (mover etapa), `fim` (estica/
  encurta duração, começo fixo), `começo` (mantém o fim = "Must Finish On").
  `↑`/`↓` alterna a garra; `←`/`→` aplica (passo 15min). Sucessores seguem
  a etapa movida (sem folga); predecessores ficam.
- Linha vertical "agora" varrendo o dia.
- Cor por tipo de receita (`COR_PAO`); pistas alternam fundo.

## Comandos

```bash
node serve.js [porta]                      # servidor estático (padrão 8080)
node build.js                              # valida assets + sintaxe JS
node test-scheduler.js                     # testes do agendador (node puro)
node test-render.js                        # boot real (servidor na 8125 + Chrome)
node diag-edge.js <url> [online|nodb]      # diagnóstico no Edge real
node diag-layout.js <url>                  # retângulos/colisões do layout (sem visão)
node diag-interact.js <url>                # interação por D-pad (menu, seleção, empurrar)
node diag-config.js <url>                  # modal de config da tarefa (não-destrutivo)
node diag-grips.js <url>                   # garras da barra selecionada (não-destrutivo)
node diag-persist.js <url>                 # persistência após reload (não-destrutivo)
node diag-shot.js <url> [png]              # screenshot para inspeção
```

`test-render.js` espera o servidor em `http://localhost:8125/` e um Chrome
instalado. `diag-edge.js` usa o Edge instalado; `nodb` simula Firebase
inacessível (bloqueia DNS do `firebaseio.com`).

## Convenções

- **Idioma:** UI, comentários e commits em português.
- **Estilo:** JS puro, ES2015+ mas compatível com Firefox 68 (nada além de
  ES2017). Módulos como IIFE com `module.exports` para testes node.
- **Comentários:** curtos, explicam o "porquê" (convenção do projeto).
- **Identidade visual:** "Pão de Verdade" — cinza quente + acento marrom
  `#4A2E1B`, terracota `#B3541E` (pão), títulos Playfair Display, corpo Open
  Sans, UI 10-foot (legível a ~3m).
- **Não adicionar:** frameworks, bundlers, dependências externas desnecessárias.