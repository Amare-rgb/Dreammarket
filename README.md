# Dreammarket

## Article publishing and Telegram announcements

Published articles are available on the public `/articles` pages. When an
article is first published, the server also sends its title, description, and
public article link to the configured Telegram channel or group. Admins can
retry or manually send an announcement from the Articles page.

Configure these variables in the server environment:

```env
TELEGRAM_BOT_TOKEN=<rotated Telegram bot token>
TELEGRAM_CHAT_ID=<channel username such as @DreamMarketNews or numeric chat ID>
NEXT_PUBLIC_SITE_URL=https://your-public-site.example
```

Add the bot to the destination channel or group and grant it permission to send
messages. Keep the bot token server-side and out of source control. If
`NEXT_PUBLIC_SITE_URL` is unset, the server uses `FRONTEND_URL` or `CLIENT_URL`;
local development defaults to `http://localhost:3000`.