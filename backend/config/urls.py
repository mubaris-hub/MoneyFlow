from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('apps.users.urls')),
    path('api/v1/groups/', include('apps.groups.urls')),
    path('api/v1/expenses/', include('apps.expenses.urls')),
    path('api/v1/money-accounts/', include('apps.money_accounts.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
    path('api/v1/reports/', include('apps.reports.urls')),
]
