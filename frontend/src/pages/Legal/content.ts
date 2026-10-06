/**
 * Public legal texts. Kept in Ukrainian (original) and English; other UI languages see English.
 * Describe only what the code really does — update together with data handling changes.
 */

export const LEGAL_CONTACT = "help.poruch@gmail.com";
export const LEGAL_UPDATED = "2026-10-07";

export interface LegalSection {
  title: string;
  /** Paragraphs; a string array inside renders as a bulleted list. */
  body: (string | string[])[];
}

export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

type Lang = "uk" | "en";

const privacy: Record<Lang, LegalDoc> = {
  uk: {
    title: "Політика конфіденційності",
    intro:
      "Poruch — застосунок локальної взаємодопомоги: люди просять про допомогу, а люди поруч відгукуються. Тут пояснено, які дані ми збираємо, навіщо, кому передаємо і як ви можете ними керувати.",
    sections: [
      {
        title: "1. Хто відповідає за ваші дані",
        body: [`Сервіс Poruch (poruch-app.duckdns.org). З питань щодо даних пишіть на ${LEGAL_CONTACT}.`],
      },
      {
        title: "2. Які дані ми збираємо",
        body: [
          [
            "Обліковий запис: email, ім'я для відображення, пароль (зберігається лише у вигляді захищеного хешу). Якщо ви входите через Google — ідентифікатор облікового запису Google, email та ім'я.",
            "Профіль: фото профілю, чим ви можете допомогти, які речі маєте, налаштування приватності.",
            "Запити про допомогу: опис, категорія, терміновість, бажаний час, подяка, фото, місце, яке ви вказали, і назва населеного пункту.",
            "Місцезнаходження: точку, яку ви передаєте під час створення запиту або для сповіщень «поруч», і поточне місце, коли ввімкнено «Я зараз можу допомогти». Ми не відстежуємо вас у фоновому режимі.",
            "Спілкування: повідомлення і фото в чатах, відгуки, подяки, скарги та звернення в підтримку.",
            "Сповіщення: технічні дані push-підписки вашого пристрою (адреса сервісу сповіщень браузера та ключі шифрування) і налаштування сповіщень.",
            "Технічні дані: IP-адреса та службові журнали запитів (для безпеки й усунення помилок), а також знеособлені події використання (наприклад, «створено запит»).",
          ],
        ],
      },
      {
        title: "3. Навіщо ми їх використовуємо",
        body: [
          [
            "Щоб працював сервіс: показувати запити поруч, надсилати сповіщення людям поблизу, з'єднувати автора й помічника в чаті.",
            "Щоб захищати користувачів: розглядати скарги, блокувати порушників, запобігати спаму й зловживанням (зокрема обмеженням частоти запитів).",
            "Щоб надсилати службові листи: підтвердження email, відновлення пароля, відповіді на звернення.",
            "Щоб покращувати сервіс на основі знеособленої статистики.",
          ],
          "Ми не продаємо ваші дані, не показуємо рекламу і не використовуємо дані для рекламного профілювання.",
        ],
      },
      {
        title: "4. Що бачать інші користувачі",
        body: [
          [
            "Ваше ім'я та фото профілю — якщо ви це дозволили в налаштуваннях приватності; інакше вас показано як «Сусід».",
            "Для запиту — приблизне місце та відстань. Точне місце бачать лише ті, хто відгукнувся на запит, і обраний помічник.",
            "Кількість ваших допомог і отриманих подяк.",
          ],
          "З фото, які ви завантажуєте, ми видаляємо метадані (зокрема GPS-координати й модель камери).",
        ],
      },
      {
        title: "5. Кому ми передаємо дані",
        body: [
          "Лише постачальникам, без яких сервіс не працює, і лише в потрібному обсязі:",
          [
            "Hetzner Online GmbH (Німеччина) — сервер, на якому працюють застосунок і база даних.",
            "Cloudflare, Inc. (сховище R2) — зберігання фото та резервних копій бази даних.",
            "Google LLC — вхід через Google (якщо ви його обираєте) та надсилання службових листів через Gmail.",
            "Сервіси push-сповіщень вашого браузера (Google, Apple, Mozilla та ін.) — доставка сповіщень на ваш пристрій.",
            "BigDataCloud — визначення назви вашого населеного пункту; передаються округлені координати (приблизно до 2 км) або IP-адреса.",
            "OpenFreeMap — завантаження фрагментів карти (ваш браузер звертається до їхніх серверів).",
          ],
          "Деякі з цих постачальників можуть обробляти дані за межами вашої країни, зокрема в США. Ми також можемо розкрити дані, якщо цього вимагає закон.",
        ],
      },
      {
        title: "6. Скільки ми зберігаємо дані",
        body: [
          [
            "Дані облікового запису — поки він існує. Деактивація вимикає обліковий запис, скасовує активні запити й видаляє push-підписки, але історію допомог зберігає.",
            "Повне видалення облікового запису та пов'язаних даних — за запитом на " +
              LEGAL_CONTACT +
              ". Виконуємо протягом 30 днів.",
            "Резервні копії бази даних зберігаються 14 днів, після чого видаляються автоматично.",
            "Службові журнали сервера перезаписуються автоматично і не зберігаються довго.",
          ],
        ],
      },
      {
        title: "7. Ваші права",
        body: [
          "Ви можете отримати копію своїх даних, виправити їх, видалити, обмежити або заперечити проти їх обробки, а також відкликати згоду (наприклад, вимкнути геолокацію чи сповіщення в налаштуваннях пристрою або застосунку). Напишіть на " +
            LEGAL_CONTACT +
            ". Ви також маєте право звернутися до органу із захисту персональних даних у своїй країні.",
        ],
      },
      {
        title: "8. Безпека",
        body: [
          "З'єднання шифрується (HTTPS), паролі зберігаються лише як хеш, сесія — у захищених cookie, база даних недоступна з інтернету, а резервні копії зберігаються в приватному сховищі. Жоден захист не є абсолютним, тому не передавайте в описах і чатах зайвих персональних даних.",
        ],
      },
      {
        title: "9. Cookie та сховище браузера",
        body: [
          "Ми використовуємо лише необхідні cookie (сесія входу та захист від підробки запитів) і сховище браузера для ваших налаштувань (мова, тема, регіон). Рекламних і сторонніх відстежувальних cookie немає.",
        ],
      },
      {
        title: "10. Діти",
        body: ["Сервіс не призначений для осіб, молодших 16 років."],
      },
      {
        title: "11. Зміни",
        body: [
          "Ми можемо оновлювати цю політику. Дата чинної редакції вказана нижче; про суттєві зміни повідомимо в застосунку або листом.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    intro:
      "Poruch is a local mutual aid app: people ask for help and people nearby respond. This policy explains what data we collect, why, who we share it with, and how you can control it.",
    sections: [
      {
        title: "1. Who is responsible for your data",
        body: [
          `The Poruch service (poruch-app.duckdns.org). For any data questions, write to ${LEGAL_CONTACT}.`,
        ],
      },
      {
        title: "2. What we collect",
        body: [
          [
            "Account: email, display name, password (stored only as a secure hash). If you sign in with Google — your Google account identifier, email and name.",
            "Profile: profile photo, what you can help with, items you have, privacy settings.",
            "Help requests: description, category, urgency, preferred time, thank-you, photos, the place you chose, and the name of the locality.",
            "Location: the point you share when creating a request or for “nearby” notifications, and your current location while “I can help right now” is on. We do not track you in the background.",
            "Communication: chat messages and photos, responses, thanks, reports and support messages.",
            "Notifications: your device's push subscription details (the browser's push service address and encryption keys) and notification settings.",
            "Technical data: IP address and server request logs (for security and troubleshooting), plus de-identified usage events (e.g. “request created”).",
          ],
        ],
      },
      {
        title: "3. Why we use it",
        body: [
          [
            "To run the service: show requests nearby, notify people around, connect the author and the helper in chat.",
            "To keep users safe: handle reports, block abusers, prevent spam and abuse (including rate limiting).",
            "To send service emails: email confirmation, password reset, replies to support messages.",
            "To improve the service using de-identified statistics.",
          ],
          "We do not sell your data, show ads, or use your data for advertising profiles.",
        ],
      },
      {
        title: "4. What other users see",
        body: [
          [
            "Your name and profile photo — if you allow it in privacy settings; otherwise you appear as “Neighbour”.",
            "For a request — an approximate place and distance. The exact place is visible only to people who responded and to the chosen helper.",
            "How many times you helped and how many thanks you received.",
          ],
          "We remove metadata (including GPS coordinates and camera model) from photos you upload.",
        ],
      },
      {
        title: "5. Who we share data with",
        body: [
          "Only with providers the service cannot work without, and only as much as needed:",
          [
            "Hetzner Online GmbH (Germany) — the server running the app and the database.",
            "Cloudflare, Inc. (R2 storage) — storage of photos and database backups.",
            "Google LLC — Google sign-in (if you choose it) and sending service emails via Gmail.",
            "Your browser's push services (Google, Apple, Mozilla, etc.) — delivering notifications to your device.",
            "BigDataCloud — finding the name of your locality; rounded coordinates (about 2 km) or your IP address are sent.",
            "OpenFreeMap — map tiles (your browser loads them from their servers).",
          ],
          "Some of these providers may process data outside your country, including in the USA. We may also disclose data where required by law.",
        ],
      },
      {
        title: "6. How long we keep data",
        body: [
          [
            "Account data — while the account exists. Deactivation turns the account off, cancels active requests and removes push subscriptions, but keeps the help history.",
            "Full deletion of your account and related data — on request to " +
              LEGAL_CONTACT +
              ", completed within 30 days.",
            "Database backups are kept for 14 days and then deleted automatically.",
            "Server logs are overwritten automatically and are not kept for long.",
          ],
        ],
      },
      {
        title: "7. Your rights",
        body: [
          "You can get a copy of your data, correct it, delete it, restrict or object to its processing, and withdraw consent (e.g. turn off location or notifications in your device or app settings). Write to " +
            LEGAL_CONTACT +
            ". You also have the right to complain to the data protection authority in your country.",
        ],
      },
      {
        title: "8. Security",
        body: [
          "Connections are encrypted (HTTPS), passwords are stored only as hashes, the session lives in secure cookies, the database is not reachable from the internet, and backups are kept in private storage. No protection is absolute, so please do not put unnecessary personal data in descriptions and chats.",
        ],
      },
      {
        title: "9. Cookies and browser storage",
        body: [
          "We use only necessary cookies (sign-in session and protection against forged requests) and browser storage for your settings (language, theme, region). There are no advertising or third-party tracking cookies.",
        ],
      },
      {
        title: "10. Children",
        body: ["The service is not intended for people under 16."],
      },
      {
        title: "11. Changes",
        body: [
          "We may update this policy. The date of the current version is shown below; we will announce significant changes in the app or by email.",
        ],
      },
    ],
  },
};

const terms: Record<Lang, LegalDoc> = {
  uk: {
    title: "Умови використання",
    intro:
      "Користуючись Poruch, ви погоджуєтесь із цими умовами. Будь ласка, прочитайте їх — вони короткі й про головне: безпеку та повагу.",
    sections: [
      {
        title: "1. Що таке Poruch",
        body: [
          "Poruch — платформа для взаємодопомоги між людьми поруч. Це не маркетплейс послуг: ми не є стороною домовленостей між користувачами, не наймаємо помічників і не обробляємо платежі.",
        ],
      },
      {
        title: "2. Не екстрена служба",
        body: [
          "Poruch не замінює екстрені служби. Якщо є загроза життю, здоров'ю чи майну — негайно телефонуйте до екстрених служб вашої країни (в Україні — 112, 101, 102, 103).",
        ],
      },
      {
        title: "3. Обліковий запис",
        body: [
          [
            "Вам має бути щонайменше 16 років.",
            "Вказуйте правдиву інформацію і не створюйте облікових записів від імені інших людей.",
            "Ви відповідаєте за безпеку свого пароля і за дії у своєму обліковому записі.",
          ],
        ],
      },
      {
        title: "4. Правила поведінки",
        body: [
          "Заборонено:",
          [
            "шахрайство, вимагання, обман щодо подяки чи оплати;",
            "погрози, переслідування, образи, дискримінація;",
            "спам, реклама, масові розсилки;",
            "публікація чужих персональних даних без згоди (адрес, телефонів, фото);",
            "незаконні, небезпечні чи непристойні запити та матеріали;",
            "спроби обійти обмеження сервісу, втручання в його роботу чи доступ до чужих даних.",
          ],
          "Ми можемо видаляти такий вміст, обмежувати або блокувати облікові записи.",
        ],
      },
      {
        title: "5. Домовленості та подяка",
        body: [
          "Подяка чи оплата — добровільна домовленість між користувачами. Платформа не гарантує її виконання і не несе відповідальності за неї. Не передавайте гроші наперед незнайомим людям і будьте обережні під час зустрічей: зустрічайтеся в людних місцях і повідомляйте близьких, куди йдете.",
        ],
      },
      {
        title: "6. Ваш вміст",
        body: [
          "Ви зберігаєте права на тексти й фото, які публікуєте, і надаєте Poruch безоплатний дозвіл зберігати й показувати їх іншим користувачам у межах роботи сервісу. Публікуйте лише те, на що маєте право.",
        ],
      },
      {
        title: "7. Скарги",
        body: [
          "Якщо хтось порушує правила, скористайтеся кнопкою «Поскаржитися» або «Заблокувати» в застосунку чи напишіть на " +
            LEGAL_CONTACT +
            ".",
        ],
      },
      {
        title: "8. Відповідальність",
        body: [
          "Сервіс надається «як є». Ми робимо все можливе для його стабільної роботи, але не гарантуємо, що він працюватиме без перерв і помилок. Користувачі самі відповідають за свої дії, домовленості та зустрічі; Poruch не несе відповідальності за поведінку користувачів, якість чи наслідки допомоги — у межах, дозволених законом.",
        ],
      },
      {
        title: "9. Припинення",
        body: [
          "Ви можете будь-коли деактивувати обліковий запис у налаштуваннях або попросити його повністю видалити. Ми можемо обмежити чи припинити доступ у разі порушення цих умов.",
        ],
      },
      {
        title: "10. Зміни умов",
        body: [
          "Ми можемо оновлювати ці умови; про суттєві зміни повідомимо в застосунку. Продовжуючи користуватися сервісом, ви погоджуєтесь з оновленою редакцією.",
        ],
      },
      {
        title: "11. Контакти",
        body: [`Питання щодо умов: ${LEGAL_CONTACT}.`],
      },
    ],
  },
  en: {
    title: "Terms of Service",
    intro:
      "By using Poruch you agree to these terms. Please read them — they are short and about what matters most: safety and respect.",
    sections: [
      {
        title: "1. What Poruch is",
        body: [
          "Poruch is a platform for mutual aid between people nearby. It is not a services marketplace: we are not a party to arrangements between users, we do not hire helpers and we do not process payments.",
        ],
      },
      {
        title: "2. Not an emergency service",
        body: [
          "Poruch does not replace emergency services. If there is a threat to life, health or property, call your country's emergency number immediately (e.g. 112 in the EU and Ukraine, 911 in the USA).",
        ],
      },
      {
        title: "3. Your account",
        body: [
          [
            "You must be at least 16 years old.",
            "Provide truthful information and do not create accounts on behalf of others.",
            "You are responsible for keeping your password safe and for activity in your account.",
          ],
        ],
      },
      {
        title: "4. Rules of conduct",
        body: [
          "You must not:",
          [
            "commit fraud or extortion, or deceive others about thanks or payment;",
            "threaten, harass, insult or discriminate;",
            "send spam, advertising or mass messages;",
            "publish other people's personal data without consent (addresses, phone numbers, photos);",
            "post illegal, dangerous or obscene requests or content;",
            "try to bypass the service's limits, interfere with its operation or access other people's data.",
          ],
          "We may remove such content and restrict or block accounts.",
        ],
      },
      {
        title: "5. Arrangements and thanks",
        body: [
          "Any thanks or payment is a voluntary arrangement between users. The platform does not guarantee or take responsibility for it. Do not send money in advance to strangers and be careful when meeting: meet in public places and tell someone close where you are going.",
        ],
      },
      {
        title: "6. Your content",
        body: [
          "You keep the rights to the texts and photos you post and give Poruch a free permission to store and show them to other users as part of running the service. Only post what you have the right to share.",
        ],
      },
      {
        title: "7. Reports",
        body: [
          "If someone breaks the rules, use the “Report” or “Block” buttons in the app, or write to " +
            LEGAL_CONTACT +
            ".",
        ],
      },
      {
        title: "8. Liability",
        body: [
          "The service is provided “as is”. We do our best to keep it running, but we do not guarantee it will be uninterrupted or error-free. Users are responsible for their own actions, arrangements and meetings; to the extent permitted by law, Poruch is not liable for users' behaviour or the quality or consequences of help.",
        ],
      },
      {
        title: "9. Termination",
        body: [
          "You can deactivate your account at any time in settings or ask us to delete it completely. We may restrict or end access if these terms are violated.",
        ],
      },
      {
        title: "10. Changes",
        body: [
          "We may update these terms and will announce significant changes in the app. By continuing to use the service you accept the updated version.",
        ],
      },
      {
        title: "11. Contact",
        body: [`Questions about these terms: ${LEGAL_CONTACT}.`],
      },
    ],
  },
};

export const LEGAL = { privacy, terms };
export type LegalKind = keyof typeof LEGAL;
