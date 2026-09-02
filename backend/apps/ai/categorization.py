"""AI ticket categorization — AI-3 (Story 77), built on AI-0's
`apps.ai.client.generate_completion` (Story 74). Applied only from
`PortalTicketViewSet.perform_create` — see Story 77 `## Prerequisites`
for why staff-created and channel-adapter-created tickets are excluded.
"""

from apps.ai.client import generate_completion
from apps.tickets.models import Category, Ticket

MAX_TOKENS = 64

PRIORITY_PREFIX = "priority:"
CATEGORY_PREFIX = "category:"


def suggest_ticket_fields(ticket: Ticket) -> dict:
    """Classify `ticket.subject`/`ticket.description` into one of
    `Ticket.Priority`'s four values and one of the existing `Category`
    rows (or `None`). Returns `{"priority": <str>, "category": <Category
    | None>}`. Raises `apps.ai.exceptions.AIServiceError` on failure —
    unchanged contract; `apps.ai.tasks.categorize_ticket` decides what to
    do about it.
    """
    categories = list(Category.objects.all())
    category_names = ", ".join(category.name for category in categories) or "(none configured)"
    priority_values = ", ".join(Ticket.Priority.values)

    system = (
        "You triage incoming support tickets. Read the ticket below and "
        "respond with EXACTLY two lines and nothing else:\n"
        f"Priority: <one of: {priority_values}>\n"
        f"Category: <one of: {category_names}, or None if nothing fits well>"
    )
    user_prompt = f"Subject: {ticket.subject}\nDescription: {ticket.description}"
    response = generate_completion(user_prompt, system=system, max_tokens=MAX_TOKENS)

    return {
        "priority": _parse_priority(response),
        "category": _parse_category(response, categories),
    }


def _parse_priority(response: str) -> str:
    """Defaults to `Ticket.Priority.MEDIUM` — the model field's own
    default — for a missing line or a value outside the fixed four-value
    enum, rather than raising over a malformed model response.
    """
    for line in response.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith(PRIORITY_PREFIX):
            value = stripped[len(PRIORITY_PREFIX) :].strip().lower()
            if value in Ticket.Priority.values:
                return value
    return Ticket.Priority.MEDIUM


def _parse_category(response: str, categories: list[Category]) -> Category | None:
    """Matches the model's response against the REAL category list by
    exact, case-insensitive name — never constructs a new `Category`.
    Any unmatched or missing value (including the literal "None") falls
    back to `None`, the same "no confident match" outcome.
    """
    for line in response.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith(CATEGORY_PREFIX):
            value = stripped[len(CATEGORY_PREFIX) :].strip()
            for category in categories:
                if category.name.lower() == value.lower():
                    return category
            return None
    return None
