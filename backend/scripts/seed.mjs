// Fills a development instance with mock data through the API: 8 users (password "colcom123"),
// 4 topics ("Lula ou Bolsonaro?", an open one, one with 4 answers and one on the four-day week),
// posts, edits, suggestions (merged by git, merged by merge3, merged with a resolution, rejected and
// pending), clones, critiques (including ones whose passage was later changed or removed, on charts,
// lists and across paragraphs), votes changed and withdrawn, posts in two meta topics, notifications
// read and unread, and tags (active, provisional, contested, hidden by contests and withdrawn).
// The four-day week post (log in as elisa_prado) has a chart critiqued and then altered, and its
// latest commit has two pending suggestions that conflict with it, for the resolution page.
// Run it with the backend up: `npm run seed`, or `API=http://host:port npm run seed`.
// The backend needs RATE_LIMIT_SIGN_UP=off and TAG_MIN_ACCOUNT_DAYS=0, as every user is brand new.
// Titles are unique site-wide, so it seeds a database once; it stops if the topics already exist.
import zlib from "node:zlib"

const API = process.env.API || "http://localhost:3000"
const PASS = "colcom123"

async function call(method, path, body, token, { tolerate = false } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const msg = `${method} ${path} → ${res.status} ${JSON.stringify(data)}`
    // A 429 would leave users or posts missing and fail later with a confusing error
    if (res.status === 429) throw new Error(`${msg}\nRun the backend with RATE_LIMIT_SIGN_UP=off (and the other RATE_LIMIT_* if needed) to seed.`)
    // The seeded users are brand new, and new accounts can't create tags
    if (res.status === 403 && /tags/.test(data?.message ?? "")) throw new Error(`${msg}\nRun the backend with TAG_MIN_ACCOUNT_DAYS=0 to seed.`)
    if (tolerate) { console.warn("  (ignored) " + msg); return null }
    throw new Error(msg)
  }
  return data
}

// ---- 16x16 mirrored pixel-art avatars ----
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function avatar(seed, [r, g, b]) {
  let s = seed
  const rand = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  const half = Array.from({ length: 16 }, () => Array.from({ length: 8 }, () => rand() < 0.45))
  const rows = []
  for (let y = 0; y < 16; y++) {
    const row = [0]
    for (let x = 0; x < 16; x++) {
      const on = half[y][x < 8 ? x : 15 - x]
      row.push(...(on ? [r, g, b] : [31, 13, 0]))
    }
    rows.push(Buffer.from(row))
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(16, 0); ihdr.writeUInt32BE(16, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))
  ]).toString("base64")
}

const seeded = (await call("GET", "/topics?pageSize=100&orderBy=id")).tree.find(t => t.title === "Lula ou Bolsonaro?")
if (seeded) {
  console.log(`Already seeded: "Lula ou Bolsonaro?" is topic ${seeded.id}. Use a fresh database to seed again.`)
  process.exit(0)
}

// ---- Users ----
const people = [
  ["ana_souza", [188, 82, 0]], ["bruno_lima", [102, 145, 0]], ["carla_mendes", [77, 168, 193]],
  ["diego_rocha", [190, 36, 0]], ["elisa_prado", [205, 205, 0]], ["felipe_nunes", [217, 217, 217]],
  ["gabi_torres", [160, 90, 200]], ["henrique_alves", [230, 140, 60]]
]
const U = {}
for (const [i, [name, color]] of people.entries()) {
  await call("POST", "/users", { name, email: `${name}@colcom.dev`, pass: PASS, avatar: avatar(i * 7919 + 17, color) }, null, { tolerate: true })
  U[name.split("_")[0]] = (await call("POST", "/login", { login: name, pass: PASS })).accessToken
}
console.log("users ok")

// ---- Helpers ----
// A document is a list of blocks: a string is a paragraph, the rest are made by h2, ul and chart.
// Each block knows its HTML (as the editor writes it), its ProseMirror size and where its texts start,
// so critiques can be anchored as the post page anchors them. Texts must be plain (no marks or entities).
const CHART_TEXT = "￼" // a chart's stand-in character in the post page's text (frontend's textIndex.js)
const h2 = text => ({ html: `<h2>${text}</h2>`, texts: [[text, 1]], size: text.length + 2 })
const ul = (...items) => {
  let offset = 1
  const texts = items.map(item => {
    const at = [item, offset + 2] // list > item > paragraph
    offset += item.length + 4
    return at
  })
  return { html: `<ul>${items.map(item => `<li><p>${item}</p></li>`).join("")}</ul>`, texts, size: offset + 1 }
}
// The editor's chart node, with its data as ChartProvider writes it: JSON with single quotes
const chart = (type, data) => ({
  html: `<chart type="${type}" isLegendOn="true" data="${JSON.stringify(data).replace(/"/g, "'")}"></chart>`,
  texts: [[CHART_TEXT, 0]], size: 1
})
const block = b => typeof b === "string" ? { html: `<p>${b}</p>`, texts: [[b, 1]], size: b.length + 2 } : b
const html = blocks => blocks.map(b => block(b).html).join("")

