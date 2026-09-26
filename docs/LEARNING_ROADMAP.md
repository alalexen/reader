# Hebrew Reader — product and implementation roadmap

Этот файл фиксирует план развития приложения после текущего MVP. Главная цель — превратить Hebrew Reader из удобного инструмента для OCR/чтения в приложение, к которому есть понятная причина возвращаться каждый день.

## Основная идея

Ежедневный цикл должен выглядеть так:

1. Пользователь открывает приложение.
2. Видит, что продолжить читать и что повторить сегодня.
3. Читает реальный ивритский текст.
4. Встречает незнакомые слова и сохраняет только полезные.
5. Эти слова автоматически попадают в повторение.
6. На следующих сессиях приложение напоминает о них в контексте.
7. Пользователь видит накопленный прогресс: чтение, повторения, знакомые слова, тексты.
8. Приложение предлагает небольшое следующее действие, а не бесконечный список функций.

Не планируется режим, в котором перевод специально скрывается при каждом клике на слово. Перевод должен оставаться быстрым и удобным.

---

# 0. Foundation: PostgreSQL, migrations and tests

Это нужно сделать до крупных продуктовых функций. Все учебные данные должны иметь один постоянный источник правды, который не зависит от конкретного браузера.

## Решение

- PostgreSQL — основное хранилище учебных данных.
- SQLAlchemy 2 — ORM/data layer.
- Alembic — versioned schema migrations.
- Psycopg 3 — PostgreSQL driver.
- `.env` хранит локальный `DATABASE_URL` и не попадает в Git.
- `.env.example` показывает формат конфигурации.
- `localStorage` остаётся только для лёгких UI/preferences данных.
- Авторизация не нужна, пока приложение single-user.
- IndexedDB не используется.

## Текущая schema v1

### texts

Хранит тексты и книги, к которым пользователь возвращается.

```text
id
title
kind                 # pasted | image | book
originalText
editedText
createdAt
updatedAt
lastOpenedAt
readingPosition
completedAt
metadata
```

### words

Одна запись на нормализованную Hebrew word form.

```text
id
surface
normalized
lemma
root
partOfSpeech
status               # new | learning | known
createdAt
updatedAt
lastSeenAt
seenCount
```

### encounters

Каждое значимое появление слова в пользовательском тексте.

```text
id
wordId
textId
sentence
position
seenAt
```

### cards

Данные для интервального повторения.

```text
id
wordId
sentence
translations
createdAt
lastReviewedAt
nextReviewAt
reviewCount
lapseCount
intervalDays
difficulty
state
```

### reviewEvents

История review-ответов.

```text
id
cardId
reviewedAt
rating               # again | hard | good | easy
previousInterval
nextInterval
```

### studySessions

```text
id
startedAt
endedAt
activeSeconds
mode                  # read | review | listening | dictation
textId
```

## Data access rule

UI не работает с SQL/SQLAlchemy напрямую.

```text
Frontend
   ↓
HTTP API
   ↓
backend service / repository
   ↓
SQLAlchemy
   ↓
PostgreSQL
```

Это позволит менять backend implementation, не переписывая UI.

## Demo data

В репозитории должен быть optional idempotent seed script.

Он создаёт:

- один небольшой demo text;
- несколько Hebrew words;
- demo translations;
- starter cards.

Повторный запуск не должен дублировать данные.

Demo seed никогда не содержит личные данные пользователя.

## Existing flashcards

Текущие flashcards пока остаются в browser `localStorage`, чтобы ничего не потерять до реализации Review.

Во время пункта 1 будет сделана одноразовая migration/import существующих карточек в PostgreSQL. После успешной миграции учебные карточки больше не будут зависеть от browser storage.

## Status

- [x] PostgreSQL connection layer
- [x] SQLAlchemy models
- [x] Alembic configuration
- [x] initial schema migration
- [x] repository layer
- [x] `.env.example`
- [x] optional demo seed
- [x] schema tests without requiring a live DB
- [x] database health endpoint
- [ ] создать локальную PostgreSQL database и применить migration на машине разработчика
- [ ] перенести существующие browser flashcards в PostgreSQL в пункте 1

## Acceptance criteria

