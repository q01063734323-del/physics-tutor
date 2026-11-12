import Link from "next/link";
import { PhysicsIcon } from "./PhysicsMark";

type Deadline = { id: string; title: string; date: string };

type OverviewProps = {
  teacher: boolean;
  items: number;
  completed: number;
  pending: number;
  average: number;
  attempts: number;
  streak: number;
  deadlines: Deadline[];
  navigate: (view: string) => void;
};

const deadlineFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" });

function DeadlineList({ deadlines }: { deadlines: Deadline[] }) {
  return deadlines.length ? (
    <ul className="pt-deadlines">
      {deadlines.map(item => (
        <li key={item.id}>
          <time dateTime={item.date}>{deadlineFormat.format(new Date(item.date))}</time>
          <span>{item.title}</span>
        </li>
      ))}
    </ul>
  ) : <p>У заданий пока нет ближайших сроков.</p>;
}

function ClassroomEntry() {
  return (
    <section className="pt-class-entry">
      <p className="pt-kicker"><PhysicsIcon name="video" size={17} /> ВИРТУАЛЬНЫЙ КЛАСС</p>
      <h2>Урок и рабочая доска</h2>
      <p>Подключитесь по приглашению или откройте доску для самостоятельной работы.</p>
      <Link className="pt-text-link" href="/classroom">Открыть класс <PhysicsIcon name="arrow" size={16} /></Link>
    </section>
  );
}

export function PhysicsSchedule({ deadlines, openTasks }: { deadlines: Deadline[]; openTasks: () => void }) {
  return (
    <div className="pt-schedule">
      <section className="pt-schedule-agenda" aria-labelledby="pt-schedule-title">
        <h2 id="pt-schedule-title">Сроки сдачи работ</h2>
        <DeadlineList deadlines={deadlines} />
        <button type="button" className="pt-text-link" onClick={openTasks}>К заданиям <PhysicsIcon name="arrow" size={16} /></button>
      </section>
      <aside className="pt-overview-aside" aria-label="Виртуальный класс"><ClassroomEntry /></aside>
    </div>
  );
}

export function PhysicsOverview({ teacher, items, completed, pending, average, attempts, streak, deadlines, navigate }: OverviewProps) {
  return <div className="pt-overview">
    <div className="pt-overview-main">
      {teacher ? (
        <section className="pt-study-feature">
          <div>
            <h2>Домашние работы</h2>
            <p>{pending ? `Работ ждут проверки: ${pending}.` : "Задайте практику всему классу или отдельному ученику."}</p>
            <button className="pt-action" type="button" onClick={() => navigate("tasks")}>Открыть задания <PhysicsIcon name="arrow" size={17} /></button>
          </div>
          <div className="pt-study-formula" aria-hidden="true"><PhysicsIcon name="tasks" size={110} /></div>
        </section>
      ) : (
        <section className="pt-study-feature">
          <div>
            <p className="pt-kicker">МЕХАНИКА</p>
            <h2>Законы<br />Ньютона</h2>
            <p>Разберитесь, как силы меняют движение тела.</p>
            <button className="pt-action" type="button" onClick={() => navigate("formulas")}>Повторить формулы <PhysicsIcon name="arrow" size={17} /></button>
          </div>
          <div className="pt-study-formula" aria-hidden="true"><span>F = ma</span><small>ВТОРОЙ ЗАКОН</small></div>
        </section>
      )}
      <section className="pt-metrics" aria-label={teacher ? "Сводка по работам" : "Прогресс обучения"}>
        <div><span>{teacher ? "Опубликовано заданий" : "Проверено заданий"}</span><strong>{teacher ? items : completed}{!teacher && <small> / {items}</small>}</strong></div>
        <div><span>{teacher ? "Работ на проверке" : "Серия занятий"}</span><strong>{teacher ? pending : streak}{!teacher && <small> дн.</small>}</strong></div>
        <div><span>{teacher ? "Попыток сохранено" : "Средний результат"}</span><strong>{teacher ? attempts : attempts ? `${average}%` : "—"}</strong></div>
      </section>
    </div>
    <aside className="pt-overview-aside" aria-label="Учебный план и виртуальный класс">
      <section><p className="pt-kicker"><PhysicsIcon name="calendar" size={17} /> УЧЕБНЫЙ ПЛАН</p><h2>Ближайшие сроки</h2>
        <DeadlineList deadlines={deadlines.slice(0, 3)} />
        <button className="pt-text-link" type="button" onClick={() => navigate("schedule")}>Всё расписание <PhysicsIcon name="arrow" size={16} /></button>
      </section>
      <ClassroomEntry />
    </aside>
  </div>;
}
