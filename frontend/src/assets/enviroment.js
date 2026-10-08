export default Object.freeze({
    // A production build is served by nginx, which proxies /api/ to the backend on the same
    // origin, so the relative address works from any host. Dev talks to the backend directly.
    apiAddress: import.meta.env.VITE_API_ADDRESS || (import.meta.env.DEV ? "http://localhost:3000" : "/api")
})
