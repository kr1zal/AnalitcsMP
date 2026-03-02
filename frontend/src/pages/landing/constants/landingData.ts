/**
 * Static data constants for the landing page.
 */
import {
  BarChart3,
  TrendingUp,
  ClipboardList,
  PieChart,
  RefreshCw,
  Megaphone,
} from 'lucide-react';
import type { ShowcaseSlideData, Testimonial, PricingFeature, StatItem, ProblemCard, Feature } from '../types';

/* ──────────────────────────────────────────────
   Navigation
   ────────────────────────────────────────────── */

export const NAV_ITEMS = [
  { label: 'Возможности', id: 'features' },
  { label: 'Тарифы', id: 'pricing' },
  { label: 'Безопасность', id: 'security' },
  { label: 'FAQ', id: 'faq' },
] as const;

/* ──────────────────────────────────────────────
   Stats Bar
   ────────────────────────────────────────────── */

export const STATS: StatItem[] = [
  {
    value: '<0.1%',
    label: 'Расхождение с ЛК',
    detail: 'Проверено аудитом WB и Ozon',
  },
  {
    value: '15+',
    label: 'Типов отчётов',
    detail: 'Продажи, остатки, реклама, UE...',
  },
  {
    value: '4',
    label: 'Синхронизации в день',
    detail: 'Данные всегда актуальны',
  },
  {
    value: '5 мин',
    label: 'Настройка и готово',
    detail: 'API-ключ и полная аналитика',
  },
];

/* ──────────────────────────────────────────────
   Problem Section
   ────────────────────────────────────────────── */

export const PROBLEMS: ProblemCard[] = [
  {
    number: '3+',
    unit: 'часа',
    subtitle: 'Ежедневно на ручную сверку',
    description: 'Данные из WB ЛК, Ozon ЛК, рекламных кабинетов \u2014 формулы ломаются, данные теряются',
    accentColor: 'border-red-500',
    bgColor: 'bg-red-50',
  },
  {
    number: '15\u201330%',
    unit: 'выручки',
    subtitle: 'Скрытые удержания не видны в ЛК',
    description: 'Логистика, хранение, штрафы, возвраты \u2014 реальную маржу посчитать невозможно',
    accentColor: 'border-amber-500',
    bgColor: 'bg-amber-50',
  },
  {
    number: '7+',
    unit: 'отчётов',
    subtitle: 'Вместо одного дашборда',
    description: 'WB ЛК, Ozon ЛК, Excel, рекламные кабинеты \u2014 вместо развития бизнеса',
    accentColor: 'border-orange-500',
    bgColor: 'bg-orange-50',
  },
];

/* ──────────────────────────────────────────────
   Features Bento Grid
   ────────────────────────────────────────────── */

export const FEATURES: Feature[] = [
  {
    icon: BarChart3,
    title: 'Дашборд',
    description:
      '8 ключевых метрик: выручка, прибыль, удержания, реклама, ДРР, остатки, себестоимость, рентабельность',
    gradient: 'from-indigo-500 to-indigo-600',
    size: 'hero',
    visual: 'chart',
  },
  {
    icon: TrendingUp,
    title: 'Реальная прибыль',
    description:
      'Автоматический расчёт с учётом ВСЕХ удержаний маркетплейсов. Расхождение с ЛК\u00A0<\u00A00.1%',
    gradient: 'from-emerald-500 to-emerald-600',
    size: 'hero',
    visual: 'waterfall',
  },
  {
    icon: PieChart,
    title: 'Дерево удержаний',
    description:
      'Детализация расходов: комиссии, логистика, хранение, штрафы\u00A0\u2014 как в ЛК, но нагляднее',
    gradient: 'from-violet-500 to-violet-600',
    size: 'standard',
    visual: null,
  },
  {
    icon: ClipboardList,
    title: 'Монитор заказов',
    description:
      'Позаказная детализация с реальными ценами после скидок и полной разбивкой издержек',
    gradient: 'from-blue-500 to-blue-600',
    size: 'standard',
    visual: null,
  },
  {
    icon: RefreshCw,
    title: 'Авто-синхронизация',
    description:
      'Данные обновляются автоматически до 4 раз в день. Без ручных выгрузок',
    gradient: 'from-cyan-500 to-cyan-600',
    size: 'standard',
    visual: null,
  },
  {
    icon: Megaphone,
    title: 'Рекламная аналитика',
    description:
      'Расходы на рекламу, ДРР по дням, ROI кампаний\u00A0\u2014 WB и Ozon в одном месте',
    gradient: 'from-amber-500 to-amber-600',
    size: 'standard',
    visual: null,
    badge: 'Pro',
  },
];