const topic = (who, title, body, answers, tags = []) => call("POST", "/contents", { title, body: html(body), config: { answers }, tags }, U[who])
const voteTag = (who, topicId, tag, value) => call("POST", `/topics/${topicId}/tags`, { tag, value }, U[who])
const post = (who, topicId, title, blocks, answer) =>
  call("POST", "/contents", { title, body: html(blocks), parent_id: topicId, config: answer ? { answer } : {} }, U[who])
const history = async id => (await call("GET", `/contents/${id}`)).history
const latest = async id => (await history(id)).at(-1).commit
const edit = (who, id, blocks, message) => call("PATCH", `/contents/${id}`, { body: html(blocks), message }, U[who])
const suggest = async (who, id, blocks, message) => (await edit(who, id, blocks, message)).config.commit
const merge = (who, id, hash, resolution) => call("POST", `/contents/${id}/${hash}/merge`, resolution, U[who])
const interact = (who, content_id, type) => call("POST", "/interactions", { content_id, type }, U[who], { tolerate: true })

// The anchor the post page makes when `exact` is selected: textIndex's text (blocks joined by "\n", a
// chart as CHART_TEXT) and the ProseMirror position of each of its characters (null for separators)
function anchor(blocks, exact) {
  let text = "", pos = 0
  const positions = []
  for (const b of blocks.map(block)) {
    for (const [t, offset] of b.texts) {
      if (text) { text += "\n"; positions.push(null) }
      text += t
      for (let i = 0; i < t.length; i++) positions.push(pos + offset + i)
    }
    pos += b.size
  }
  const at = text.indexOf(exact)
  if (at === -1) throw new Error(`"${exact}" not found`)
  if (text.indexOf(exact, at + 1) !== -1) throw new Error(`"${exact}" is ambiguous`)
  const end = at + exact.length
  return {
    from: positions[at], to: positions[end - 1] + 1,
    quote: { exact, prefix: text.slice(Math.max(0, at - 32), at), suffix: text.slice(end, end + 32), start: at }
  }
}
const critique = (who, postId, commit, blocks, exact, title, body) =>
  call("POST", "/contents", { title, body: html(body), parent_id: postId, config: { commit, ...anchor(blocks, exact) } }, U[who])

// =====================================================================
// Topic 1: Lula ou Bolsonaro?
// =====================================================================
const t1 = await topic("ana", "Lula ou Bolsonaro?",
  ["Se a eleição fosse hoje, em quem você votaria e por quê? Vamos manter o debate nos argumentos: critique trechos, sugira melhorias e vote no texto que melhor representa a sua posição."],
  ["Lula", "Bolsonaro"],
  ["Política", "Eleições", "Brasil"])

const a1v1 = [
  "Votaria no Lula porque o combate à fome precisa voltar a ser prioridade do governo federal.",
  "Programas de transferência de renda como o Bolsa Família custam pouco em relação ao orçamento e movimentam o comércio local, sem aumentar a dívida pública.",
  "Além disso, a valorização do salário mínimo acima da inflação melhora a vida de milhões de trabalhadores e aposentados.",
  "Todo governo de esquerda é sempre melhor para os pobres, isso é um fato histórico.",
  "Por fim, o país precisa de um presidente com trânsito internacional para atrair investimentos e reabrir mercados."
]
const a1 = await post("bruno", t1.id, "Combater a fome deve ser a prioridade", a1v1, "Lula")
const a1c1 = (await history(a1.id))[0].commit

const a2v1 = [
  "Votaria no Bolsonaro porque acredito que o Estado deve atrapalhar menos quem quer empreender.",
  "A redução de burocracia e a Lei de Liberdade Econômica facilitaram a abertura de empresas e geraram empregos formais.",
  "Privatizar estatais ineficientes libera recursos para saúde, educação e segurança, em vez de cobrir prejuízos.",
  "O agronegócio, que sustenta a balança comercial, precisa de segurança jurídica no campo."
]
const a2 = await post("carla", t1.id, "Menos Estado, mais emprego", a2v1, "Bolsonaro")
const a2c1 = (await history(a2.id))[0].commit

const a3v1 = [
  "Meu voto seria no Bolsonaro por causa da segurança pública.",
  "Quem vive em bairros dominados pelo crime quer polícia presente e leis penais mais duras, não discursos.",
  "Também defendo o direito do cidadão de bem se defender, com regras claras para a posse de armas."
]
const a3 = await post("diego", t1.id, "Segurança pública em primeiro lugar", a3v1, "Bolsonaro")
const a3c1 = (await history(a3.id))[0].commit

const a4v1 = [
  "Votaria no Lula pela defesa das instituições democráticas.",
  "Um presidente precisa respeitar o resultado das urnas, a imprensa e o Judiciário, mesmo quando discorda deles.",
  "Também pesa a pauta ambiental: reduzir o desmatamento abre portas para acordos comerciais e fundos internacionais."
]
const a4 = await post("elisa", t1.id, "Democracia não é negociável", a4v1, "Lula")

