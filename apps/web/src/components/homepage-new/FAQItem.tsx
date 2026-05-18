interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

export function FAQItem({ question, answer, isOpen, onToggle }: FAQItemProps) {
  return (
    <div className="border-b border-sm-border first:border-t first:border-sm-border">
      <button
        className="w-full flex items-center justify-between py-[22px] bg-transparent border-none cursor-pointer font-medium text-lg text-sm-ink text-left tracking-[-0.2px]"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        {question}
        <span
          className={`w-7 h-7 rounded-full text-base leading-[26px] text-center border flex-shrink-0 inline-flex items-center justify-center transition-colors ${
            isOpen
              ? 'bg-sm-ink text-white border-sm-ink'
              : 'bg-transparent text-sm-ink border-sm-border'
          }`}
        >
          {isOpen ? '−' : '+'}
        </span>
      </button>

      {isOpen && (
        <div className="pb-[22px] font-normal text-base leading-[1.6] text-sm-ink2 max-w-[680px]">
          {answer}
        </div>
      )}
    </div>
  );
}
