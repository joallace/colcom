export default function Topic({title, posts, metrics, ...remainingProps}){
    return(
        <div className="topic" {...remainingProps}>
            <div className="bracket"/>
            <div className="content">
                <h2 className="title">{title}</h2>
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
                <ul className="metrics">
                    <li>Promovido por 40 usuários</li>
                    <li>80% dos votantes achou relevante</li>
                    <li>4200 interações</li>
                </ul>
            </div>
        </div>
    )
}