// Critiques on the first version of A1: one whose passage is later reworded, one whose passage is removed
await critique("carla", a1.id, a1c1, a1v1, "sem aumentar a dívida pública",
  "Transferência de renda tem custo",
  ["O programa custa dezenas de bilhões por ano. Pode valer a pena, mas dizer que não pesa na dívida é esconder a conta. De onde vem o dinheiro?"])
await critique("diego", a1.id, a1c1, a1v1, "Todo governo de esquerda é sempre melhor para os pobres, isso é um fato histórico.",
  "Generalização sem fonte",
  ["Isso não é um fato, é uma opinião. Há governos de esquerda e de direita com bons e maus resultados sociais. Cite dados ou retire."])
await critique("felipe", a1.id, a1c1, a1v1, "valorização do salário mínimo acima da inflação",
  "Impacto na Previdência",
  ["Como os benefícios previdenciários são atrelados ao mínimo, cada aumento real pressiona as contas da Previdência. Vale mencionar esse custo."])

// Bruno answers the critiques: rewords the cost passage and drops the generalization
const a1v2 = [
  a1v1[0],
  "Programas de transferência de renda como o Bolsa Família custam cerca de 1,5% do PIB, um valor modesto diante do retorno: cada real investido movimenta o comércio local e volta em parte como arrecadação.",
  a1v1[2],
  a1v1[4]
]
await edit("bruno", a1.id, a1v2, "Corrige o custo do programa e remove generalização, após críticas")

// Elisa suggests a closing paragraph, which Bruno accepts
const a1v3 = [...a1v2, "Combater a fome não é só caridade: crianças bem alimentadas aprendem mais, adoecem menos e se tornam adultos mais produtivos."]
const s1 = await call("PATCH", `/contents/${a1.id}`, { body: html(a1v3), message: "Adiciona argumento sobre educação e saúde" }, U.elisa)
await call("POST", `/contents/${a1.id}/${s1.config.commit}/merge`, null, U.bruno)
const a1latest = (await history(a1.id)).at(-1).commit
await critique("henrique", a1.id, a1latest, a1v3, "crianças bem alimentadas aprendem mais",
  "Bom ponto, mas e a qualidade das escolas?",
  ["Concordo com a alimentação, mas sem escolas de qualidade o efeito é limitado. O texto poderia ligar o programa às condicionalidades de frequência escolar."])

// Overlapping critiques on A2, so the passage shows a stronger shade
await critique("bruno", a2.id, a2c1, a2v1, "geraram empregos formais",
  "Correlação não é causalidade",
  ["O emprego formal também depende do ciclo econômico. Que dados mostram que foi a lei que gerou esses empregos?"])
await critique("elisa", a2.id, a2c1, a2v1, "a Lei de Liberdade Econômica facilitaram a abertura de empresas e geraram empregos formais",
  "Abrir empresa ficou mais fácil, sim",
  ["Concordo que a burocracia diminuiu, mas boa parte das novas empresas são MEIs, que nem sempre representam empregos de qualidade."])
await critique("gabi", a2.id, a2c1, a2v1, "Lei de Liberdade Econômica",
  "Lei aprovada pelo Congresso",
  ["Vale lembrar que a lei foi aprovada pelo Congresso com apoio de vários partidos; atribuí-la só ao presidente simplifica demais."])
await critique("ana", a2.id, a2c1, a2v1, "Privatizar estatais ineficientes",
  "Quais estatais?",
  ["\"Ineficientes\" é vago. Algumas estatais dão lucro e pagam dividendos à União. Quais você privatizaria e por quê?"])

// A pending suggestion on A2, for Carla to review
await call("PATCH", `/contents/${a2.id}`, {
  body: html([...a2v1.slice(0, 3), "O agronegócio, que sustenta a balança comercial, precisa de segurança jurídica no campo e de investimento em logística, como ferrovias e portos."]),
  message: "Acrescenta logística ao parágrafo do agronegócio"
}, U.gabi)

// Henrique clones A2's first version into a post of his own
const a5 = await call("POST", `/contents/${a2.id}/${a2c1}/clone`, { title: "Liberdade econômica com rede de proteção" }, U.henrique)

await critique("ana", a3.id, a3c1, a3v1, "leis penais mais duras",
  "Penas duras sozinhas não resolvem",
  ["O Brasil já tem uma das maiores populações carcerárias do mundo. Sem investigação e esclarecimento de crimes, aumentar penas tem pouco efeito."])
await critique("felipe", a4.id, (await history(a4.id))[0].commit, a4v1, "reduzir o desmatamento abre portas para acordos comerciais",
  "Exemplo concreto?",
  ["O acordo Mercosul-União Europeia é citado sempre, mas qual o estado atual dele? Um exemplo concreto fortaleceria o argumento."])

// Poll: 4 x 4, and relevance votes
for (const [who, p] of [["ana", a4], ["bruno", a1], ["carla", a2], ["diego", a3], ["elisa", a1], ["felipe", a2], ["gabi", a1], ["henrique", a5]])
  await interact(who, p.id, "vote")