- Clone репозитория не содержит пользовательские данные.
- У каждого пользователя своя PostgreSQL database через собственный `DATABASE_URL`.
- `.env` не попадает в Git.
- Схема versioned через Alembic.
- `alembic upgrade head` / `scripts/init_db.py` создают одинаковую структуру.
- Demo seed можно безопасно запускать повторно.
- Изменения схемы делаются только новой migration.
- UI не пишет в PostgreSQL напрямую.

---

# 1. Spaced repetition review

## Цель

Сделать flashcards активной учебной системой, а не архивом сохранённых слов.

## UX

На главном экране показывать:

```text
Review today
7 words due
[ Start review ]
```

Review screen:

1. Показывается Hebrew word.
2. Ниже можно показать исходное предложение.
3. Пользователь пытается вспомнить значение.
4. Нажимает `Reveal`.
5. Видит перевод и контекст.
6. Выбирает:
   - Again
   - Hard
   - Good
   - Easy

После ответа сразу показывается следующая карточка.

## Первая версия алгоритма

Начать с простого детерминированного scheduler, который легко тестировать и объяснять. Структуру данных сделать такой, чтобы позже можно было заменить его на FSRS без миграции карточек.

Пример поведения:

- Again → короткий повтор в той же/следующей сессии и маленький interval.
- Hard → небольшой рост interval.
- Good → стандартный рост.
- Easy → заметно больший interval.

Не привязывать UI к конкретной формуле.

## Дополнительно

- `Due today`
- `New`
- `Learning`
- `Known`
- число повторений за день;
- возможность пропустить карточку;
- возможность удалить её прямо из Review.

## Code

```text
services/reviewService.js
ui/reviewController.js
```

## Acceptance criteria

- Карточки автоматически получают следующую дату повторения.
- После перезагрузки schedule сохраняется.
- Due count корректен для текущего дня.
- Один и тот же ответ всегда приводит к предсказуемому schedule.
- Старые flashcards автоматически получают начальный review state.

---

# 2. Library and Continue Reading

## Цель

Пользователь должен продолжать чтение, а не начинать каждый запуск приложения с Upload.

## UX

Добавить Library:

```text
Continue reading

הספר שלי
Page / text 14
Last opened yesterday

[ Continue ]
```

Для каждого сохранённого текста:

- title;
- source type;
- last opened;
- progress;
- saved words count;
- reading position;
- rename;
- delete;
- mark complete.

## Сохранение текста

После OCR или вставки текста предложить:

```text
Save to Library
Title: __________
```

Для быстрого использования можно создать `Untitled text` автоматически.

## Reading position

На первой версии достаточно хранить:

- последний активный sentence index;
- scroll position.

Позже можно перейти к paragraph/token position.

## Code

```text
services/libraryService.js
ui/libraryController.js
```

## Acceptance criteria

- OCR text можно сохранить.
- Исправленный вручную текст сохраняется как текущая версия.
- После закрытия браузера пользователь может продолжить с прежнего места.
- Удаление Library item не обязано удалять сохранённые flashcards из него.

---

# 3. Main navigation: Read / Review / Library / Progress

## Цель

Убрать ощущение одной длинной страницы и сделать приложение пригодным для ежедневного использования.

## Navigation

```text
Read
Review
Library
Progress
```

Settings остаётся отдельной кнопкой.

## Read

Показывает:

- Continue reading;
- Paste text;
- Upload image;
- недавние тексты.

## Review

Показывает:

- due count;
- review session;
- summary после сессии.

## Library

Все сохранённые тексты.

## Progress

Недельная активность и vocabulary progress.

## Implementation

Сначала сделать SPA navigation без внешнего router dependency.

```text
ui/navigationController.js
```

Можно использовать `history.pushState` позже, но для первой версии достаточно state-based views.

## Acceptance criteria

- Переход между разделами не перезагружает страницу.
- Текущий текст не теряется при переходе в Review.
- На mobile navigation остаётся простой и доступной.

---

# 4. Daily goal + rabbit progress

## Цель

Использовать существующего белого кролика как функциональную часть мотивации.

## Не делать

- агрессивные streak penalties;
- красные предупреждения за пропущенный день;
- искусственные очки без связи с учёбой.

## Делать

Пользователь выбирает дневную цель, например:

```text
Reading: 20 min
Review: 10 cards
```

Кролик движется по дорожке в зависимости от выполнения общей цели.

Пример:

```text
Today
14 / 20 min reading
8 / 10 reviews

🐇────────────○  73%
```

## Daily completion

При выполнении:

```text
Today's goal complete
21 min read · 12 cards reviewed
```

## Settings

- target reading minutes;
- target review count;
- возможность отключить goal UI.

## Data

Использовать `studySessions` и `reviewEvents`, а не отдельный счётчик, который легко рассинхронизировать.

## Acceptance criteria

- progress восстанавливается после reload.
- учитывается только сегодняшний день.
- кролик корректно отображает 0–100%.
- пропущенный день ничего не «ломает».

---

# 5. Word states: New / Learning / Known

## Цель

Приложение должно помнить отношения пользователя с каждым словом.

## States

### New

Пользователь встретил слово, но ещё не начал учить.

### Learning

Слово сохранено в review или пользователь явно отметил его как изучаемое.

### Known

Пользователь считает слово знакомым или review history показывает устойчивое знание.

## UX

В word panel:

```text
Status
[ New ] [ Learning ] [ Known ]
```

В Reader можно использовать очень лёгкие визуальные подсказки:

- New — без специальной подсветки;
- Learning — небольшой marker;
- Known — почти незаметно или вообще без подсветки.

Не превращать текст в разноцветную карту.

## Automatic behavior

- первое encounter создаёт word record;
- повторные encounters увеличивают `seenCount`;
- `Remember word` переводит слово в Learning;
- Known можно установить вручную;
- позже можно автоматически предлагать Known после устойчивого review history.

## Acceptance criteria

- одинаковое нормализованное слово не создаёт десятки независимых records.
- статус виден при следующей встрече слова в другом тексте.
- encounter history сохраняет контекст.

---

# 6. Deeper Hebrew morphology

## Цель

Сделать приложение специфичным для изучения иврита, а не просто reader + translator.

## Desired information

Для слова по возможности показывать:

- lemma;
- root;
- part of speech;
- prefixes;
- gender;
- number;
- definiteness;
- для глагола:
  - binyan;
  - tense/aspect;
  - person;
  - gender;
  - number.

## UX

Пример:

```text
לכתב

Lemma        כתב
Root         כ־ת־ב
Part         verb
Binyan       PA'AL
Form         infinitive
Prefix       ל־
```

Информация должна быть компактной и с пометкой, что автоматический анализ может ошибаться.

## Technical plan

1. Сначала исследовать, какие поля реально можно стабильно получить из текущего HebPipe stack.
2. Не выдумывать root/binyan на основе ненадёжных эвристик.
3. Если текущей модели недостаточно, добавить отдельный morphology provider behind service interface.
4. UI не должен зависеть от конкретного backend provider.

## Proposed service contract

```json
{
  "surface": "לכתוב",
  "lemma": "כתב",
  "root": "כתב",
  "partOfSpeech": "VERB",
  "features": {
    "binyan": "...",
    "tense": "...",
    "person": "...",
    "gender": "...",
    "number": "..."
  },
  "segments": []
}
```

## Acceptance criteria

- Если поле неизвестно, UI его не показывает.
- Никаких фиктивных root/binyan guesses.
- Текущая segmentation остаётся fallback.

---

# 7. Sentence-by-sentence listening mode

## Цель

Связать чтение глазами с аудированием.

## UX

```text
Listening mode

[ Previous ] [ Repeat ] [ Play / Pause ] [ Next ]

Sentence 4 / 18
```

Во время воспроизведения текущий sentence подсвечивается.

## Options

- auto next;
- pause after sentence;
- repeat sentence;
- speech rate;
- voice.

## Behavior

При включённом `Pause after sentence`:

1. проиграть предложение;
2. остановиться;
3. пользователь может повторить вслух;
4. нажать Next.

## Code

Расширить текущий speech layer, не создавать вторую TTS реализацию.

```text
ui/listeningController.js
```

## Acceptance criteria

- Stop действительно останавливает текущий audio/request.
- Previous/Next не запускают несколько voice streams одновременно.
- highlight соответствует реально проигрываемому sentence.

---

# 8. Dictation mode

## Цель

Добавить короткую активную тренировку аудирования и письма на материале пользователя.

## Flow

1. Приложение выбирает sentence из текущего/сохранённого текста.
2. Sentence скрыт.
3. Пользователь слушает его.
4. Печатает услышанное.
5. Нажимает Check.
6. Видит различия.
7. Может повторно прослушать.

