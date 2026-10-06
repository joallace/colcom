// Fills a development instance with mock data through the API: 8 users (password "colcom123"),
// 3 topics ("Lula ou Bolsonaro?", an open one and one with 4 answers), posts, edits, accepted and
// pending suggestions, a clone, critiques (including ones whose passage was later changed or
// removed) and votes. Run it with the backend up: `npm run seed`, or `API=http://host:port npm run seed`.
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
const html = paragraphs => paragraphs.map(t => `<p>${t}</p>`).join("")
const topic = (who, title, body, answers) => call("POST", "/contents", { title, body: html(body), config: { answers } }, U[who])
const post = (who, topicId, title, paragraphs, answer) =>
  call("POST", "/contents", { title, body: html(paragraphs), parent_id: topicId, config: answer ? { answer } : {} }, U[who])
const history = async id => (await call("GET", `/contents/${id}`)).history
const edit = (who, id, paragraphs, message) => call("PATCH", `/contents/${id}`, { body: html(paragraphs), message }, U[who])
const interact = (who, content_id, type) => call("POST", "/interactions", { content_id, type }, U[who], { tolerate: true })

// The anchor the post page makes when `exact` is selected, for a document of plain paragraphs:
// paragraph i's text starts at ProseMirror position 1 + Σ(len + 2), and the text joins blocks with "\n"
function anchor(paragraphs, exact) {
  const text = paragraphs.join("\n")
  const at = text.indexOf(exact)
  if (at === -1) throw new Error(`"${exact}" not found`)
  const pos = offset => {
    let p = 1, o = offset
    for (const par of paragraphs) {
      if (o <= par.length) return p + o
      o -= par.length + 1
      p += par.length + 2
    }
    throw new Error("offset out of range")
  }
  const end = at + exact.length
  return {
    from: pos(at), to: pos(end - 1) + 1,
    quote: { exact, prefix: text.slice(Math.max(0, at - 32), at), suffix: text.slice(end, end + 32), start: at }
  }
}
const critique = (who, postId, commit, paragraphs, exact, title, body) =>
  call("POST", "/contents", { title, body: html(body), parent_id: postId, config: { commit, ...anchor(paragraphs, exact) } }, U[who])

// =====================================================================
// Topic 1: Lula ou Bolsonaro?
// =====================================================================
const t1 = await topic("ana", "Lula ou Bolsonaro?",
  ["Se a eleição fosse hoje, em quem você votaria e por quê? Vamos manter o debate nos argumentos: critique trechos, sugira melhorias e vote no texto que melhor representa a sua posição."],
  ["Lula", "Bolsonaro"])

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
  [])

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
  ["saúde", "educação", "segurança", "mobilidade"])

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

// Topic-level relevance, promotions and bookmarks
for (const [who, t, type] of [
  ["bruno", t1, "up"], ["carla", t1, "up"], ["diego", t1, "up"], ["elisa", t3, "up"], ["henrique", t2, "up"], ["ana", t3, "up"],
  ["ana", t1, "promote"], ["bruno", t1, "promote"], ["carla", t3, "promote"], ["diego", t1, "promote"], ["elisa", t3, "promote"], ["henrique", t2, "promote"],
  ["ana", t3, "bookmark"], ["bruno", a2, "bookmark"], ["carla", a1, "bookmark"], ["felipe", t2, "bookmark"]
])
  await interact(who, t.id, type)

console.log(JSON.stringify({ topics: { lulaOuBolsonaro: t1.id, aberto: t2.id, orcamento: t3.id } }))
