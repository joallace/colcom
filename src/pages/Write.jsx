import React from "react";

import TextEditor from "@/components/TextEditor";

export default function Write(){
    const [content, setContent] = React.useState("")
    
    return(
        <div className="content">
            <TextEditor setContent={setContent}/>
        </div>
    )
}