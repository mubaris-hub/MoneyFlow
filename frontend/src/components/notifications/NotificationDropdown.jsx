import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, BookOpen, Clock } from 'lucide-react';
import notificationService from '../../services/notification.service';
import { formatDate } from '../../utils/formatters';

export const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const data = await notificationService.listNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds for new notifications
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchNotifications();
    }
  };

  const handleMarkAsRead = async (id, e) => {
    e?.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setLoading(true);
      await notificationService.markAllAsRead();
      await fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all read:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      await handleMarkAsRead(notif.id);
    }
    setIsOpen(false);
    if (notif.money_account_id) {
      navigate(`/money-accounts/${notif.money_account_id}`);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={handleToggle}
        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg relative transition-colors"
        title="Notifications"
        aria-label="Notifications"
        type="button"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
        )}
      </button>

      {/* Notification Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3.5 px-4 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={loading}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 hover:underline disabled:opacity-50"
                type="button"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No notifications yet.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 ${
                    !notif.is_read ? 'bg-emerald-50/30' : ''
                  }`}
                >
                  <div className="mt-0.5">
                    <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                      <BookOpen className="w-4 h-4 text-emerald-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-semibold truncate ${!notif.is_read ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
                        {notif.title}
                      </p>
                      {!notif.is_read && (
                        <button
                          onClick={(e) => handleMarkAsRead(notif.id, e)}
                          title="Mark as read"
                          type="button"
                          className="text-slate-400 hover:text-emerald-600 p-0.5 rounded"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{notif.message}</p>
                    <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(notif.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
