import React from "react"

export default ({ history, currentCommit, setCurrentCommit, fetchCommitBody = () => { } }) => {
  const [startCommit, setStartCommit] = React.useState()

  return (
    <div className="timerSlider">
      <input
        type="range"
        id="commit"
        list="commits"
        min={0}
        max={history?.length - 1 || 0}
        value={currentCommit}
        disabled={showCritique}
        onMouseDown={e => setStartCommit(Number(e.target.value))}
        onMouseUp={() => fetchCommitBody()}
        onTouchStart={e => setStartCommit(Number(e.target.value))}
        onTouchEnd={() => fetchCommitBody()}
        onChange={e => setCurrentCommit(Number(e.target.value))}
      />
      <datalist id="commits">
        {history?.map((commit, i) => (
          <option key={commit.commit} label={currentCommit === i ? `— ${commit.date}` : "—"} />
        ))}
      </datalist>
    </div>
  )
}