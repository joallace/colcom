import React from "react"

export default ({ id, type, label, options = {}, ...remainingProps }) => {
  const inputRef = React.useRef(null)

  const handleLabelClick = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  }

  return (
    <div className="inputBox">
      {type === "select" ?
        <select
          id={id}
          ref={inputRef}
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
          ref={inputRef}
          {...remainingProps}
        />
      }
      <label htmlFor={id} onClick={handleLabelClick}>{label}</label>
    </div>
  )
  // if(type === "select")
  //   return (
  //     <div className="custom-input">
  //       <select
  //         id={id}
  //         {...remainingProps}
  //       >
  //         {Object.keys(options).map(option => {
  //           return <option value={options[option]}>{option}</option>
  //         })}
  //       </select>
  //       <label htmlFor={id}>{label}</label>
  //     </div>
  //   )
  // else
  //   return (
  //     <div className="custom-input">
  //       <input
  //         // type={type}
  //         id={id}
  //         {...remainingProps}
  //       />
  //       <label htmlFor={id}>{label}</label>
  //     </div>
  //   )
}