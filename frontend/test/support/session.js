// The API client reads the token from localStorage (src/assets/api.js), where UserProvider keeps
// it: tests that provide a user through UserContext store theirs there too
export const storeToken = user => {
  if (user?.accessToken)
    localStorage.setItem("accessToken", user.accessToken)
}