for (const [who, p, type] of [["ana", a1, "up"], ["carla", a1, "down"], ["diego", a2, "up"], ["elisa", a2, "down"], ["felipe", a3, "up"], ["gabi", a4, "up"], ["henrique", a1, "up"], ["bruno", a3, "down"]])
  await interact(who, p.id, type)
console.log("topic 1 ok", t1.id)

// =====================================================================
// Topic 2: open (no answers)
// =====================================================================
const t2 = await topic("felipe", "Como melhorar o transporte público da nossa cidade?",
  ["Tópico aberto: não há respostas fixas. Proponha ideias concretas, critique as dos outros e ajude a melhorar os textos com sugestões."],
  [],
  ["Transporte", "Cidade", "Política"])

const b1v1 = [
  "Faixas exclusivas de ônibus são a medida mais barata e rápida para melhorar o transporte.",
  "Com tinta e fiscalização, dá para reduzir o tempo de viagem em até 30% nos corredores mais congestionados.",
  "Os carros vão perder espaço, mas quem anda de ônibus é a maioria nas avenidas principais."
]
const b1 = await post("gabi", t2.id, "Faixas exclusivas já", b1v1)
await critique("diego", b1.id, (await history(b1.id))[0].commit, b1v1, "em até 30%",
  "De onde vem esse número?",
  ["30% parece otimista. Seria bom citar a cidade e o estudo de onde veio esse dado."])
const b1v2 = [b1v1[0], "Com tinta e fiscalização, cidades como São Paulo reduziram o tempo de viagem nos corredores com faixa exclusiva, segundo dados da própria prefeitura.", b1v1[2]]
await edit("gabi", b1.id, b1v2, "Troca número sem fonte por exemplo concreto")

const b2v1 = [
  "A integração entre bicicleta e ônibus resolve o problema do primeiro e do último quilômetro.",
  "Bicicletários seguros nos terminais e suportes nos ônibus permitiriam que mais gente deixasse o carro em casa.",
  "Também é preciso ligar as ciclovias existentes, que hoje começam e terminam no nada."
]
const b2 = await post("henrique", t2.id, "Bicicleta como parte do sistema", b2v1)
await critique("carla", b2.id, (await history(b2.id))[0].commit, b2v1, "suportes nos ônibus",
  "Funciona em horário de pico?",
  ["Em ônibus lotados, suportes para bicicleta atrasam o embarque. Talvez só fora do pico?"])
const s2 = await call("PATCH", `/contents/${b2.id}`, {
  body: html([...b2v1, "Um sistema de bicicletas compartilhadas integrado ao bilhete único completaria a proposta."]),
  message: "Sugere bicicletas compartilhadas"
}, U.ana)
await call("POST", `/contents/${b2.id}/${s2.config.commit}/merge`, null, U.henrique)

const b3v1 = [
  "Tarifa zero aos domingos e feriados é um primeiro passo viável para a tarifa zero completa.",
  "Nesses dias a demanda é menor, então o custo para a prefeitura é baixo, e o comércio e o lazer ganham movimento."
]
const b3 = await post("ana", t2.id, "Começar pela tarifa zero aos domingos", b3v1)
await critique("felipe", b3.id, (await history(b3.id))[0].commit, b3v1, "o custo para a prefeitura é baixo",
  "Baixo quanto?",
  ["Mesmo com menos passageiros, a frota roda e o custo fixo continua. Uma estimativa ajudaria a convencer."])

for (const [who, p, type] of [["ana", b1, "up"], ["bruno", b1, "up"], ["carla", b2, "up"], ["diego", b3, "down"], ["elisa", b3, "up"], ["felipe", b2, "up"]])
  await interact(who, p.id, type)
console.log("topic 2 ok", t2.id)

// =====================================================================
// Topic 3: a fixed set of answers
// =====================================================================
const t3 = await topic("gabi", "Qual deve ser a prioridade do orçamento municipal em 2027?",
  ["A prefeitura vai abrir a consulta do orçamento participativo. Se só uma área pudesse receber o aumento de recursos, qual deveria ser?"],
  ["saúde", "educação", "segurança", "mobilidade"],
  ["Orçamento", "Cidade", "Política"])

const c1v1 = [
  "A prioridade deve ser a saúde, começando pelas unidades básicas.",
  "Hoje a espera por uma consulta com especialista passa de seis meses em vários bairros.",
  "Investir na atenção básica é mais barato e evita que problemas simples virem internações."
]
const c1 = await post("ana", t3.id, "Saúde básica primeiro", c1v1, "saúde")
const c2v1 = [
  "Educação infantil deve ser a prioridade: ainda faltam vagas em creche para milhares de crianças.",
  "Creche permite que as mães voltem ao trabalho e é a fase em que o investimento em educação tem mais retorno.",
  "Também precisamos de reforma nas escolas que ainda não têm quadra nem biblioteca."
]
const c2 = await post("felipe", t3.id, "Vagas em creche", c2v1, "educação")
const c3v1 = [
  "Segurança: iluminação pública e câmeras nas ruas reduzem crimes e custam pouco.",
  "A guarda municipal também precisa de mais efetivo para patrulhar praças e escolas."
]
const c3 = await post("diego", t3.id, "Ruas iluminadas são ruas seguras", c3v1, "segurança")
const c4v1 = [
  "Educação, com foco no ensino em tempo integral.",
  "Escolas em tempo integral tiram os jovens da rua e melhoram o aprendizado."
]
const c4 = await post("henrique", t3.id, "Tempo integral nas escolas", c4v1, "educação")

