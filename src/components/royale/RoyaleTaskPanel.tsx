'use client';

import { memo, useEffect, useRef, type RefObject } from 'react';
import { balance, type Tier } from '@/lib/royale/config';
import { tierLabels } from '@/lib/royale/tasks';
import { displayTrainerAnswer } from '@/lib/trainer-bank';
import type { TrainerCheckResult } from '@/lib/trainer-public';
import { MathText } from '../QuestionTrainer';
import SourceScan from '../SourceScan';
import type { GameTask, IssuedTask, MatchDescriptor } from './types';
import { BattleIcon } from './RoyaleBattleIcon';
import b from './RoyaleBattle.module.css';

const TaskMath = memo(MathText);
const TaskScan = memo(SourceScan);

type Props = {
  open: boolean;
  mobile: boolean;
  task: IssuedTask | null;
  feedback: TrainerCheckResult | null;
  input: string;
  busy: boolean;
  ended: boolean;
  earned: number;
  message: string;
  slow: boolean;
  questionSeconds: number;
  matchSeconds: number;
  catalog: GameTask[];
  match: MatchDescriptor;
  tier: Tier | 'all';
  section: string;
  topic: string;
  newOnly: boolean;
  rewardRef: RefObject<HTMLDivElement | null>;
  onTier: (tier: Tier | 'all') => void;
  onSection: (section: string) => void;
  onTopic: (topic: string) => void;
  onNewOnly: (onlyNew: boolean) => void;
  onInput: (value: string) => void;
  onCheck: () => void;
  onNext: () => void;
  onClose: () => void;
};

