import React from "react"
import { useLocation, useNavigate } from "react-router"

import { loginPath, loginState } from "@/assets/returnTo"

// Sends a logged out user to the login page, which brings them back here afterwards
export default function useToLogin() {
  const location = useLocation()
  const navigate = useNavigate()

  return React.useCallback(() => navigate(loginPath(location), { state: loginState(location) }), [location, navigate])
}
