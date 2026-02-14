# RevioMP Email Templates for Supabase

## Инструкция по настройке

### 1. URL Configuration (КРИТИЧНО!)

Перейти в Supabase Dashboard -> Authentication -> URL Configuration:

| Параметр | Значение |
|----------|----------|
| **Site URL** | `https://reviomp.ru` |
| **Redirect URLs** | `https://reviomp.ru/**` |
| | `http://localhost:5173/**` |

### 2. Email Templates

Перейти в Supabase Dashboard -> Authentication -> Email Templates:

| Шаблон в Supabase | Какой шаблон вставить | Subject |
|---|---|---|
| **Confirm signup** | Template 1 (ниже) | `Подтвердите регистрацию в RevioMP` |
| **Reset password** | Template 2 (ниже) | `Сброс пароля RevioMP` |

### 3. Порядок действий

1. Открыть Supabase Dashboard -> Authentication -> URL Configuration
2. Установить Site URL = `https://reviomp.ru`
3. Добавить Redirect URLs: `https://reviomp.ru/**` и `http://localhost:5173/**`
4. Перейти в Authentication -> Email Templates
5. Выбрать "Confirm signup" -> вставить Subject и HTML из Template 1
6. Выбрать "Reset password" -> вставить Subject и HTML из Template 2
7. Сохранить

---

## Brand

| Параметр | Значение |
|----------|----------|
| Name | RevioMP |
| Primary | `#4F46E5` (indigo-600) |
| Secondary | `#4338CA` (indigo-700) |
| Background | `#F9FAFB` (gray-50) |
| Text | `#111827` (gray-900) |
| Font | Inter, system-ui, sans-serif |
| URL | https://reviomp.ru |

---

## Template 1: Confirm Signup (Подтверждение регистрации)

**Subject:** `Подтвердите регистрацию в RevioMP`

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Подтвердите регистрацию в RevioMP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F9FAFB; font-family: Inter, system-ui, -apple-system, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="520" style="max-width: 520px; width: 100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #4F46E5; border-radius: 12px; padding: 10px 20px;">
                    <span style="font-family: Inter, system-ui, sans-serif; font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">RevioMP</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color: #FFFFFF; border-radius: 16px; padding: 48px 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">

                <!-- Heading -->
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <h1 style="margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3;">
                      Добро пожаловать в RevioMP!
                    </h1>
                  </td>
                </tr>

                <!-- Body text -->
                <tr>
                  <td align="center" style="padding-bottom: 8px;">
                    <p style="margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 15px; color: #4B5563; line-height: 1.6;">
                      Спасибо за регистрацию! RevioMP — это платформа аналитики для продавцов на Wildberries и Ozon. Отслеживайте продажи, прибыль и расходы в одном дашборде.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <p style="margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 15px; color: #4B5563; line-height: 1.6;">
                      Подтвердите ваш email, чтобы начать работу:
                    </p>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: #4F46E5; border-radius: 10px;">
                          <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 36px; font-family: Inter, system-ui, sans-serif; font-size: 15px; font-weight: 600; color: #FFFFFF; text-decoration: none; letter-spacing: 0.01em;">
                            Подтвердить email
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding-bottom: 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="border-top: 1px solid #E5E7EB;"></td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Bonus text -->
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: #EEF2FF; border-radius: 8px; padding: 12px 20px;">
                          <p style="margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 13px; color: #4338CA; line-height: 1.5; font-weight: 500;">
                            &#127873; После подтверждения вы получите бесплатный доступ к аналитике на 14 дней
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Fallback link -->
                <tr>
                  <td align="center">
                    <p style="margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 12px; color: #9CA3AF; line-height: 1.5;">
                      Если кнопка не работает, скопируйте ссылку в браузер:<br>
                      <a href="{{ .ConfirmationURL }}" style="color: #4F46E5; word-break: break-all;">{{ .ConfirmationURL }}</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px; padding-bottom: 16px;">
              <p style="margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 13px; color: #9CA3AF; line-height: 1.5;">
                RevioMP — Аналитика маркетплейсов WB и Ozon
              </p>
            </td>
          </tr>

          <tr>
            <td align="center">
              <p style="margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 12px; color: #D1D5DB; line-height: 1.5;">
                <a href="https://reviomp.ru" style="color: #9CA3AF; text-decoration: none;">reviomp.ru</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Template 2: Reset Password (Сброс пароля)