/* ──────────────────────────────────────────────
   Product Showcase
   ────────────────────────────────────────────── */

export const SHOWCASE_SLIDES: ShowcaseSlideData[] = [
  {
    id: 'widgets',
    tab: 'Виджеты',
    icon: BarChart3,
    title: 'Дашборд, который подстраивается под вас',
    description: 'Drag\u00A0&\u00A0drop виджеты - выберите нужные метрики и\u00A0расставьте как удобно',
    highlights: ['16+ виджетов', 'WB + Ozon в\u00A0одном окне', 'Обновление каждые 30\u00A0мин'],
    desktop: '/screenshots/desktop-1.png',
    mobile: '/screenshots/mobile-3.png',
  },
  {
    id: 'unit-economics',
    tab: 'Юнит-экономика',
    icon: TrendingUp,
    title: 'Прибыль по каждому товару - до копейки',
    description: 'Себестоимость, маржа и\u00A0ДРР\u00A0- точная картина по\u00A0каждому SKU',
    highlights: ['Разбивка FBO\u00A0/\u00A0FBS', 'Водопад затрат', 'Отдельно по\u00A0маркетплейсам'],
    desktop: '/screenshots/desktop-2.png',
    mobile: '/screenshots/mobile-1.png',
  },
  {
    id: 'stocks',
    tab: 'Остатки',
    icon: ClipboardList,
    title: 'Запасы под контролем - без\u00A0OOS',
    description: 'Прогноз остатков, алерты при\u00A0нуле, все склады WB и\u00A0Ozon в\u00A0одной таблице',
    highlights: ['Прогноз на 30\u00A0дней', 'Алерты при\u00A00\u00A0остатков', 'Все склады WB\u00A0+\u00A0Ozon'],
    desktop: '/screenshots/desktop-3.png',
    mobile: '/screenshots/mobile-2.png',
  },
];

export const SHOWCASE_AUTOPLAY_MS = 6000;

/* ──────────────────────────────────────────────
   Social Proof / Testimonials
   ────────────────────────────────────────────── */