const c1c1 = (await history(c1.id))[0].commit
await critique("bruno", c1.id, c1c1, c1v1, "passa de seis meses",
  "Fonte?",
  ["Seis meses em quais bairros e para quais especialidades? A fila varia muito."])
await critique("elisa", c1.id, c1c1, c1v1, "evita que problemas simples virem internações",
  "Concordo, e há evidência",
  ["Esse é um dos argumentos mais sólidos: atenção básica reduz internações por condições sensíveis, como hipertensão e diabetes."])
await critique("carla", c2.id, (await history(c2.id))[0].commit, c2v1, "Creche permite que as mães voltem ao trabalho",
  "Os pais também",
  ["Creche permite que mães e pais voltem ao trabalho. A frase reforça a ideia de que cuidar dos filhos é só papel da mãe."])
const c2v2 = [c2v1[0], "Creche permite que mães e pais voltem ao trabalho e é a fase em que o investimento em educação tem mais retorno.", c2v1[2]]
await edit("felipe", c2.id, c2v2, "Inclui os pais, após crítica")
await critique("gabi", c3.id, (await history(c3.id))[0].commit, c3v1, "câmeras nas ruas reduzem crimes",
  "Câmeras e privacidade",
  ["Câmeras ajudam, mas quem acessa as imagens? Precisamos de regras de privacidade e de uso antes de espalhar câmeras."])

for (const [who, p] of [["ana", c1], ["bruno", c1], ["carla", c2], ["diego", c3], ["elisa", c2], ["felipe", c2], ["gabi", c4], ["henrique", c4]])
  await interact(who, p.id, "vote")
for (const [who, p, type] of [["bruno", c2, "up"], ["carla", c1, "up"], ["diego", c4, "up"], ["ana", c3, "down"]])
  await interact(who, p.id, type)
console.log("topic 3 ok", t3.id)

// =====================================================================
// Topic 4: a post with headings, a list and a chart, through every kind of edit
// =====================================================================
// Elisa's post is critiqued (the chart too), edited, and takes suggestions merged by git, merged only
// by merge3 (adjacent lines), merged with a resolution and rejected. Its latest commit ends with two
// pending suggestions that conflict with it, to try the resolution page.
const t4 = await topic("carla", "O Brasil deve adotar a semana de quatro dias?",
  ["Pilotos em outros países testaram a semana de quatro dias sem corte de salário. Faria sentido aqui? Defenda uma das respostas, de preferência com dados."],
  ["sim", "não", "só em alguns setores"],
  ["Trabalho", "Economia", "Política"])

// Two expected 409s: an automatic merge refused for a conflict, which the resolution page takes over
async function expectConflict(who, id, hash) {
  const res = await fetch(`${API}/contents/${id}/${hash}/merge`, { method: "POST", headers: { Authorization: `Bearer ${U[who]}` } })
  if (res.status !== 409) throw new Error(`merging ${hash} into ${id} should conflict, got ${res.status}`)
}

const kept = "manteve o modelo (%)", revenue = "receita estável ou maior (%)"
const d1 = [
  h2("O que dizem os testes"),
  "Os testes da semana de quatro dias no Reino Unido, em 2022, envolveram 61 empresas e cerca de 2.900 trabalhadores.",
  "Ao final de seis meses, 56 empresas mantiveram o modelo e a receita ficou estável ou cresceu.",
  chart("bar", [{ "0name": "Reino Unido", [kept]: "92" }, { "0name": "Portugal", [kept]: "95" }, { "0name": "Islândia", [kept]: "86" }]),
  "Todo trabalhador produz mais quando descansa mais, sem exceção.",
  h2("Como implementar"),
  ul("Começar pelo setor público e por empresas voluntárias.",
    "Manter o salário integral, cortando reuniões e tarefas improdutivas.",
    "Avaliar os resultados a cada seis meses, com dados abertos."),
  "Com regras claras e uma transição gradual, a semana de quatro dias melhora a saúde, reduz o trânsito e não custa nada às empresas."
]
const d = await post("elisa", t4.id, "Quatro dias, a mesma produtividade", d1, "sim")
const dc1 = await latest(d.id)

// On the first version: two critiques of the chart (a stronger outline), one spanning two paragraphs,
// one spanning a paragraph and the chart, one in the list, and two on passages later changed or removed
await critique("diego", d.id, dc1, d1, CHART_TEXT,
  "O gráfico mistura métricas",
  ["Reino Unido e Portugal mediram empresas que mantiveram a semana de quatro dias; a Islândia reduziu horas semanais, sem cortar um dia. Não dá para comparar as barras."])
