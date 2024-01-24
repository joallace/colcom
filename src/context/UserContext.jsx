import React from "react"
// import { useNavigate } from "react-router-dom"

import env from "@/assets/enviroment"


export const UserContext = React.createContext()

export function UserProvider({ children }) {
  const [user, setUser] = React.useState(null)

  const fetchUser = async () => {
    const accessToken = localStorage.getItem("accessToken")
    if (!accessToken)
      return

    const url = `${env.apiAddress}/users/self`
    const res = await fetch(url, {
      method: "get",
      headers: { "Authorization": `Bearer ${accessToken}` },
    })
    const data = await res.json()

    if(!res.ok){
      console.error(data)
      return
    }

    setUser(data)
  }

  React.useEffect(()=>{
    if(localStorage.getItem("accessToken")){
      console.log("atualizei parceiro")
      fetchUser()
    }
  }, [])

  return (
    <UserContext.Provider value={{ user, fetchUser }}>
      {children}
    </UserContext.Provider>
  )
}

export default function useUser() {
  return React.useContext(UserContext);
}
