import Topic from "../components/Topic";

const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."

export default function Promoted() {
    return (
        <div className="content">
            <Topic
                title={"Socialismo ou Capitalismo?"}
                posts={[{ percentage: 54.5, shortAnswer: "Socialismo", summary: lorem }, { percentage: 45.5, shortAnswer: "Capitalismo", summary: lorem }]}
                style={{ paddingTop: "0.75rem" }}
            />
            <Topic title={"Como reduzir a probreza na cidade?"} style={{ padding: "2rem 0" }} />
        </div>
    )
}