from django.contrib import admin
from .models import Category, Expense, ExpenseSplit, DirectPayment


class ExpenseSplitInline(admin.TabularInline):
    model = ExpenseSplit
    extra = 1


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'icon', 'is_system')
    search_fields = ('name',)


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('description', 'total_amount', 'paid_by', 'group', 'category', 'split_type', 'date', 'is_deleted')
    list_filter = ('split_type', 'is_deleted', 'category', 'date')
    search_fields = ('description', 'paid_by__email', 'group__name')
    inlines = [ExpenseSplitInline]


@admin.register(ExpenseSplit)
class ExpenseSplitAdmin(admin.ModelAdmin):
    list_display = ('expense', 'user', 'amount', 'percentage', 'shares')
    search_fields = ('expense__description', 'user__email')


@admin.register(DirectPayment)
class DirectPaymentAdmin(admin.ModelAdmin):
    list_display = ('sender', 'receiver', 'amount', 'group', 'date')
    list_filter = ('date',)
    search_fields = ('sender__email', 'receiver__email', 'group__name')
