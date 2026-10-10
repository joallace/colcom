// The foundational topics every instance opens under the reserved "meta" tag (src/meta.ts), shown in
// these groups and in this order on /meta. Each instance's operator may edit them: a topic is found
// again by its title, so a changed title opens a new topic (the old one keeps its tag and history).
// Bodies are HTML, as the editor emits it, and must pass the `topic` schema (test/unit/meta.test.ts).

export interface MetaTopic {
  title: string,
  body: string,
  // Empty leaves the answers open: each post is an answer, and the poll ranks them
  answers: string[]
}

export interface MetaGroup {
  key: string,
  name: string,
  description: string,
  topics: MetaTopic[]
}

export const META_TAG = "Meta"

// Opens every body: what a foundational topic is, and how its outcome is read until synthesis
// posts exist
const INTRO = "<p><em>Tópico fundamental do colcom.</em> Foi aberto pela própria instância, e não por uma pessoa, para que quem participa decida junto como o colcom deve ser e funcionar. Responda com um post, critique os trechos de que discorda e vote no que mais convence: o post mais votado é, por enquanto, a posição da comunidade.</p>"

const body = (...blocks: string[]) => [INTRO, ...blocks].join("")

export const META_GROUPS: MetaGroup[] = [
  {
    key: "carta",
    name: "Carta do colcom",
    description: "Os fundamentos: por que o colcom existe, aonde quer chegar e no que acredita.",
    topics: [
      {
        title: "Por que o colcom existe?",
        answers: [],
        body: body(
          "<p>A missão de um projeto é a sua razão de ser. Como ponto de partida, uma proposta, para ser defendida, criticada ou substituída:</p>",
          "<p><strong>O colcom triunfará com a pluralidade.</strong> Na computação gráfica, a equação de renderização diz que a luz que vemos sair de um ponto, a sua radiância, é a integral de todos os feixes de luz que chegam a ele, vindos de todas as direções. Nas cenas reais essa integral não tem solução exata, mas o método de Monte Carlo a aproxima lançando raios em direções aleatórias: cada raio é uma amostra, e quanto mais amostras, mais a média se aproxima do valor real e menos ruído resta na imagem.</p>",
          "<p>O campo do colcom é o da opinião. A opinião coletiva é a integral de todas as perspectivas, e cada pessoa que escreve, critica ou vota é uma amostra dela. Quanto mais opiniões obtivermos, mais nos aproximaremos do valor real da opinião coletiva, e mais compensaremos a nossa fraqueza de estarmos restritos aos usuários que participam. Mas, como no Monte Carlo, amostras que vêm sempre das mesmas direções convergem para a resposta errada: não basta ter muitas vozes, elas precisam vir de todos os lados.</p>",
          "<p>Daí a proposta de missão: <em>aproximar, pela colaboração e pela competição entre ideias, a opinião coletiva real sobre as questões que importam, de forma aberta e auditável.</em> Colaboração, porque qualquer pessoa pode sugerir mudanças num texto e o autor pode aceitá-las. Competição, porque cada passagem pode ser criticada e cada tópico tem a sua votação. O que sobrevive à crítica e convence pessoas de lados diferentes é o que mais se aproxima desse valor.</p>",
          "<p>Concorda, discorda ou vê outra razão de ser para o colcom? Escreva a sua resposta.</p>"
        )
      },
      {
        title: "Como o colcom deveria ser?",
        answers: [],
        body: body(
          "<p>A missão diz por que o colcom existe; a visão diz aonde ele quer chegar. Como o colcom deveria ser daqui a alguns anos? Quem o usaria, para decidir o quê, e como saberíamos que deu certo?</p>",
          "<p>Algumas perguntas para começar:</p>",
          "<ul><li><p>O colcom deveria servir a governos, como o Brasil Participativo, o Decidim e o vTaiwan, a comunidades e organizações, ou a qualquer conversa pública?</p></li><li><p>Os resultados daqui deveriam ter consequências fora dele, subsidiando leis, orçamentos ou as decisões de uma organização?</p></li><li><p>Qualquer um pode hospedar o seu próprio colcom. Cada instância deveria ser independente, ou elas deveriam conversar entre si?</p></li><li><p>Que tamanho de discussão o colcom deveria suportar: dezenas de pessoas, ou milhões?</p></li></ul>",
          "<p>Descreva num post o colcom que você gostaria de ver. Quanto mais concreto, mais fácil criticá-lo e melhorá-lo.</p>"
        )
      },
      {
        title: "Quais valores o colcom deve seguir?",
        answers: [],
        body: body(
          "<p>Valores são os critérios com que julgamos todo o resto: as regras de moderação, as funcionalidades novas, a forma de contar os votos. Quais valores o colcom deve seguir e, quando dois deles entram em conflito, qual pesa mais?</p>",
          "<p>Alguns candidatos, para serem defendidos, criticados ou substituídos:</p>",
          "<ul><li><p><strong>Pluralidade:</strong> todas as perspectivas têm lugar, e quanto mais diversas forem as vozes, mais perto chegamos da opinião coletiva real. Uma ideia vale pelo que convence, não por quem a defende nem por quantos a repetem.</p></li><li><p><strong>Transparência:</strong> cada versão de um texto, cada voto e cada tag ficam num histórico que qualquer pessoa pode auditar, e nenhuma regra é secreta.</p></li><li><p><strong>Abertura:</strong> o código é livre, e qualquer comunidade pode hospedar a sua própria instância.</p></li><li><p><strong>Igualdade:</strong> uma pessoa, um voto, e as mesmas regras para todos, inclusive para quem mantém o colcom.</p></li><li><p><strong>Boa-fé no debate:</strong> criticar ideias, não pessoas. Mudar de opinião diante de um bom argumento é um acerto, não uma derrota.</p></li></ul>",
          "<p>Um post pode defender um conjunto de valores, uma ordem de prioridade entre eles, ou um valor que falta nesta lista.</p>"
        )
      }
    ]
  },
  {
    key: "funcionamento",
    name: "Funcionamento",
    description: "Como o colcom funciona hoje, e como deve mudar.",
    topics: [
      {
        title: "Como melhorar o colcom?",
        answers: [],
        body: body(
          "<p>O que está faltando, o que atrapalha e o que deveria mudar no colcom? Este tópico junta o diagnóstico e a proposta: um post pode descrever um problema, uma solução, ou os dois.</p>",
          "<p>Para que a discussão renda:</p>",
          "<ul><li><p>um problema por post, para que cada um seja votado e criticado por si só;</p></li><li><p>diga quem ele afeta e como, com exemplos;</p></li><li><p>se já existe um post sobre o mesmo problema, sugira uma edição nele em vez de abrir outro.</p></li></ul>",
          "<p>A votação deste tópico funciona como uma fila de prioridades: o post mais votado é o que a comunidade considera mais urgente.</p>"
        )
      },
      {
        title: "O colcom promove o consenso?",
        answers: ["sim", "não", "em parte"],
        body: body(
          "<p>O colcom foi feito para a dialética: uma tese, as críticas que ela recebe e, delas, uma síntese melhor que ambas. A aposta é que, colaborando nos textos e competindo pelas melhores ideias, pessoas de lados diferentes encontrem pontos em comum, em vez de apenas se entrincheirar.</p>",
          "<p>Essa aposta está dando certo? Responda com o que você viu aqui: discussões em que alguém mudou de ideia, críticas que melhoraram um texto ou, ao contrário, votações que só repetiram as divisões de fora.</p>",
          "<p>Também vale propor como medir isso. Uma ideia é dar mais peso aos posts que convencem pessoas que costumam votar de forma diferente entre si, o ranqueamento por pontes usado pelo Pol.is e pelas Notas da Comunidade do X.</p>"
        )
      },
      {
        title: "Quais regras de conduta e moderação o colcom deve ter?",
        answers: [],
        body: body(
          "<p>Hoje o colcom não tem moderação: nada é removido, e não há regras escritas sobre o que se pode publicar. Isso protege contra a censura, mas deixa a porta aberta para ataques pessoais, spam e desinformação.</p>",
          "<p>Que regras o colcom deve ter, e quem deve aplicá-las?</p>",
          "<ul><li><p>O que deveria ser proibido, e o que deveria ser apenas desencorajado?</p></li><li><p>Quem decide se uma regra foi quebrada: quem hospeda a instância, moderadores eleitos, um júri sorteado entre os participantes, ou todos, por votação?</p></li><li><p>Como recorrer de uma decisão, e como manter um registro público das moderações, como já acontece com os votos?</p></li></ul>",
          "<p>Proponha num post um conjunto de regras, um processo para aplicá-las, ou os dois.</p>"
        )
      },
      {
        title: "O resultado das votações meta deve obrigar quem mantém o colcom?",
        answers: ["sim", "não", "só acima de um limiar"],
        body: body(
          "<p>Os tópicos meta discutem como o colcom deve funcionar. Mas quem escreve o código e quem hospeda cada instância pode simplesmente ignorar o resultado. As votações daqui devem obrigar quem mantém o colcom, ou servir apenas de orientação?</p>",
          "<ul><li><p><strong>sim:</strong> o que a comunidade decide aqui deve ser implementado.</p></li><li><p><strong>não:</strong> as votações orientam, mas quem mantém o colcom tem a palavra final, por exemplo por razões técnicas ou de segurança.</p></li><li><p><strong>só acima de um limiar:</strong> obrigam quando passam de uma participação mínima ou de uma maioria qualificada. O post pode propor qual.</p></li></ul>",
          "<p>O Brasil Participativo responde a isso com uma devolutiva: o governo explica o que incorporou das propostas e por que deixou o resto de fora. Algo assim caberia aqui?</p>"
        )
      },
      {
        title: "Como garantir uma pessoa, um voto?",
        answers: [],
        body: body(
          "<p>Toda votação do colcom supõe que cada voto é de uma pessoa diferente. Mas criar uma conta só exige um nome e um email, e nada impede alguém de criar várias para inflar uma posição. Quanto mais o colcom importar, maior será o incentivo para isso.</p>",
          "<p>Como garantir uma pessoa, um voto, sem excluir quem não pode ou não quer se identificar? Alguns caminhos:</p>",
          "<ul><li><p>verificação por documento ou pelo gov.br, que é forte, mas exige confiar dados pessoais a quem hospeda a instância;</p></li><li><p>convites e redes de confiança entre participantes;</p></li><li><p>detectar padrões suspeitos de votação e dar menos peso a contas novas;</p></li><li><p>votos públicos, que podem ser auditados, mas expõem quem vota.</p></li></ul>",
          "<p>Cada caminho troca uma coisa por outra. Defenda o equilíbrio que você acha certo.</p>"
        )
      }
    ]
  }
]
