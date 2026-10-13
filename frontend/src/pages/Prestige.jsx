import React from "react"
import { Link } from "react-router"
import { PiMedalFill } from "react-icons/pi"

import NoResponse from "@/components/primitives/NoResponse"
import Spinner from "@/components/primitives/Spinner"
import useApiResource from "@/hooks/useApiResource"
import { amountText, limitSentences, PRESTIGE_RULES } from "@/assets/prestige"


// /prestige: how prestige is earned. The amounts and limits are the instance's (GET /prestige), so
// the page says what this instance does, whatever its operator set.
export default function Prestige() {
  const { data, error, isLoading } = useApiResource("/prestige")
  // A rule set to 0 is switched off; one the page has no words for still shows its amount
  const rules = (data?.rules ?? []).filter(rule => rule.amount !== 0)
  const limits = limitSentences(data?.limits)

  React.useEffect(() => {
    document.title = "prestígio · colcom"
  }, [])

  return (
    <div className="content prestigePage">
      <header className="prestigeHeader">
        <h1><PiMedalFill aria-hidden="true" /> prestígio</h1>
        <p>
          O prestígio reconhece contribuições que outra pessoa confirmou: uma crítica que levou a uma correção, uma
          resposta que convenceu quem criticou, uma sugestão incorporada ao post.
        </p>
        <p>
          Não se ganha prestígio publicando muito, nem recebendo votos: os votos medem o quanto cada lado aprova, e o
          prestígio deve valer para todos os lados. Os mais prestigiados estão no <Link to="/podium">pódio</Link>.
        </p>
      </header>
      {isLoading ?
        <Spinner />
        :
        error ?
          <NoResponse>não foi possível se conectar ao colcom.</NoResponse>
          :
          <>
            <section aria-labelledby="prestige-rules">
              <h2 id="prestige-rules">como se ganha</h2>
              <ul className="prestigeRules">
                {rules.map(rule => (
                  <li key={rule.reason}>
                    <span className={`prestigeAmount${rule.amount < 0 ? " negative" : ""}`}>{amountText(rule.amount)}</span>
                    <p>{PRESTIGE_RULES[rule.reason]?.rule ?? rule.reason}</p>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="prestige-limits">
              <h2 id="prestige-limits">limites</h2>
              {limits.length > 0 ?
                <>
                  <p>Para que ninguém fabrique prestígio combinando com outras contas:</p>
                  <ul>
                    {limits.map(sentence => <li key={sentence}>{sentence}</li>)}
                  </ul>
                  <p>O que passa de um limite fica no histórico com o valor reduzido, ou com +0, e o motivo.</p>
                </>
                :
                <p>Esta instância não limita quanto prestígio se ganha.</p>
              }
            </section>
            <section aria-labelledby="prestige-record">
              <h2 id="prestige-record">registro</h2>
              <p>
                Cada prêmio fica no histórico de prestígio do perfil, com a regra, quem o confirmou e quando, e esse
                registro não pode ser alterado nem apagado. Uma regra que muda de valor vale só para os prêmios seguintes.
              </p>
            </section>
          </>
      }
    </div>
  )
}
