import React from "react"

export default React.forwardRef(({ id, type, label, options = {}, style = {}, errorMessage, className, ...remainingProps }, ref) => {
  return (
    <div className="inputWrapper">
      <div className={`${type === "checkbox" || type === "radio" ? "checkBox" : "inputBox"} ${className}`} style={style}>
        {type === "select" ?
          <select
            id={id}
            ref={ref}
            className={errorMessage ? " error" : null}
            {...remainingProps}
          >
            {Object.keys(options).map(option => {
              return <option value={options[option]}>{option}</option>
            })}
          </select>
          :
          <input
            id={id}
            ref={ref}
            className={errorMessage ? " error" : null}
            type={type}
            placeholder=" "
            readOnly={type === "radio" && true }
            {...remainingProps}
          />
        }

        {label &&
          <label htmlFor={id}>{label}</label>
        }

      </div>
      {errorMessage &&
        <span className="error">{errorMessage}</span>
      }
    </div>
  )
})