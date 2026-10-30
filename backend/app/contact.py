"""'Contact Berk': a visitor leaves their email; it's kept (90 days) and Berk's phone hears at once."""

import asyncio
import logging

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from . import db
from .config import settings
from .events import Trace
from .limits import visitor
from .state import state

router = APIRouter()
log = logging.getLogger(__name__)


class ContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=200)
    message: str = Field(default="", max_length=1500)
    conversation_id: str | None = Field(default=None, max_length=64)


@router.post("/api/contact", status_code=201)
async def contact(request_body: ContactRequest, request: Request) -> dict[str, bool]:
    who = visitor(request)
    if not state.contact_limit.allow(who):
        raise HTTPException(429, "You've already sent a few: Berk will get back to you.")
    trace = Trace("contact")
    trace.stage("received", status="done")
    await asyncio.to_thread(_store, request_body)
    notified = await notify(request_body)
    trace.stage("done", status="done", notified=notified)
    return {"ok": True}


def _store(c: ContactRequest) -> None:
    with db.session() as s:
        s.add(db.Contact(conversation_id=c.conversation_id, name=c.name, email=c.email,
                         message=c.message))
        s.commit()


async def notify(c: ContactRequest) -> bool:
    if not settings.ntfy_url:
        return False
    body = f"{c.email}\n\n{c.message or '(no message)'}"
    headers = {"Title": f"turquoise: {c.name} wants to talk", "Tags": "briefcase",
               "Click": f"mailto:{c.email}"}
    try:
        response = await state.client.post(settings.ntfy_url, content=body.encode(),
                                           headers=headers, timeout=10)
        return response.status_code < 300
    except httpx.HTTPError as error:
        log.warning("ntfy: %s", error)
        return False
