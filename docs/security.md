# Безпека

## Автентифікація

* JWT (simplejwt) у **HttpOnly** cookies; refresh-cookie доступний лише для `/api/v1/auth/`. Токени не зберігаються в `localStorage`.
* Ротація refresh-токенів з blacklist; вихід і скидання пароля відкликають токени.
* CSRF: для cookie-автентифікації небезпечні методи потребують `X-CSRFToken`. `SameSite=Lax`, `Secure` у production.
* Email обов'язково підтверджується (підписаний токен з терміном дії); без підтвердження — доступ лише до `/me/`.
* Google Sign-In: ID token перевіряється на backend (`google-auth`, audience = `GOOGLE_CLIENT_ID`); архітектура `SocialAccount` готова до Apple.

## Авторизація (DRF permissions + service layer)

* HelpRequest: редагувати/скасувати/завершити/обрати помічника — лише автор; інші — перегляд і відгук.
* Conversation/Message: лише учасники. Report на повідомлення — лише учасником розмови.
* Профіль: публічні поля всім автентифікованим, приватні — власнику. Немає відкритого списку користувачів.
* Blocking: заблоковані не бачать запити одне одного, не отримують сповіщень, не можуть писати чи взаємодіяти (перевірка в сервісах і запитах).

## Приватність локації

* Точні координати запиту бачать лише автор, обраний помічник і ті, хто відгукнувся. Іншим — центр клітинки сітки ~500 м і відстань, округлена до 100 м.
* Точна локація не є полем публічного профілю; у Django Admin поля локації приховані.
* Немає фонового GPS-трекінгу.

## Валідація вхідних даних

* Координати: діапазони lat/lng, sanity-check `accuracy`.
* Довжини полів (опис 1000, повідомлення 3000, відгук/подяка 500) — і в серіалізаторах, і в моделях.
* Файли: дозволені лише JPEG/PNG/WEBP; **реальний** тип визначається за вмістом (Pillow), не за розширенням; SVG/HTML/JS/EXE відхиляються; ліміт 10 MB (умова в presigned POST + перевірка), захист від decompression bomb; перекодування у WEBP з видаленням EXIF/GPS.

## Rate limiting та anti-abuse

DRF throttles (значення в settings/env), anti-spam для nearby-сповіщень у Redis, ідемпотентність критичних операцій, DB constraints.

## Заголовки та транспорт (production)

`SECURE_SSL_REDIRECT`, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, secure cookies, `X-Robots-Tag: noindex` для приватних маршрутів і API. SQL injection — лише ORM; XSS — React екранує вивід, без `dangerouslySetInnerHTML`.

## Логування

Structured JSON logs (`request_id`, `user_id`, `endpoint`, `status_code`, `duration`). Не логуються паролі, токени, push-секрети, тексти приватних повідомлень, точні координати. Чутливі ключі у `extra` маскуються.

## Swagger

`/api/docs/` і `/api/schema/` публічні лише при `API_DOCS_PUBLIC=true` (dev); у production — лише для staff.
