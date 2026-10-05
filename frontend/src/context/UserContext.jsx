import React from "react"


// Provided by `UserProvider`, kept in its own file so this one exports no components
export const UserContext = React.createContext()

export default function useUser() {
  return React.useContext(UserContext);
}
