/**
 * Trust bar with scrolling marquee of API protocols / data sources.
 * CSS animation: trust-marquee / trust-marquee-track classes in index.css.
 */
import { Database, Globe, ShieldCheck, Lock } from 'lucide-react';

export function TrustMarquee() {
  const renderSet = (prefix: string) => (
    <>
      <div key={`${prefix}-wb`} className="flex items-center gap-2.5 mx-8 sm:mx-10 shrink-0">
        <span className="text-base font-black text-purple-500 tracking-tight select-none">WB</span>
        <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">Wildberries API</span>
      </div>
      <div key={`${prefix}-oz`} className="flex items-center gap-2.5 mx-8 sm:mx-10 shrink-0">
        <span className="text-base font-black text-blue-500 tracking-tight select-none">OZON</span>
        <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">Ozon Seller API</span>
      </div>
      <div key={`${prefix}-pg`} className="flex items-center gap-2.5 mx-8 sm:mx-10 shrink-0">
        <Database className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">Данные зашифрованы</span>
      </div>
      <div key={`${prefix}-rest`} className="flex items-center gap-2.5 mx-8 sm:mx-10 shrink-0">
        <Globe className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">Только чтение данных</span>
      </div>
      <div key={`${prefix}-ssl`} className="flex items-center gap-2.5 mx-8 sm:mx-10 shrink-0">
        <ShieldCheck className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">Безопасное соединение</span>
      </div>
      <div key={`${prefix}-fernet`} className="flex items-center gap-2.5 mx-8 sm:mx-10 shrink-0">
        <Lock className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">Ваши ключи защищены</span>
      </div>
    </>
  );

  return (
    <div className="border-t border-b border-gray-200 py-5 overflow-hidden">
      <div className="trust-marquee">
        <div className="trust-marquee-track">
          {renderSet('a')}
          {renderSet('b')}
        </div>
      </div>
    </div>
  );
}