**Subject:** `Сброс пароля RevioMP`

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Сброс пароля RevioMP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F9FAFB; font-family: Inter, system-ui, -apple-system, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="520" style="max-width: 520px; width: 100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #4F46E5; border-radius: 12px; padding: 10px 20px;">
                    <span style="font-family: Inter, system-ui, sans-serif; font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">RevioMP</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color: #FFFFFF; border-radius: 16px; padding: 48px 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">

                <!-- Icon -->
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: #FEF3C7; border-radius: 50%; width: 56px; height: 56px; text-align: center; vertical-align: middle; font-size: 24px;">
                          &#128274;
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Heading -->
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <h1 style="margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3;">
                      Сброс пароля
                    </h1>
                  </td>
                </tr>

                <!-- Body text -->
                <tr>
                  <td align="center" style="padding-bottom: 8px;">
                    <p style="margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 15px; color: #4B5563; line-height: 1.6;">
                      Вы запросили сброс пароля для вашего аккаунта RevioMP.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <p style="margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 15px; color: #4B5563; line-height: 1.6;">
                      Нажмите кнопку ниже, чтобы установить новый пароль:
                    </p>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: #4F46E5; border-radius: 10px;">
                          <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 36px; font-family: Inter, system-ui, sans-serif; font-size: 15px; font-weight: 600; color: #FFFFFF; text-decoration: none; letter-spacing: 0.01em;">
                            Сбросить пароль
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Expiry notice -->
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: #FFF7ED; border-radius: 8px; padding: 12px 20px;">
                          <p style="margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 13px; color: #92400E; line-height: 1.5;">
                            &#9200; Ссылка действительна в течение 24 часов
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding-bottom: 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="border-top: 1px solid #E5E7EB;"></td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Safety notice -->
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <p style="margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 13px; color: #6B7280; line-height: 1.6;">
                      Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо. Ваш пароль останется прежним.
                    </p>
                  </td>
                </tr>

                <!-- Fallback link -->
                <tr>
                  <td align="center">
                    <p style="margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 12px; color: #9CA3AF; line-height: 1.5;">
                      Если кнопка не работает, скопируйте ссылку в браузер:<br>
                      <a href="{{ .ConfirmationURL }}" style="color: #4F46E5; word-break: break-all;">{{ .ConfirmationURL }}</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px; padding-bottom: 16px;">
              <p style="margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 13px; color: #9CA3AF; line-height: 1.5;">
                RevioMP — Аналитика маркетплейсов WB и Ozon
              </p>
            </td>
          </tr>

          <tr>
            <td align="center">
              <p style="margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 12px; color: #D1D5DB; line-height: 1.5;">
                <a href="https://reviomp.ru" style="color: #9CA3AF; text-decoration: none;">reviomp.ru</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Template 3: Account Deletion (Удаление аккаунта)

> Этот шаблон НЕ для Supabase Dashboard. Используется как справочная информация.
> Текст отправляется программно или показывается в UI как toast/confirmation.

**Текст уведомления:**

> Ваш аккаунт RevioMP был удален. Все данные (продажи, расходы, токены API, настройки подписки) удалены безвозвратно. Если вы захотите вернуться, вам потребуется зарегистрироваться заново.

**Toast в интерфейсе:**

> Аккаунт удален

---

## Checklist

- [ ] Site URL = `https://reviomp.ru` (Authentication -> URL Configuration)
- [ ] Redirect URL: `https://reviomp.ru/**`
- [ ] Redirect URL: `http://localhost:5173/**`
- [ ] Confirm signup template: Subject + HTML вставлены
- [ ] Reset password template: Subject + HTML вставлены
- [ ] Протестировать регистрацию (получить письмо, нажать кнопку)
- [ ] Протестировать сброс пароля (получить письмо, нажать кнопку)
