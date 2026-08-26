import { useEffect, useState } from 'react';
import { apiRequest } from './api';
import type { NotificationItem } from './types';
import { useTranslation } from './i18n/I18nContext';

export default function NotificationsList({ token }: { token: string }) {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const list = await apiRequest<NotificationItem[]>('GET', '/notifications', { token });
        if (!cancelled) setNotifications(list);
      } catch {
        // silent — don't block the UI over a notifications hiccup
      }
    }
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <strong>{t('notifications.title', { count: notifications.length })}</strong>
        <button className="secondary" type="button">
          {open ? t('notifications.hide') : t('notifications.show')}
        </button>
      </div>
      {open && (
        notifications.length === 0 ? (
          <p className="muted">{t('notifications.none')}</p>
        ) : (
          <ul className="item-list">
            {notifications.map((n) => (
              <li key={n.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <strong>{n.title}</strong>
                <span className="muted">{n.body}</span>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