await critique("carla", d.id, dc1, d1, CHART_TEXT,
  "Qual a fonte dos dados?",
  ["Os números do gráfico não têm fonte. De que relatórios eles vêm, e de que ano?"])
await critique("gabi", d.id, dc1, d1, "cerca de 2.900 trabalhadores.\nAo final de seis meses, 56 empresas mantiveram o modelo",
  "Amostra pequena e voluntária",
  ["61 empresas que se inscreveram por vontade própria não representam a economia. Quem topa o teste já acredita nele."])
await critique("ana", d.id, dc1, d1, `a receita ficou estável ou cresceu.\n${CHART_TEXT}`,
  "O gráfico não mostra a receita",
  ["O texto fala em receita, mas o gráfico só mostra quem manteve o modelo. Faltou a barra que sustenta o argumento."])
await critique("henrique", d.id, dc1, d1, "Manter o salário integral",
  "Quem paga a transição?",
  ["Pequenas empresas não têm folga para reorganizar processos. Haveria algum incentivo nos primeiros anos?"])
await critique("bruno", d.id, dc1, d1, "Todo trabalhador produz mais quando descansa mais, sem exceção.",
  "Sem exceção?",
  ["Em turnos de fábrica ou no atendimento, a produção depende das horas de máquina ou de balcão abertas. Generalizar enfraquece o texto."])
await critique("felipe", d.id, dc1, d1, "não custa nada às empresas",
  "Custa, sim",
  ["Reorganizar escalas, contratar para cobrir o quinto dia e treinar equipes tem custo. Dizer que é zero tira a credibilidade."])

// Bruno suggests a fourth item, merged as it is
const d2 = d1.with(6, ul(...d1[6].texts.map(([t]) => t),
  "Garantir escalas para que serviços essenciais funcionem cinco dias por semana."))
await merge("elisa", d.id, await suggest("bruno", d.id, d2, "Acrescenta os serviços essenciais"))

// Elisa answers the critiques: new chart data (a second series, Iceland out), sources, no generalization
const sources = "Fontes: relatório final do piloto britânico (2023) e balanço do piloto português (2024); a Islândia saiu do gráfico por ter reduzido horas, não dias."
const d3 = [
  ...d2.slice(0, 3),
  chart("bar", [
    { "0name": "Reino Unido", [kept]: "92", [revenue]: "71" },
    { "0name": "Portugal", [kept]: "95", [revenue]: "68" },
    { "0name": "Espanha", [kept]: "80", [revenue]: "64" }
  ]),
  sources,
  ...d2.slice(5, 7),
  "Com regras claras e uma transição gradual, a semana de quatro dias melhora a saúde, reduz o trânsito e custa pouco às empresas que reorganizam seus processos."
]
await edit("elisa", d.id, d3, "Atualiza o gráfico, cita as fontes e corrige exageros, após críticas")
const dc3 = await latest(d.id)
await critique("felipe", d.id, dc3, d3, CHART_TEXT,
  "Melhorou, mas e a margem de erro?",
  ["Com amostras tão pequenas, as barras deveriam vir com intervalo de confiança. A diferença entre os países pode não ser real."])
await critique("ana", d.id, dc3, d3, "balanço do piloto português",
  "O piloto português também foi voluntário",
  ["Assim como o britânico, só participaram empresas que quiseram. Vale dizer isso junto da fonte."])

// Bruno clones this version to argue for offices only
const dClone = await call("POST", `/contents/${d.id}/${dc3}/clone`, { title: "Quatro dias, começando pelos escritórios" }, U.bruno)
await edit("bruno", dClone.id, [d3[0], d3[1], d3[3], "Nos escritórios a produção não depende de horas de balcão, por isso é por eles que a mudança deveria começar."],
  "Restringe a proposta aos escritórios")

// Two suggestions from the same version on adjacent lines: git merges the first and refuses the second,
// which merge3 then merges (it only refuses changes to the same lines)
const d4 = d3.with(1, "Os testes da semana de quatro dias no Reino Unido, em 2022, envolveram 61 empresas e cerca de 2.900 trabalhadores, quase todos em escritórios e serviços.")
const d4b = d3.with(2, "Ao final de seis meses, 56 das 61 empresas mantiveram o modelo, 18 delas de forma permanente, e a receita ficou estável ou cresceu.")
const sB = await suggest("carla", d.id, d4, "Diz em que setores foram os testes")
const sC = await suggest("gabi", d.id, d4b, "Detalha quantas empresas mantiveram o modelo")
await merge("elisa", d.id, sB)
await merge("elisa", d.id, sC)
const d5 = d4.with(2, d4b[2])

// Henrique and Elisa change the closing paragraph at once; Elisa resolves the conflict keeping both
const sD = await suggest("henrique", d.id,
  d5.with(7, "Com regras claras e uma transição gradual, a semana de quatro dias melhora a saúde, reduz o absenteísmo e o trânsito e custa pouco às empresas que reorganizam seus processos."),
  "Acrescenta o absenteísmo")
