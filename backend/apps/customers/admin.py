from django.contrib import admin

from .models import ContactDetail, Customer


class ContactDetailInline(admin.TabularInline):
    model = ContactDetail
    extra = 0
    fields = ("channel", "value", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "phone", "company", "created_at")
    search_fields = ("name", "email", "company")
    readonly_fields = ("created_at", "updated_at")
    inlines = (ContactDetailInline,)


@admin.register(ContactDetail)
class ContactDetailAdmin(admin.ModelAdmin):
    list_display = ("customer", "channel", "value", "created_at")
    list_filter = ("channel",)
    search_fields = ("value", "customer__name", "customer__email")
    readonly_fields = ("created_at", "updated_at")
