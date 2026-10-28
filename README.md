# Physics Tutor — «Физика с Егором»

Локальная образовательная платформа на Next.js, Firebase Auth/Firestore и Cloudinary.

## Запуск

```bash
npm install
npm run dev
```

Откройте http://localhost:3000.

Вход выполняется через Firebase Authentication по email и паролю. Демо-пароли в клиенте отключены.

Для Render добавьте домен `physics-tutor-6ytz.onrender.com` в Firebase Authentication → Settings → Authorized domains и включите провайдер Email/Password.

## Проверки

```bash
npm run test
npm run build -- --webpack
```

Тесты в `scripts/test-grading.mjs` проверяют числовые ответы, десятичную запятую, отрицательные числа, погрешность и последовательности.

## Данные

- задания: Firestore `assignments`;
- отправленные решения и проверки: Firestore `submissions`;
- числовые попытки: Firestore `attempts`;
- экзаменационные попытки: Firestore `examAttempts`;
- результаты тематических тестов: Firestore `quizResults`;
- тематический банк задач: Firestore `questionBank` (`verification: verified` виден ученикам, `needs_review` — только преподавателю);
- учебные файлы: Cloudinary через unsigned upload preset `physics_homework`;
- локальный fallback старых заданий и интерфейсных настроек: browser `localStorage`.

## Безопасность

Правила доступа находятся в `firestore.rules`. Перед production-развёртыванием примените их через Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

Преподаватель определяется по custom claim `teacher: true` или доверенному email из правил. Не добавляйте секреты Admin SDK в Next.js клиентский код.