await edit("elisa", d.id,
  d5.with(7, "Com regras claras e uma transição gradual, a semana de quatro dias melhora a saúde e a vida familiar, reduz o trânsito e custa pouco às empresas que reorganizam seus processos."),
  "Acrescenta a vida familiar ao fechamento")
await expectConflict("elisa", d.id, sD)
const { head } = await call("GET", `/contents/${d.id}/${sD}/merge`, null, U.elisa)
const d6 = d5.with(7, "Com regras claras e uma transição gradual, a semana de quatro dias melhora a saúde e a vida familiar, reduz o absenteísmo e o trânsito e custa pouco às empresas que reorganizam seus processos.")
await merge("elisa", d.id, sD, { body: html(d6), head: head.commit })

// Diego's suggestion goes against the post's proposal, and Elisa rejects it
const sE = await suggest("diego", d.id,
  d6.with(6, ul("Começar apenas por empresas privadas voluntárias, sem envolver o setor público.", ...d6[6].texts.slice(1).map(([t]) => t))),
  "Tira o setor público do começo")
await call("POST", `/contents/${d.id}/${sE}/reject`, null, U.elisa)

// Pending, for the resolution page: Felipe's and Ana's suggestions from this version, then Elisa's own
// edit of the same lines. Felipe's has two conflicts (title and list) and a clean addition at the end
const items = d6[6].texts.map(([t]) => t)
await suggest("felipe", d.id, [
  h2("O que dizem os testes, e o que eles não dizem"),
  ...d6.slice(1, 6),
  ul(...items.with(2, "Avaliar os resultados a cada três meses, com dados abertos e auditoria independente.")),
  d6[7],
  "Um piloto brasileiro, com empresas de vários portes e regiões, responderia às dúvidas que os testes estrangeiros deixam."
], "Lembra os limites dos testes e pede auditoria")
await suggest("ana", d.id,
  d6.with(4, "Fontes: relatório final do piloto britânico (2023) e balanço do piloto português (2024), ambos com dados por empresa abertos para consulta; a Islândia saiu do gráfico por ter reduzido horas, não dias."),
  "Diz que os dados das fontes são abertos")
const d7 = [
  h2("O que dizem os pilotos"),
  ...d6.slice(1, 4),
  "Fontes: relatório final do piloto britânico (2023) e balanço do piloto português (2024). A Islândia saiu do gráfico por ter reduzido horas, não dias.",
  d6[5],
  ul(...items.with(2, "Avaliar os resultados a cada seis meses, com dados abertos por empresa e por setor.")),
  ...d6.slice(7)
]
await edit("elisa", d.id, d7, "Ajusta o título, a avaliação e as fontes")
await critique("bruno", d.id, await latest(d.id), d7, "por empresa e por setor",
  "Quem coleta esses dados?",
  ["Dados por empresa exigem que alguém os colete e publique. Seria o Ministério do Trabalho?"])

// The other answers, one with a pie chart
const e1 = [
  "A conta não fecha para o pequeno comércio, que já trabalha com poucos funcionários.",
  chart("pie", [{ "0name": "comércio e serviços", "0value": 0.62 }, { "0name": "indústria", "0value": 0.21 }, { "0name": "agropecuária", "0value": 0.17 }]),
  "Como mostra o gráfico, a maior parte dos empregos está em setores que dependem de atendimento presencial.",
  "Uma loja que abre seis dias por semana teria de contratar mais gente para cobrir o dia a menos de cada funcionário."
]
const e = await post("diego", t4.id, "A conta não fecha para o pequeno comércio", e1, "não")
await critique("elisa", e.id, await latest(e.id), e1, CHART_TEXT,
  "Gráfico sem fonte e sem ano",
  ["De onde vêm essas proporções? E o argumento seria sobre empresas pequenas, mas o gráfico mostra todos os empregos."])
const f1 = [
  "Faz sentido começar onde a produção não depende de horas abertas: escritórios, tecnologia e parte do setor público.",
  "Comércio, saúde e indústria podem vir depois, com escalas, quando houver dados brasileiros."
]
const f = await post("gabi", t4.id, "Primeiro onde já é possível", f1, "só em alguns setores")

// Poll with second thoughts, so its history (GET /topics/:id/votes) has changes and a removal
for (const [who, p] of [["ana", d], ["bruno", dClone], ["carla", e], ["diego", e], ["felipe", f], ["gabi", f], ["henrique", d],
  ["carla", f], ["felipe", d], ["henrique", d], ["henrique", e]])
  await interact(who, p.id, "vote")
for (const [who, p, type] of [["ana", d, "up"], ["bruno", d, "up"], ["carla", e, "up"], ["gabi", e, "down"], ["henrique", f, "up"], ["felipe", d, "up"],
  ["felipe", d, "down"]]) // Felipe changes his mind
  await interact(who, p.id, type)

