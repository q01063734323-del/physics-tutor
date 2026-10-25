# Physics Tutor — «Физика с Егором»

Локальная образовательная платформа на Next.js, Firebase Auth/Firestore и Cloudinary.

## Запуск

```bash
npm install
npm run dev
```

Откройте http://localhost:3000.

Локальный преподавательский вход для проверки интерфейса:

```text
Логин: egor
Пароль: physics2025
```

Для реального production-доступа используйте Firebase Authentication; локальный вход не является механизмом безопасности.

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
- учебные файлы: Cloudinary через unsigned upload preset `physics_homework`;
- локальный fallback старых заданий и интерфейсных настроек: browser `localStorage`.

## Безопасность

Правила доступа находятся в `firestore.rules`. Перед production-развёртыванием примените их через Firebase CLI и настройте custom claim `teacher: true` только из доверенного Admin SDK окружения. Не добавляйте секреты Admin SDK в Next.js клиентский код.