export const TESTIMONIALS_ROW_1: Testimonial[] = [
  {
    quote: 'Раньше каждый понедельник убивал полдня на Excel - сводил выручку, вычитал комиссии, пытался понять прибыль. Подключил сервис - и через 10 минут увидел цифру, которая совпала с моим расчётом. Только без четырёх часов работы.',
    author: 'Алексей М.',
    role: 'Продавец витаминов',
    niche: 'Витамины и БАДы',
    marketplace: 'WB',
    metric: '\u20134 часа',
    metricLabel: 'экономия в неделю',
    initials: 'АМ',
    avatarColor: 'bg-indigo-500',
  },
  {
    quote: 'У меня 12 SKU на Ozon, и я искренне не понимала, почему при хорошей выручке на счёт приходит копейки. Дерево удержаний показало: 23% уходило на логистику FBO. Перенесла часть на FBS - маржа выросла на 8 процентных пунктов.',
    author: 'Екатерина С.',
    role: 'Селлер БАДов',
    niche: 'БАДы',
    marketplace: 'Ozon',
    metric: '+8 п.п.',
    metricLabel: 'рост маржи',
    initials: 'ЕС',
    avatarColor: 'bg-blue-500',
  },
  {
    quote: 'Торгую одновременно на WB и Ozon. Открывать два личных кабинета, выгружать отчёты, сводить в таблице - это был ад. Здесь оба маркетплейса в одном экране, и я вижу, где какой товар приносит больше. Решения принимаю за минуты.',
    author: 'Дмитрий К.',
    role: 'Селлер спортпита',
    niche: 'Спортивное питание',
    marketplace: 'WB + Ozon',
    metric: '2 МП',
    metricLabel: 'в одном дашборде',
    initials: 'ДК',
    avatarColor: 'bg-emerald-500',
  },
  {
    quote: 'Юнит-экономика спасла мой бизнес. Я думала, что все 8 позиций прибыльные. Оказалось, два SKU работали в минус из-за высокой комиссии и возвратов. Убрала их - общая прибыль выросла, хотя выручка снизилась.',
    author: 'Марина Л.',
    role: 'Продавец косметики',
    niche: 'Косметика',
    marketplace: 'WB',
    metric: '2 SKU',
    metricLabel: 'убыточных найдено',
    initials: 'МЛ',
    avatarColor: 'bg-rose-500',
  },
];

export const TESTIMONIALS_ROW_2: Testimonial[] = [
  {
    quote: 'Дважды попадал на OOS - товар кончился, карточка улетела вниз, потом две недели восстанавливал позиции. С прогнозом остатков вижу, когда нужно заказывать поставку. Уже два месяца без единого out-of-stock.',
    author: 'Сергей В.',
    role: 'Продавец БАДов',
    niche: 'БАДы',
    marketplace: 'Ozon',
    metric: '0 OOS',
    metricLabel: 'за 2 месяца',
    initials: 'СВ',
    avatarColor: 'bg-amber-500',
  },
  {
    quote: 'Лила деньги в рекламу на WB и не понимала, окупается она или нет. В аналитике увидела ДРР 18% - при марже 22% это почти ноль прибыли. Перераспределила бюджет на топовые карточки, ДРР упал до 9%.',
    author: 'Анна Т.',
    role: 'Категорийный менеджер',
    niche: 'Витамины',
    marketplace: 'WB',
    metric: '9%',
    metricLabel: 'ДРР вместо 18%',
    initials: 'АТ',
    avatarColor: 'bg-violet-500',
  },
  {
    quote: 'Ставил план продаж наобум - просто "хочу миллион". Теперь вижу реальный темп: сколько продаю в день, укладываюсь или нет, прогноз на конец месяца. В январе впервые выполнил план на 94%. Просто потому что видел, где отстаю.',
    author: 'Игорь Н.',
    role: 'Предприниматель',
    niche: 'БАДы и витамины',
    marketplace: 'WB + Ozon',
    metric: '94%',
    metricLabel: 'выполнение плана',
    initials: 'ИН',
    avatarColor: 'bg-cyan-500',
  },
  {
    quote: 'Каждое утро данные уже обновлены. Не нужно ничего выгружать, импортировать, ждать. Открываю дашборд - и сразу вижу вчерашнюю прибыль, остатки, рекламу. Для меня это как иметь финдиректора, который работает 24/7.',
    author: 'Ольга П.',
    role: 'Владелец магазина',
    niche: 'Здоровое питание',
    marketplace: 'Ozon',
    metric: '24/7',
    metricLabel: 'автосинхронизация',
    initials: 'ОП',
    avatarColor: 'bg-teal-500',
  },
];

export const MP_BADGE_STYLES: Record<string, string> = {
  'WB': 'bg-violet-50 text-violet-600 ring-violet-200',
  'Ozon': 'bg-blue-50 text-blue-600 ring-blue-200',
  'WB + Ozon': 'bg-indigo-50 text-indigo-600 ring-indigo-200',
};

/* ──────────────────────────────────────────────
   Pricing
   ────────────────────────────────────────────── */

