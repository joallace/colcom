import Topic from "@/components/content/Topic"
import PostPreview from "@/components/content/PostPreview"
import CritiquePreview from "@/components/content/CritiquePreview"


// Mixed contents shown outside their own pages, as the profile and bookmarks list them
export default function ContentList({ contents }) {
  return contents.map(content => {
    switch (content.type) {
      case "topic":
        return <Topic {...content} key={`t${content.id}`} />
      case "post":
        return <PostPreview {...content} key={`p${content.id}`} />
      case "critique":
        return <CritiquePreview {...content} key={`c${content.id}`} />
    }
  })
}