## Comparison

Для первой версии сравнивать normalized text:

- убрать лишние пробелы;
- нормализовать punctuation;
- отдельно решить, учитывать ли niqqud.

Не использовать fuzzy score без прозрачного объяснения.

## UX feedback

Показывать:

- пропущенные слова;
- лишние слова;
- отличающиеся слова.

## Data

Dictation session можно учитывать в `studySessions`, но не превращать её в обязательную часть daily goal на первой версии.

## Acceptance criteria

- проверка предсказуема;
- исходный Hebrew sentence всегда можно раскрыть;
- speech использует тот же выбранный voice.

---

# 9. More ways to start reading

## Цель

Снизить количество действий между пользователем и реальным текстом.

## Entry points

### Paste Hebrew text

Большое поле:

```text
Paste Hebrew text
```

### Upload image

Текущий flow.

### Continue reading

Последний Library item.

### Paste image from clipboard

Если clipboard содержит image:

- показать preview;
- перейти в тот же crop/OCR flow.

### Mobile camera

Для file input добавить camera-friendly behavior через `capture="environment"` там, где браузер это поддерживает.

## Acceptance criteria

- Paste text не требует OCR.
- Clipboard image использует существующий image pipeline.
- Все entry points приводят в один Reader flow.

---

# 10. Provider/source badges

## Цель

Пользователь должен понимать, каким сервисом получен результат, особенно если качество неожиданно низкое.

## Examples

```text
OCR · Google Vision
OCR · Local Tesseract

Translation · Google NMT
Translation · MyMemory fallback

Voice · Google WaveNet B
Voice · System Hebrew
```

## UX

Badge должен быть маленьким и вторичным, а не занимать основное место.

## Implementation

Services уже знают provider. Нужно поднять эту информацию на UI layer.

## Acceptance criteria

- fallback никогда не скрывается.
- badge меняется на фактически использованный provider.
- пользователь не должен смотреть console, чтобы понять источник результата.

---

# 11. Persistent progress and weekly summary

## Цель

Показывать накопление результата, а не только timer текущей вкладки.

## Track

- active reading minutes;
- review count;
- unique words encountered;
- words saved;
- words moved to Known;
- texts completed;
- listening/dictation sessions.

## Progress screen

Первая версия может быть без сложных charts:

```text
This week

Reading            2h 14m
Reviews            86
New words          21
Moved to Known      9
Texts completed     2
Studied             5 of 7 days
```

## Session tracking

Не считать просто всё время открытой вкладки.

Нужно учитывать:

- tab visibility;
- пользовательскую активность;
- разумный idle timeout.

Например, после нескольких минут без активности active timer ставится на pause.

## Acceptance criteria

- оставленная на ночь вкладка не даёт +8 часов.
- недельные данные корректно агрегируются из raw events/sessions.
- progress можно пересчитать из базы.

---

# 12. Flashcard search, filters and editing

## Цель

Flashcards должны оставаться полезными после сотен сохранённых слов.

## Search

По:

- Hebrew surface;
- normalized form;
- translation;
- note.

## Filters

- Due today;
- Learning;
- Known;
- Recently added;
- source text.

## Edit

Пользователь может изменить:

- translation;
- sentence;
- personal note;
- status.

Не редактировать автоматически сохранённый review history.

## UX

Flashcard list должен быть отдельным management view, а не длинной секцией под Reader.

## Acceptance criteria

- поиск работает без перезагрузки.
- фильтры можно комбинировать в разумных пределах.
- редактирование сохраняется сразу и переживает reload.

---

# 13. Backup and restore

## Цель

Учебные данные за месяцы нельзя оставлять только на милость browser storage.

## Export

`Export all data` создаёт JSON с:

- schema version;
- texts;
- words;
- encounters;
- cards;
- review events;
- sessions;
- settings.

## Import

Перед импортом:

- проверить schema version;
- проверить формат;
- показать, будет merge или replace.

На первой версии лучше предложить два явных действия:

- Merge backup
- Replace local data

## Safety

Перед Replace автоматически создать current-state backup.

## Acceptance criteria

- backup с нуля восстанавливает Library и SRS schedule.
- повреждённый JSON не ломает существующие данные.
- import старой schema проходит через migrations.

