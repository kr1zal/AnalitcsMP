/**
 * FAQ accordion section.
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { RevealSection } from '../hooks/useLandingAnimations';
import { FAQ_ITEMS } from '../constants/landingData';

function FAQAccordionItem({
  question,
  answer,
  index,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const questionId = `faq-q-${index}`;
  const answerId = `faq-a-${index}`;

  return (
    <div className="border-b border-gray-200">
      <button
        type="button"
        id={questionId}
        className="flex items-center justify-between w-full py-5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-lg"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={answerId}
      >
        <span className="text-base font-medium text-gray-900 pr-8 group-hover:text-indigo-600 transition-colors sm:text-lg">
          {question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        id={answerId}
        role="region"
        aria-labelledby={questionId}
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100 pb-5' : 'max-h-0 opacity-0'}`}
      >
        <p className="text-sm text-gray-600 leading-relaxed pr-12 sm:text-base">{answer}</p>
      </div>
    </div>
  );
}

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 sm:py-28 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealSection>
          <div className="text-center mb-12 sm:mb-16">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 uppercase tracking-[0.12em] bg-indigo-50 px-3.5 py-1.5 rounded-full mb-5">
              FAQ
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
              Частые вопросы
            </h2>
          </div>
        </RevealSection>
        <RevealSection>
          <div className="divide-y divide-gray-200 border-t border-gray-200">
            {FAQ_ITEMS.map((faq, i) => (
              <FAQAccordionItem
                key={faq.question}
                question={faq.question}
                answer={faq.answer}
                index={i}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            ))}
          </div>
        </RevealSection>
        <RevealSection>
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500">
              Не нашли ответ?{' '}
              <a
                href="mailto:support@reviomp.ru"
                className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                Напишите нам
              </a>
            </p>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}
