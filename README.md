# painel — Pão de Verdade · Linha do Dia

Painel de **linha do balanço** (Line of Balance / flowline) do dia de produção
(8h–18h) para padaria, confeitaria e cozinha profissional. Exibe o dia na tela
da produção (TV), controlado por controle remoto (D-pad) ou celular, com
**agendamento automático** por recursos: as tarefas encaixam sozinhas em
sequência ou paralelo e re-encaixam dependentes quando algo muda.

## O que ele faz

- Mostra o dia inteiro numa flowline: tempo na horizontal, postos em pistas
  (masseira → fermentação → modelagem → temperatura ambiente → geladeira).
- Cada receita/fornada cruza os postos como uma linha diagonal.
- O `scheduler` resolve sozinho choques de equipamento (masseira exclusiva,
  forno com capacidade) e de gente (1 a 4 pessoas presentes).
- Estado compartilhado: TV box e celulares veem a mesma verdade via Firebase
  RTDB. Sem rede → modo local com aviso no rodapé.

## Como rodar

```bash
npm install        # apenas puppeteer-core (dev)
node serve.js      # http://localhost:8080
```

Abra `http://localhost:8080` (ou o IP da máquina no navegador do TV box).

## Como testar

```bash
node build.js            # integridade (assets + sintaxe)
node test-scheduler.js   # testes do agendador
node serve.js 8125 &     # servidor para o teste de render
node test-render.js      # boot real em Chrome headless
node diag-edge.js https://ferrarijonas.github.io/painel/ online
```

## Como publicar

Toda mudança vai para o GitHub e é validada na versão publicada:

```bash
git add -A && git commit -m "painel: ..."
git push origin main
# aguarde ~60–75s e confira https://ferrarijonas.github.io/painel/
```

## Estrutura

```
index.html            # tela única (header + timeline + footer)
css/estilo.css        # identidade visual 10-foot
js/
  scheduler.js        # motor de agendamento (regras de recurso)
  resourceRegistry.js # recursos e tipos de ocupação
  personCounter.js    # pessoas presentes (1..4)
  dayStore.js         # dias por data
  deviceSync.js       # sync Firebase + fallback local (8s)
  timelineRenderer.js # flowline (pistas, trilhas, conectores)
  remoteNav.js        # navegação D-pad
  main.js             # boot + seed + orquestração
firebase-config.js    # credenciais Firebase (window.FIREBASE_CONFIG)
serve.js              # servidor local estático
build.js              # validação de integridade
test-scheduler.js     # testes do agendador
test-render.js        # teste de boot (Chrome headless)
diag-edge.js          # diagnóstico no Edge real
diag-mobile.js        # layout em viewport de celular (retrato)
diag-local.js         # backup localStorage (salva → reload → espelho)
```

## Specs

Documentação completa (conceito, engenharia, stack e ZenSpecs) em
`../ZenSpecKit/` — fonte da verdade do comportamento. Ver `AGENTS.md` para o
fluxo de trabalho e convenções.