---

# 14. Personal “word of the day” from the user's own texts

## Цель

Возвращать пользователя к словам, с которыми у него уже есть личный контекст.

Это не случайное слово из внешнего словаря.

## Selection logic

Выбирать слово из:

- due review cards;
- recently seen Learning words;
- слов, которые встречались несколько раз, но ещё не Known.

Не выбирать Known слова без причины.

## UX

Например в header/home:

```text
Do you still remember?

להצליח

Seen 4 times in your reading
[ Show meaning ] [ Review ]
```

Можно использовать sentence из исходного текста.

## Acceptance criteria

- одно и то же слово не показывается бесконечно несколько дней подряд без причины.
- при наличии due card Word of the day ведёт в Review.
- если данных мало, блок просто не показывается.

---

# Recommended implementation order

## Phase A — data foundation

1. PostgreSQL connection + `.env`
2. SQLAlchemy schema + Alembic migrations
3. repository/service layer
4. database health check
5. optional idempotent demo seed
6. schema tests
7. migrate existing browser flashcards when Review is implemented
8. backup primitives

## Phase B — daily learning loop

6. Spaced repetition
7. Library + Continue Reading
8. Main navigation
9. Word states
10. Daily goal + rabbit progress

После этой фазы приложение уже должно ощущаться как ежедневный learning product.

## Phase C — Hebrew depth

11. richer morphology

Перед реализацией провести технический spike и проверить реальные возможности Hebrew NLP stack.

## Phase D — listening practice

12. sentence listening
13. dictation

## Phase E — daily usability

14. paste text / clipboard image / mobile camera
15. provider badges
16. persistent progress
17. flashcard management
18. full backup/restore

## Phase F — personalization

19. personal word of the day

---

# Suggested home screen after Phase B

```text
Hebrew Reader

Continue reading
הספר שלי — Chapter 4
████████░░  78%

Today
12 words to review
14 / 20 min reading

[ Continue reading ]   [ Review words ]

🐇──────────────○
       70% today
```

Upload/Paste остаются внутри Read, а не занимают весь стартовый экран.

---

# Database decision

Для roadmap используется **PostgreSQL без IndexedDB**.

## Почему PostgreSQL

Учебные данные должны быть одинаковыми независимо от того, открыт ли интерфейс в Chrome, Safari или другом обычном браузере, если они обращаются к одному backend.

PostgreSQL хранит:

- Library texts;
- words and encounters;
- review cards and schedule;
- review history;
- study sessions;
- progress data.

## Single-user model

Пока приложение используется как personal/self-hosted tool:

- таблица users не нужна;
- login/auth не нужен;
- все записи принадлежат одному владельцу database;
- backend подключается к базе через один `DATABASE_URL`.

Если приложение позже станет публично доступным в интернете или multi-user, перед таким deployment понадобится authentication/authorization и ownership columns.

## Что остаётся в localStorage

Только небольшие browser preferences, например:

- selected voice;
- OCR provider;
- translation provider;
- translation languages;
- UI preferences;
- возможно daily goal presentation settings.

Учебные данные не должны жить только в browser storage после их миграции.

## Что происходит при clone репозитория

Git содержит:

- models;
- migrations;
- seed script;
- `.env.example`.

Git не содержит:

- локальный `.env`;
- PostgreSQL data directory;
- личные тексты;
- review history;
- реальные flashcards пользователя.

Новый пользователь создаёт свою database, указывает свой `DATABASE_URL`, применяет migrations и получает пустой профиль. Demo seed запускается отдельно и только по желанию.

## Backup

Позже backup/restore должен работать на уровне PostgreSQL data через application export/import, а не копированием browser storage.

---

# Quality rules for every implementation step

Для каждого пункта roadmap:

1. Не смешивать новую feature logic обратно в `app.js`.
2. Держать persistent data access в services.
3. Добавлять migration при изменении stored schema.
4. Для scheduler/stat calculations писать unit-testable pure functions.
5. Не менять несколько больших подсистем одновременно без необходимости.
6. Сохранять working fallback paths.
7. После каждого шага проверять:
   - reload;
   - empty state;
   - offline/local behavior, где применимо;
   - existing stored data;
   - mobile layout;
   - keyboard accessibility.
8. Делать небольшие commits, чтобы feature можно было откатить отдельно.
