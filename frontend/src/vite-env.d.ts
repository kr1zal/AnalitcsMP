/// <reference types="vite/client" />

// HTML inert attribute — not yet in @types/react
declare namespace React {
  interface HTMLAttributes<T> {
    inert?: '' | boolean;
  }
}

declare module 'swiper/css' {
  const content: string;
  export default content;
}

declare module 'swiper/css/pagination' {
  const content: string;
  export default content;
}

declare module 'swiper/css/navigation' {
  const content: string;
  export default content;
}

declare module 'swiper/css/autoplay' {
  const content: string;
  export default content;
}