export function RoyaleTaskPanel({
  open, mobile, task, feedback, input, busy, ended, earned, message, slow,
  questionSeconds, matchSeconds, catalog, match, tier, section, topic, newOnly,
  rewardRef, onTier, onSection, onTopic, onNewOnly, onInput, onCheck, onNext, onClose,
}: Props) {
  const title = useRef<HTMLHeadingElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const question = task?.question;
  const answer = question?.answer;
  const sourceLabel = question?.source.taskLabel ?? '';
  const shortNumber = sourceLabel.match(/\d+[а-я]?$/i)?.[0];
  const numeric = answer?.type === 'numeric';
  const unit = numeric ? answer.unit : undefined;
  const choices = question?.answer?.type === 'multi_select';

  useEffect(() => {
    if (open) title.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (scrollArea.current) scrollArea.current.scrollTop = 0;
  }, [question?.id, feedback]);

  const sections = [...new Set(catalog.filter(q => match.section === 'all' || q.section === match.section).map(q => q.section))];
  const topics = [...new Set(catalog
    .filter(q => (match.section === 'all' || q.section === match.section) && (section === 'all' || q.section === section))
    .flatMap(q => q.topics))].filter(t => !match.topics.length || match.topics.includes(t));

  return (
    <aside id="royale-task" className={b.lesson} data-open={open} inert={!open}
      role={mobile ? 'dialog' : undefined} aria-modal={mobile && open ? true : undefined}
      aria-labelledby="royale-task-title"
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
          return;
        }
        if (!mobile || event.key !== 'Tab') return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], summary',
        )].filter(element => element.getClientRects().length);
        if (event.shiftKey && (document.activeElement === controls[0] || document.activeElement === title.current)) {
          event.preventDefault();
          controls.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
          event.preventDefault();
          controls[0]?.focus();
        }
      }}>
      <div className={b.lessonHeader}>
        <BattleIcon name="book"/>
        <h2 id="royale-task-title" ref={title} tabIndex={-1}>Задача по физике</h2>
        <button type="button" className={b.iconButton} onClick={onClose} aria-label="Закрыть задачу">
          <BattleIcon name="close"/>
        </button>
        {question && <p className={b.topic}><b>{question.section}</b>{question.topics.filter(topic => topic !== question.section).slice(0, 2).map(topic => <span key={topic}> · {topic}</span>)}</p>}
      </div>
      <div className={b.focusMeter} data-slow={slow}>
        <BattleIcon name="clock"/>
        <div>
          <div className={b.focusText}><span>{slow ? 'Замедление матча' : 'Матч идёт в обычном темпе'}</span>
            <b>{String(questionSeconds).padStart(2, '0')} / {balance.focusPerQuestionSeconds} с</b>
          </div>
          <progress value={questionSeconds} max={balance.focusPerQuestionSeconds} aria-label="Доступное время замедления на задачу"/>
          <small>Остаток на матч · {matchSeconds} с</small>
        </div>
      </div>
      <div ref={scrollArea} className={b.lessonScroll}>
        {feedback && <div ref={rewardRef} className={b.feedback} data-correct={Boolean(feedback.correct)} role="status">
          <BattleIcon name={feedback.correct ? 'check' : 'close'}/>
          <div>
            <strong>{feedback.correct ? earned > 0 ? 'Верно!' : 'Верно! Запас энергии полный' : 'Ответ неверный'}</strong>
            <p>{feedback.correct && earned > 0 ? `+${earned} энергии` : feedback.correct ? feedback.feedback : 'Энергия не начислена'}</p>
          </div>
        </div>}
        {question && <article className={b.paper} key={question.id} aria-label={`Условие задачи № ${question.source.taskLabel}`}>
          <div className={b.paperPrompt} data-numbered={Boolean(shortNumber)}>
            {shortNumber && <span className={b.taskNumber} title={sourceLabel}>№ {shortNumber}</span>}
            <p><TaskMath text={question.prompt}/></p>
          </div>
          {question.assets.filter(asset => asset.role === 'scan' || asset.role === 'diagram').map(asset =>
            <div key={asset.id} className={b.paperAsset} data-kind={asset.role}>
              <TaskScan src={asset.url} alt={asset.alt}/>
            </div>)}
          <p className={b.source}>Источник: {question.source.title}, стр. {question.source.pdfPage ?? '—'}, № {question.source.taskLabel}.</p>
        </article>}
        {feedback && <details className={b.lessonDetails} name="royale-lesson-options">
          <summary>Правильный ответ и разбор</summary>
          <div className={b.solution}>
            <p>{feedback.feedback}</p>
            <p><b>Ответ:</b> {displayTrainerAnswer(feedback.answer)}</p>
            {feedback.solution ? <p><TaskMath text={feedback.solution}/></p> : <p>Подробное текстовое решение отсутствует в источнике.</p>}
            {feedback.assets.map(asset => <TaskScan key={asset.id} src={asset.url} alt={asset.alt}/>)}
          </div>
        </details>}
        {busy && !question && <p className={b.loadingText} role="status">Открываем задачу из банка ЕГЭ…</p>}
        <details className={b.lessonDetails} name="royale-lesson-options">
          <summary>Фильтры следующей задачи</summary>
          <div className={b.filters}>
            <label>Сложность<select value={tier} disabled={busy} onChange={event => onTier(event.target.value as Tier | 'all')}>
              <option value="all">Любая</option>
              {Object.entries(tierLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select></label>
            <label>Раздел<select value={section} disabled={busy} onChange={event => onSection(event.target.value)}>
              <option value="all">Все доступные</option>
              {sections.map(name => <option key={name}>{name}</option>)}
            </select></label>
            <label>Тема<select value={topic} disabled={busy} onChange={event => onTopic(event.target.value)}>
              <option value="all">Все доступные</option>
              {topics.map(name => <option key={name}>{name}</option>)}
            </select></label>
            <label className={b.onlyNew}><input type="checkbox" disabled={busy} checked={newOnly}
              onChange={event => onNewOnly(event.target.checked)}/>Только ещё не решённые верно</label>
          </div>
        </details>
      </div>
      {message && <p className={b.taskError} role="alert">{message}</p>}
      {task && !feedback && <form className={b.answerForm} onSubmit={event => { event.preventDefault(); onCheck(); }}>
        <label className={b.answerField}>
          <span>{numeric ? 'Введите ответ' : choices ? 'Номера верных вариантов' : 'Последовательность ответа'}</span>
          <input value={input} inputMode={numeric ? 'decimal' : 'text'} disabled={busy || ended} maxLength={128}
            onChange={event => onInput(event.target.value)}
            placeholder={numeric ? 'Число' : 'Номера или значения'}/>
          {unit && <span className={b.unit}>{unit}</span>}
        </label>
        {choices && <fieldset className={b.choices}>
          <legend>Номера утверждений из условия</legend>
          {['1','2','3','4','5','6','7','8','9'].map(number => <button type="button" key={number}
            aria-label={`Вариант ${number}`} aria-pressed={Boolean(input.match(/[1-9]/g)?.includes(number))}
            disabled={busy || ended} onClick={() => {
              const numbers = new Set(input.match(/[1-9]/g) || []);
              if (numbers.has(number)) numbers.delete(number);
              else numbers.add(number);
              onInput([...numbers].sort().join(' '));
            }}>{number}</button>)}
        </fieldset>}
        <div className={b.answerActions}>
          <div className={b.reward}><BattleIcon name="energy"/><span>Награда · {tierLabels[task.tier]}<b>+{task.reward} энергии</b></span></div>
          <button type="submit" className={b.goldButton} disabled={!input.trim() || busy || ended}>
            <BattleIcon name="check"/>{busy ? 'Проверяем…' : 'Проверить ответ'}
          </button>
        </div>
      </form>}
      {feedback && <div className={b.responseActions}>
        <button type="button" className={b.secondaryButton} onClick={onNext} disabled={busy || ended}>
          {busy ? 'Загружаем…' : 'Следующая задача'}
        </button>
        <button type="button" className={b.goldButton} onClick={onClose}>Вернуться в бой</button>
      </div>}
      {!task && !busy && <button type="button" className={b.goldButton} onClick={onNext} disabled={ended}>Загрузить задачу</button>}
    </aside>
  );
}
