import type { ReactNode } from "react";
import { PhysicsIcon, PhysicsMark } from "./PhysicsMark";
import FloatingAppWindows from "./FloatingAppWindows";
import { MagneticLink, Reveal, Tilt } from "./PremiumMotion";
import s from "./PhysicsLanding.module.css";

const features = [
  { icon: "book", number: "01", title: "Понять. А не заучить.", text: "Теория, формулы и наглядные эксперименты. Разбирайся, что стоит за каждым символом.", detail: "ОТ ПРИНЦИПА К ФОРМУЛЕ", formula: "F = ma" },
  { icon: "lab", number: "02", title: "Практика даёт уверенность.", text: "Задачи по темам, проверка ответов и разбор ошибок. Возвращайся к тому, что пока не получается.", detail: "ОГЭ · ЕГЭ · ТРЕНАЖЁРЫ", formula: "E = hν" },
  { icon: "people", number: "03", title: "Ты не один на этом пути.", text: "Домашние работы, комментарии преподавателя и виртуальный класс с рабочей доской.", detail: "ОБРАТНАЯ СВЯЗЬ И ПОДДЕРЖКА", formula: "Δ → ∞" },
] as const;

export function PhysicsLanding({ children }: { children: ReactNode }) {
  return <div className={`pt-site ${s.landing}`} id="top">
    <a href="#landing-content" className={s.skip}>Перейти к содержанию</a>
    <header className={s.header}><PhysicsMark /><nav aria-label="О платформе"><a href="#features">Возможности</a><a href="#method">Как учимся</a><a href="#teacher">Преподаватель</a></nav><a className={s.headerLogin} href="#login">Войти <PhysicsIcon name="arrow" size={16}/></a></header>
    <main id="landing-content" tabIndex={-1}>
      <section className={s.hero} aria-labelledby="hero-title"><div className={s.heroHalo} aria-hidden="true"/><div className={s.heroCopy}><p className={s.kicker}><span/> ФИЗИКА С ЕГОРОМ <i/> НОВАЯ ОРБИТА ОБУЧЕНИЯ</p><h1 id="hero-title">{["Физика,", "которую", "ты"].map((word,i)=><span key={word} className="premium-word" style={{"--word-index":i} as React.CSSProperties}>{word}&nbsp;</span>)}<br/><em>{["наконец", "поймёшь."].map((word,i)=><span key={word} className="premium-word" style={{"--word-index":i+3} as React.CSSProperties}>{word}{i===0 ? " " : ""}</span>)}</em></h1><p className={s.lead}>Готовься к ЕГЭ и ОГЭ, решай задачи, отслеживай прогресс<br className={s.desktopBreak}/> и открывай физику по-новому.</p><div className={s.actions}><MagneticLink className={s.primary} href="#login">Начать учиться <PhysicsIcon name="arrow" size={18}/></MagneticLink><a className={s.secondary} href="#app-preview">Посмотреть платформу <span aria-hidden="true">↓</span></a></div><p className={s.heroNote}>Понимание законов. Уверенность в решении. Твой следующий шаг.</p></div><div id="app-preview" className={s.preview}><FloatingAppWindows/></div></section>
      <div className={s.subjectStrip} aria-label="Темы физики"><span>МЕХАНИКА</span><i>↗</i><span>ТЕРМОДИНАМИКА</span><i>↗</i><span>ЭЛЕКТРОДИНАМИКА</span><i>↗</i><span>ОПТИКА</span><i>↗</i><span>КВАНТОВАЯ ФИЗИКА</span></div>
      <section className={s.section} id="features"><Reveal><p className={s.eyebrow}>СЛОЖНОЕ СТАНОВИТСЯ ПОНЯТНЫМ</p><h2>Всё связано.<br/><span>И всё — в одной платформе.</span></h2><div className={s.features}>{features.map(item => <Tilt key={item.number} className={s.feature}><div className={s.featureTop}><PhysicsIcon name={item.icon} size={23}/><span>{item.number}</span></div><div className={s.featureFormula} aria-hidden="true">{item.formula}</div><small>{item.detail}</small><h3>{item.title}</h3><p>{item.text}</p></Tilt>)}</div></Reveal></section>
      <section id="method" className={`${s.section} ${s.method}`}><Reveal className={s.methodGrid}><div><p className={s.eyebrow}>ОТ ВОПРОСА К ОТКРЫТИЮ</p><h2>Не магия.<br/><span>Система.</span></h2><p>Каждый шаг делает следующий понятнее. Учись в своём темпе и разбирай сложное вместе с преподавателем.</p></div><ol>{[["Разберись в принципе", "Начни с теории, формул и наглядных примеров."],["Проверь себя на практике", "Реши задачу в тренажёре или отправь работу преподавателю."],["Увидь, что получилось", "Изучи результат, разбери комментарии и повтори сложную тему."]].map(([title,text],i)=><li key={title}><span>0{i+1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></Reveal></section>
      <section id="teacher" className={s.section}><Reveal className={s.teacher}><div className={s.teacherVisual} aria-hidden="true"><span>φ</span><i/><small>МЫШЛЕНИЕ ВАЖНЕЕ ЗАПОМИНАНИЯ</small></div><div><p className={s.eyebrow}>НА ОДНОЙ ВОЛНЕ</p><h2>Физика.<br/><span>С Егором.</span></h2><p>Преподаватель физики и автор Physics Tutor. На занятиях разбираем, почему формула работает и как выбрать подход к новой задаче.</p><a className={s.secondary} href="#login">Перейти к обучению <PhysicsIcon name="arrow" size={17}/></a></div></Reveal></section>
      <section id="login" className={`${s.section} ${s.loginSection}`}><Reveal className={s.loginGrid}><div><p className={s.eyebrow}>ТВОЯ ТОЧКА СТАРТА</p><h2>Большие открытия<br/><span>начинаются с вопроса.</span></h2><p>Уже есть аккаунт? Войди в кабинет.<br/>Для регистрации попроси преподавателя прислать личную ссылку.</p></div>{children}</Reveal></section>
    </main><footer className={s.footer}><PhysicsMark/><span>Физика с Егором · Учебная платформа</span><a href="#top">На орбиту ↑</a></footer>
  </div>;
}
