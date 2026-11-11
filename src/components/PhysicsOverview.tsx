import Link from "next/link";
import { PhysicsIcon } from "./PhysicsMark";

type OverviewProps = {
  teacher: boolean;
  items: number;
  completed: number;
  pending: number;
  average: number;
  attempts: number;
  streak: number;
  deadlines: { title: string; date: string }[];
  navigate: (view: string) => void;
  startExam: () => void;
};

export function PhysicsOverview({ teacher, items, completed, pending, average, attempts, streak, deadlines, navigate, startExam }: OverviewProps) {
  return <div className="pt-overview">
    <div className="pt-overview-main">
      <section className="pt-study-feature">
        <div><p className="pt-kicker">МЕХАНИКА / ТЕМА ДЛЯ ПРАКТИКИ</p><h2>Законы<br />Ньютона</h2><p>Разберитесь, как силы меняют движение тела.</p><button className="pt-action" onClick={startExam}>Открыть тренажёр <PhysicsIcon name="arrow" size={17} /></button></div>
        <div className="pt-study-formula" aria-hidden="true"><span>F = ma</span><small>ВТОРОЙ ЗАКОН</small></div>
      </section>
      <section className="pt-metrics" aria-label={teacher ? "Сводка по работам" : "Прогресс обучения"}>
        <div><span>{teacher ? "Опубликовано заданий" : "Проверено заданий"}</span><strong>{teacher ? items : completed}{!teacher && <small> / {items}</small>}</strong></div>
        <div><span>{teacher ? "Работ на проверке" : "Серия занятий"}</span><strong>{teacher ? pending : streak}{!teacher && <small> дн.</small>}</strong></div>
        <div><span>{teacher ? "Попыток сохранено" : "Средний результат"}</span><strong>{teacher ? attempts : attempts ? `${average}%` : "—"}</strong></div>
      </section>
    </div>
    <aside className="pt-overview-aside" aria-label="Учебный план и уведомления">
      <section><p className="pt-kicker"><PhysicsIcon name="calendar" size={17} /> УЧЕБНЫЙ ПЛАН</p><h2>Ближайшие сроки</h2>
        {deadlines.length ? <ul>{deadlines.map((item, index) => <li key={index}><time dateTime={item.date}>{new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(item.date))}</time><span>{item.title}</span></li>)}</ul> : <p>У заданий пока нет ближайших дедлайнов.</p>}
        <button className="pt-text-link" onClick={() => navigate("tasks")}>К заданиям <PhysicsIcon name="arrow" size={16} /></button>
      </section>
      <section className="pt-class-entry"><p className="pt-kicker"><PhysicsIcon name="video" size={17} /> ВИРТУАЛЬНЫЙ КЛАСС</p><h2>Рабочая доска</h2><p>Расписание видеозанятий пока не подключено. Доска доступна для самостоятельной работы.</p><Link className="pt-text-link" href="/classroom">Открыть класс <PhysicsIcon name="arrow" size={16} /></Link></section>
    </aside>
  </div>;
}