// Tags: Gabi endorses one; Diego contests one and withdraws; Henrique proposes "Saúde", contested until hidden
await voteTag("gabi", t4.id, "Trabalho", 1)
await voteTag("diego", t4.id, "Economia", -1)
await voteTag("diego", t4.id, "Economia", 0)
await voteTag("henrique", t4.id, "Saúde", 1)
await voteTag("ana", t4.id, "Saúde", -1)
await voteTag("felipe", t4.id, "Saúde", -1)
console.log("topic 4 ok", t4.id)

// =====================================================================
// Meta: posts and votes on two foundational topics
// =====================================================================
const metaTopics = (await call("GET", "/meta")).groups.flatMap(g => g.topics)
const metaTopic = title => metaTopics.find(t => t.title === title) ?? (() => { throw new Error(`meta topic "${title}" missing`) })()
const improve = metaTopic("Como melhorar o colcom?")
const consensus = metaTopic("O colcom promove o consenso?")
const m1v1 = [
  "O histórico de votos de cada tópico já é público, mas só pela API.",
  "Um gráfico com a evolução dos votos ao longo do tempo mostraria quando uma posição convenceu gente do outro lado."
]
const m1 = await post("gabi", improve.id, "Mostrar a evolução dos votos em um gráfico", m1v1)
const m2 = await post("felipe", improve.id, "Busca por texto nos tópicos e posts", [
  "Hoje só dá para filtrar por tags. Uma busca por texto ajudaria a achar discussões antigas antes de abrir uma repetida."
])
const m3v1 = [
  "Em parte: as críticas obrigam cada lado a responder aos melhores argumentos do outro.",
  "Mas o voto ainda premia quem já tem mais apoiadores, e não quem convence pessoas de lados diferentes."
]
const m3 = await post("henrique", consensus.id, "Em parte, falta premiar quem convence o outro lado", m3v1, "em parte")
await critique("ana", m3.id, await latest(m3.id), m3v1, "premia quem já tem mais apoiadores",
  "Isso é um problema do colcom ou da votação?",
  ["Qualquer votação por maioria tem esse efeito. A pergunta é se o colcom deveria ranquear de outro jeito, como o Pol.is faz."])
await critique("diego", m1.id, await latest(m1.id), m1v1, "só pela API",
  "Votos anônimos",
  ["O gráfico precisa manter os votantes anônimos, como a API já faz, numerando quem vota."])
for (const [who, p] of [["ana", m1], ["bruno", m1], ["carla", m2], ["diego", m1], ["elisa", m3], ["gabi", m3]])
  await interact(who, p.id, "vote")
console.log("meta ok")

// Topic-level relevance, promotions and bookmarks
for (const [who, t, type] of [
  ["bruno", t1, "up"], ["carla", t1, "up"], ["diego", t1, "up"], ["elisa", t3, "up"], ["henrique", t2, "up"], ["ana", t3, "up"],
  ["ana", t1, "promote"], ["bruno", t1, "promote"], ["carla", t3, "promote"], ["diego", t1, "promote"], ["elisa", t3, "promote"], ["henrique", t2, "promote"],
  ["ana", t3, "bookmark"], ["bruno", a2, "bookmark"], ["carla", a1, "bookmark"], ["felipe", t2, "bookmark"],
  ["elisa", t4, "up"], ["gabi", t4, "up"], ["felipe", t4, "promote"],
  // More than a page of bookmarks for Ana, a critique among them
  ["ana", t4, "bookmark"], ["ana", d, "bookmark"], ["ana", e, "bookmark"], ["ana", a1, "bookmark"], ["ana", b2, "bookmark"], ["ana", m3, "bookmark"]
])
  await interact(who, t.id, type)
const dCritiques = (await call("GET", `/contents/${d.id}/${await latest(d.id)}`)).critiques
const chartCritique = dCritiques.find(c => c.title === "O gráfico mistura métricas")
await interact("ana", chartCritique.id, "bookmark")
// Relevance votes on critiques
for (const [who, c, type] of [["elisa", chartCritique, "up"], ["gabi", chartCritique, "up"], ["henrique", dCritiques.find(c => c.title === "Custa, sim"), "up"],
  ["carla", dCritiques.find(c => c.title === "Sem exceção?"), "down"]])
  await interact(who, c.id, type)

// Notifications in both states: Bruno has read all of his, Elisa the older half
await call("POST", "/notifications/read", {}, U.bruno)
const { notifications } = await call("GET", "/notifications?pageSize=100", null, U.elisa)
await call("POST", "/notifications/read", { ids: notifications.slice(notifications.length / 2).map(n => n.id) }, U.elisa)

// Tags curated by others: "Política" is on 3 topics by 3 authors (active), "Cidade" on 2 (provisional)
await voteTag("carla", t1.id, "Brasil", -1)
await voteTag("diego", t2.id, "Mobilidade", 1)
await voteTag("henrique", t3.id, "Cidade", 1)

console.log(JSON.stringify({ topics: { lulaOuBolsonaro: t1.id, aberto: t2.id, orcamento: t3.id, quatroDias: t4.id } }))
console.log(`Pending conflicting suggestions: log in as elisa_prado and open /topics/${t4.id}/posts/${d.id}`)
