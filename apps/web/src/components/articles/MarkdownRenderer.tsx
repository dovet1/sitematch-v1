'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ node, ...props }) => <h1 className="heading-1 mt-12 mb-8 first:mt-0" {...props} />,
        h2: ({ node, ...props }) => <h2 className="heading-2 mt-10 mb-6 first:mt-0" {...props} />,
        h3: ({ node, ...props }) => <h3 className="heading-3 mt-8 mb-4 first:mt-0" {...props} />,
        p: ({ node, ...props }) => <p className="body-base text-gray-700 mb-4" {...props} />,
        a: ({ node, ...props }) => (
          <a
            className="text-violet-600 hover:text-violet-700 underline font-semibold transition-colors"
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          />
        ),
        ul: ({ node, ...props }) => <ul className="list-disc list-outside ml-6 mb-6 space-y-2" {...props} />,
        ol: ({ node, ...props }) => <ol className="list-decimal list-outside ml-6 mb-6 space-y-2" {...props} />,
        li: ({ node, ...props }) => <li className="body-base text-gray-700" {...props} />,
        strong: ({ node, ...props }) => <strong className="font-bold text-gray-900" {...props} />,
        em: ({ node, ...props }) => <em className="italic" {...props} />,
        blockquote: ({ node, ...props }) => (
          <blockquote
            className="border-l-4 border-violet-400 pl-6 py-2 my-6 italic text-gray-600 bg-violet-50/50 rounded-r-lg"
            {...props}
          />
        ),
        code: ({ node, inline, ...props }: any) =>
          inline ? (
            <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-violet-700" {...props} />
          ) : (
            <code className="block bg-gray-900 text-gray-100 p-4 rounded-xl my-6 overflow-x-auto text-sm font-mono" {...props} />
          ),
        hr: ({ node, ...props }) => <hr className="my-8 border-t-2 border-gray-200" {...props} />,
        img: ({ node, ...props }) => (
          <img className="rounded-2xl my-6 w-full shadow-lg" {...props} alt={props.alt || ''} />
        ),
        table: ({ node, ...props }) => (
          <div className="my-6 overflow-x-auto">
            <table className="w-full border-collapse" {...props} />
          </div>
        ),
        th: ({ node, ...props }) => (
          <th className="border border-gray-300 bg-violet-50 px-4 py-2 text-left font-semibold" {...props} />
        ),
        td: ({ node, ...props }) => (
          <td className="border border-gray-300 px-4 py-2" {...props} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
