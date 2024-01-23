import React from "react"

export default ({ id, inputRef, type, label, options = {}, style = {}, errorMessage, ...remainingProps }) => {
  return (
    <div>
      <div className={type === "checkbox" ? "checkBox" : "inputBox"} style={style}>
        {type === "select" ?
          <select
            id={id}
            ref={inputRef}
            className={errorMessage ? " error" : ""}
            {...remainingProps}
          >
            {Object.keys(options).map(option => {
              return <option value={options[option]}>{option}</option>
            })}
          </select>
          :
          <input
            id={id}
            ref={inputRef}
            className={errorMessage ? " error" : ""}
            type={type}
            placeholder="_"
            {...remainingProps}
          />
        }

        <label htmlFor={id}>{label}</label>

      </div>
      {errorMessage &&
        <span className="error">{errorMessage}</span>
      }
    </div>
  )
}