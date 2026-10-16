// Хеширование и проверка пароля (FR-4, NFR-1).
//
// Единственное место в приложении, где код обращается к `bcryptjs`: ровно 12
// раундов стоимости при хешировании (`hash`) и строгая проверка через `compare`.
// Отдельная соль не хранится — она закодирована внутри bcrypt-хеша; открытый
// пароль не логируется и наружу не возвращается, модуль отдаёт только результат.
//
// Модуль серверный: помечен `import "server-only"` (NFR-6) — импорт из
// клиентского компонента останавливает сборку Next.js, а вне сборки (`tsx`:
// seed, скрипты, `npm test`) спецификатор разрешается пустым модулем
// `app/lib/server-only-shim.ts` через `paths` в `tsconfig.json`.

import "server-only";

import bcrypt from "bcryptjs";

/** Стоимость bcrypt: фиксированные 12 раундов (FR-4, NFR-1, CR-2). */
const BCRYPT_ROUNDS = 12;

/**
 * Хеширует пароль. В базу данных попадает только результат этой функции:
 * `User.passwordHash` (FR-4, NFR-1).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Проверяет пароль против сохранённого хеша. Проверка выполняется строго через
 * `bcryptjs.compare`, а не сравнением хешей (FR-4, NFR-1).
 */
export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
