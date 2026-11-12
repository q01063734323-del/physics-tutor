import type { ReactNode } from "react";
import { PhysicsIcon, PhysicsMark } from "./PhysicsMark";

const benefits = [
  { title: "Практика по темам", text: "От законов Ньютона до оптики. Выбирайте тему, решайте задачи и возвращайтесь к сложным вопросам.", icon: "book" },
  { title: "Работа с преподавателем", text: "Отправляйте домашние работы и разбирайте комментарии к своим решениям.", icon: "people" },
  { title: "Видимый прогресс", text: "Следите за результатами, сроками сдачи и темами, которые стоит повторить перед экзаменом.", icon: "progress" },
] as const;

export function PhysicsLanding({ children }: { children: ReactNode }) {
  return <div className="pt-site" id="top">
    <header className="pt-public-header pt-wrap">
      <PhysicsMark />
      <nav aria-label="О платформе"><a href="#features">Возможности</a><a href="#method">Как учимся</a><a href="#teacher">Преподаватель</a></nav>
      <a href="#login" className="pt-header-link">Войти <PhysicsIcon name="arrow" size={17} /></a>
    </header>
    <main>
      <section className="pt-landing-hero pt-wrap" aria-labelledby="pt-title">
        <div className="pt-hero-copy">
          <p className="pt-kicker"><span /> ФИЗИКА · ОГЭ И ЕГЭ</p>
          <h1 id="pt-title">Физика,<br />которую <em>понимаешь.</em></h1>
          <p className="pt-hero-lead">Онлайн-платформа для занятий физикой. Решайте задачи в интерактивном тренажёре и получайте разборы от преподавателя.</p>
          <div className="pt-hero-actions"><a className="pt-action" href="#login">Войти в кабинет <PhysicsIcon name="arrow" size={19} /></a><a className="pt-text-link" href="#method">Как проходит обучение</a></div>
        </div>
        <figure className="pt-figure">
          <div className="pt-figure-head"><span>PHYSICS TUTOR / ЛАБОРАТОРИЯ</span><span>FIG. 01</span></div>
          <svg aria-hidden="true" viewBox="0 0 520 440" className="pt-orbit">
            <defs>
              <pattern id="pt-grid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0v26" fill="none" stroke="#90d4b5" strokeOpacity=".14" /></pattern>
              <linearGradient id="pt-orbit-stroke" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#d5ffe4" /><stop offset="1" stopColor="#40a882" /></linearGradient>
              <radialGradient id="pt-orbit-core" cx=".38" cy=".32" r=".65"><stop stopColor="#e2ffe3" /><stop offset=".35" stopColor="#8de3ae" /><stop offset="1" stopColor="#155342" /></radialGradient>
            </defs>
            <rect width="520" height="440" fill="url(#pt-grid)" />
            <path d="M260 14v412M30 220h460" stroke="#a9e5c9" strokeOpacity=".27" strokeDasharray="4 7" />
            <g transform="translate(260 220)" fill="none">
              <circle r="174" stroke="#9beac2" strokeOpacity=".26" strokeDasharray="1 6" />
              <circle r="143" stroke="#9beac2" strokeOpacity=".18" />
              {Array.from({ length: 19 }, (_, i) => <ellipse key={i} rx={167 - i * 1.55} ry={35 + i * 4.5} transform={`rotate(${-56 + i * 6.1})`} stroke="url(#pt-orbit-stroke)" strokeOpacity={.18 + i * .028} strokeWidth="1.15" />)}
              <circle r="42" fill="url(#pt-orbit-core)" stroke="#b5f5ca" strokeOpacity=".55" />
              <circle cx="-101" cy="97" r="6" fill="#d4ffe2" />
              <circle cx="130" cy="-72" r="4" fill="#b1f5c6" />
              <circle cx="-70" cy="-146" r="3" fill="#77cda5" />
            </g>
          </svg>
          <figcaption><span>01 / ДВИЖЕНИЕ</span><span>Орбита и сила</span></figcaption>
        </figure>
      </section>
      <section className="pt-editorial pt-wrap" id="features">
        <h2>Всё для практики.</h2>
        <div className="pt-benefits">{benefits.map(item => <article key={item.title}><div className="pt-benefit-top"><PhysicsIcon name={item.icon} size={24} /></div><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>
      <div className="pt-method"><section className="pt-wrap pt-method-grid" id="method">
        <div><h2>От вопроса<br />к решению.</h2></div>
        <ol>{[["Изучите принцип", "Начните с теории, формул и наглядных примеров."], ["Решите задачу", "Проверьте себя в тренажёре или отправьте решение преподавателю."], ["Разберите результат", "Вернитесь к комментариям и повторите то, что оказалось сложным."]].map(([title, body], i) => <li key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol>
      </section></div>
      <section className="pt-wrap pt-teacher" id="teacher">
        <div className="pt-teacher-mark" aria-hidden="true"><span>φ</span><small>PHYSICS / 01</small></div>
        <div><p className="pt-kicker">ПРЕПОДАВАТЕЛЬ</p><h2>Егор</h2><p>Преподаватель физики и автор Physics Tutor. На занятиях разбираем, почему формула работает и как выбрать подход к новой задаче.</p></div>
      </section>
      <section className="pt-wrap pt-login-section" id="login">
        <div><h2>Начните учиться</h2><p>Попросите преподавателя прислать личную ссылку для регистрации. Если аккаунт уже есть, войдите в кабинет.</p></div>
        {children}
      </section>
    </main>
    <footer className="pt-footer"><div className="pt-wrap"><PhysicsMark /><span>Физика с Егором · Учебная платформа</span><a href="#top">Наверх ↑</a></div></footer>
  </div>;
}
