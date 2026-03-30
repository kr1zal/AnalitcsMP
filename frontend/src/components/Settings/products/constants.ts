export const SHAKE_CSS = `
@keyframes pm-shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
  20%, 40%, 60%, 80% { transform: translateX(3px); }
}
.pm-shake { animation: pm-shake 0.4s ease-in-out; }
`;

export const ROW_H = 'h-[44px] sm:h-[40px]';
export const HEADER_H = 'h-7';
