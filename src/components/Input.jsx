import React from "react"

export default ({ id, type, label, options = {}, style = {}, ...remainingProps }) => {
  return (
    <div className={type === "checkbox" ? "checkBox" : "inputBox"} style={style}>
      {type === "select" ?
        <select
          id={id}
          {...remainingProps}
        >
          {Object.keys(options).map(option => {
            return <option value={options[option]}>{option}</option>
          })}
        </select>
        :
        <input
          type={type}
          id={id}
          placeholder="_"
          {...remainingProps}
        />
      }
      <label htmlFor={id}>{label}</label>
    </div>
  )
}