export const PRICING_FEATURES: PricingFeature[] = [
  { name: 'Дашборд', free: true, pro: true },
  { name: 'Маркетплейсы', free: 'WB', pro: 'WB + Ozon' },
  { name: 'Макс. SKU', free: '3', pro: '20' },
  { name: 'Авто-синхронизация', free: '2 раза/день', pro: 'каждые 6ч' },
  { name: 'Ручное обновление', free: false, pro: '1/день' },
  { name: 'Удержания (детализация)', free: false, pro: true },
  { name: 'Unit-экономика', free: false, pro: true },
  { name: 'Реклама и ДРР', free: false, pro: true },
  { name: 'PDF экспорт', free: false, pro: true },
  { name: 'Сравнение периодов', free: false, pro: true },
];

/* ──────────────────────────────────────────────
   FAQ
   ────────────────────────────────────────────── */

export const FAQ_ITEMS = [
  {
    question: 'Какие маркетплейсы поддерживаются?',
    answer:
      'Wildberries и Ozon. Данные загружаются через официальные API маркетплейсов и отображаются в едином дашборде. Вы видите продажи, прибыль, удержания и остатки по обоим площадкам одновременно.',
  },
  {
    question: 'Безопасно ли подключать API-токены?',
    answer:
      'Да. Токены шифруются алгоритмом Fernet и хранятся только в зашифрованном виде. Мы запрашиваем доступ исключительно на чтение - сервис не может менять цены, карточки или делать поставки. Ваши магазины в полной безопасности.',
  },
  {
    question: 'Как считается прибыль?',
    answer:
      'Чистая прибыль = сумма перечислений от маркетплейса минус закупочная цена минус расходы на рекламу. Все удержания (комиссия, логистика, хранение, штрафы, эквайринг) уже учтены в перечислениях. Расчёт верифицирован по финансовым отчётам WB и Ozon с точностью до копейки.',
  },
  {
    question: 'Что входит в бесплатный тариф?',
    answer:
      'Free-тариф работает без ограничений по времени. Он включает основной дашборд с ключевыми метриками, подключение 1 маркетплейса и аналитику до 3 товаров. Этого достаточно, чтобы оценить сервис на реальных данных.',
  },
  {
    question: 'Чем Pro отличается от бесплатного?',
    answer:
      'Pro снимает все лимиты: оба маркетплейса, неограниченное число товаров, аналитика FBO и FBS, план продаж с прогнозом, экспорт в Excel и PDF, до 3 синхронизаций в день. Все функции, которые видите на скриншотах выше - доступны в Pro.',
  },
  {
    question: 'Как часто обновляются данные?',
    answer:
      'Данные синхронизируются автоматически. На Free-тарифе - 2 раза в день, на Pro - до 3 раз, на Business - до 4 раз. Также можно запустить обновление вручную из настроек. Утром вы уже видите вчерашние цифры.',
  },
  {
    question: 'Могу ли я настроить дашборд под себя?',
    answer:
      'Да. Дашборд состоит из виджетов, которые можно перетаскивать, добавлять и убирать. Выберите метрики, которые важны именно вам, и расставьте их в удобном порядке. Конфигурация сохраняется автоматически.',
  },
  {
    question: 'Как отменить подписку?',
    answer:
      'В разделе Настройки, вкладка Тариф. Отмена в один клик, без звонков и писем в поддержку. Доступ к платным функциям сохраняется до конца оплаченного периода.',
  },
] as const;

/* ──────────────────────────────────────────────
   Footer
   ────────────────────────────────────────────── */

export const FOOTER_NAV = [
  { id: 'features', label: 'Возможности' },
  { id: 'pricing', label: 'Тарифы' },
  { id: 'how-it-works', label: 'Как это работает' },
] as const;

export const FOOTER_RESOURCES = [
  { id: 'security', label: 'Безопасность' },
  { id: 'faq', label: 'Частые вопросы' },
  { id: 'dataflow', label: 'DataFlow' },
] as const;
