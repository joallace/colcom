import { toPercentageStr } from "@/assets/util"

const Focus = ({children}) => <span className="focus">{children}</span>

export const Author = ({ isDesktop, name, avatar }) => {
  return (
    <span className="startedBy">
      {isDesktop && "iniciado por"} <img src={`data:image/png;base64,${avatar}`} /> {name}
    </span>
  )
}

export const Relevance = ({ allVotes, upvotePercentage }) => {
  const percentageToColorHSL = (pct) => `hsl(${pct * 120}, 100%, 50%)` // 0=red, 60=yellow, 120=green

  const Colored = ({children}) => (
    <span className="focus" style={{ color: percentageToColorHSL(upvotePercentage) }}>
      {children}
    </span>
  
  )
  
  return (
    allVotes ?
      allVotes === 1 ?
      <>
        <Colored>1</Colored> votante {!upvotePercentage && "não"} achou relevante
      </>
      :
      <>
        <Colored>
          {toPercentageStr(upvotePercentage)}
        </Colored>
        {"  "} dos <Focus>{allVotes}</Focus> votantes achou relevante
      </>
      :
      "0 votos"
  )
}

export const Promotions = ({count}) => (<>promovido por {" "}<Focus>{count}</Focus>{" "} usuário{count === 1 ? "" : "s"}</>)

export const PostCount = ({count}) => (<><Focus>{count}</Focus>{" "}post{count === 1 ? "" : "s"}</>)

export const Interactions = ({count}) => (<><Focus>{count}</Focus>{" "}interaç{count === 1 ? "ão" : "ões"}</>)