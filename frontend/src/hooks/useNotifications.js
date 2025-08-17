import { useEffect } from 'react';
import { useApp } from '../context/AppContext';

export const useNotifications = () => {
const { notifications, removeNotification } = useApp();

// Auto-remove notifications after timeout
useEffect(() => {
notifications.forEach(notification => {
if (notification.autoRemove !== false) {
const timeout = notification.timeout || 5000;
const timer = setTimeout(() => {
removeNotification(notification.id);
}, timeout);

return () => clearTimeout(timer);
}
});
}, [notifications, removeNotification]);

return {
notifications,
removeNotification
};
};