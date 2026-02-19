import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, html: str) -> bool:
    """Send an email via Resend API. Returns True on success, False on failure."""
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping email to %s", to)
        return False

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={
                    "from": settings.RESEND_FROM_EMAIL,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                },
            )
            if resp.status_code >= 400:
                logger.error("Resend API error %s: %s", resp.status_code, resp.text)
                return False
            return True
    except Exception:
        logger.exception("Failed to send email to %s", to)
        return False


async def send_invite_email(to: str, org_name: str, role: str, token: str) -> bool:
    accept_url = f"{settings.FRONTEND_URL}/invite/{token}"
    html = f"""\
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:40px;color:#e0e0e0;">
  <h1 style="font-size:1.4rem;font-weight:300;margin:0 0 8px;">
    plan<span style="font-weight:600;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">trip</span>
  </h1>
  <h2 style="color:#fff;font-size:1.1rem;margin:0 0 20px;">You've been invited!</h2>
  <p style="color:#aaa;line-height:1.6;margin:0 0 24px;">
    You've been invited to join <strong style="color:#fff;">{org_name}</strong> as a <strong style="color:#fff;">{role}</strong>.
  </p>
  <a href="{accept_url}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;border-radius:12px;font-weight:500;">
    Accept Invite
  </a>
  <p style="color:#666;font-size:0.8rem;margin:24px 0 0;">If you didn't expect this invite, you can ignore this email.</p>
</div>"""
    return await send_email(to, f"You're invited to {org_name} on PlanTrip", html)


async def send_welcome_email(to: str) -> bool:
    html = """\
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:40px;color:#e0e0e0;">
  <h1 style="font-size:1.4rem;font-weight:300;margin:0 0 8px;">
    plan<span style="font-weight:600;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">trip</span>
  </h1>
  <h2 style="color:#fff;font-size:1.1rem;margin:0 0 20px;">Welcome aboard!</h2>
  <p style="color:#aaa;line-height:1.6;margin:0 0 16px;">
    Your PlanTrip account is ready. Start planning your next adventure — add stops, activities, and share your itinerary with friends.
  </p>
  <p style="color:#666;font-size:0.8rem;margin:24px 0 0;">Happy travels!</p>
</div>"""
    return await send_email(to, "Welcome to PlanTrip!", html)


async def send_password_reset_email(to: str, token: str) -> bool:
    reset_url = f"{settings.FRONTEND_URL}/reset-password/{token}"
    html = f"""\
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:40px;color:#e0e0e0;">
  <h1 style="font-size:1.4rem;font-weight:300;margin:0 0 8px;">
    plan<span style="font-weight:600;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">trip</span>
  </h1>
  <h2 style="color:#fff;font-size:1.1rem;margin:0 0 20px;">Reset your password</h2>
  <p style="color:#aaa;line-height:1.6;margin:0 0 24px;">
    We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.
  </p>
  <a href="{reset_url}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;border-radius:12px;font-weight:500;">
    Reset Password
  </a>
  <p style="color:#666;font-size:0.8rem;margin:24px 0 0;">If you didn't request this, you can safely ignore this email.</p>
</div>"""
    return await send_email(to, "Reset your PlanTrip password", html)


async def send_email_verification(to: str, token: str) -> bool:
    verify_url = f"{settings.FRONTEND_URL}/verify-email/{token}"
    html = f"""\
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:40px;color:#e0e0e0;">
  <h1 style="font-size:1.4rem;font-weight:300;margin:0 0 8px;">
    plan<span style="font-weight:600;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">trip</span>
  </h1>
  <h2 style="color:#fff;font-size:1.1rem;margin:0 0 20px;">Verify your email</h2>
  <p style="color:#aaa;line-height:1.6;margin:0 0 24px;">
    Please verify your email address by clicking the button below.
  </p>
  <a href="{verify_url}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;border-radius:12px;font-weight:500;">
    Verify Email
  </a>
  <p style="color:#666;font-size:0.8rem;margin:24px 0 0;">If you didn't create a PlanTrip account, you can ignore this email.</p>
</div>"""
    return await send_email(to, "Verify your PlanTrip email", html)
