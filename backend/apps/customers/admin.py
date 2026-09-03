from django.contrib import admin

from .models import Attachment, ContactDetail, Customer, Note


class ContactDetailInline(admin.TabularInline):
    model = ContactDetail
    extra = 0
    fields = ("channel", "value", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "phone", "company", "branch", "user", "created_at")
    list_filter = ("branch",)
    search_fields = ("name", "email", "company")
    readonly_fields = ("created_at", "updated_at")
    inlines = (ContactDetailInline,)


@admin.register(ContactDetail)
class ContactDetailAdmin(admin.ModelAdmin):
    list_display = ("customer", "channel", "value", "created_at")
    list_filter = ("channel",)
    search_fields = ("value", "customer__name", "customer__email")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ("customer", "author", "created_at")
    search_fields = ("body", "customer__name")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ("original_filename", "customer", "uploaded_by", "size", "created_at")
    search_fields = ("original_filename", "customer__name")
    readonly_fields = ("created_at", "updated_at", "size")
