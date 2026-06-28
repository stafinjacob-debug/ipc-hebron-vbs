#!/usr/bin/env python3
"""Generate docs/teacher-setup-guide.pdf from structured content."""

from pathlib import Path

from fpdf import FPDF

OUT = Path(__file__).resolve().parent / "teacher-setup-guide.pdf"


class PDF(FPDF):
    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")


def h2(pdf: PDF, title: str) -> None:
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(15, 61, 122)
    pdf.cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(30, 111, 217)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(3)


def h3(pdf: PDF, title: str) -> None:
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(51, 51, 51)
    pdf.cell(0, 6, title, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)


def body(pdf: PDF, text: str) -> None:
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(34, 34, 34)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(pdf.epw, 5, text)
    pdf.ln(1)


def bullets(pdf: PDF, items: list[str]) -> None:
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(34, 34, 34)
    for item in items:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(pdf.epw, 5, f"  - {item}")
    pdf.ln(1)


def numbered(pdf: PDF, items: list[str]) -> None:
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(34, 34, 34)
    for i, item in enumerate(items, 1):
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(pdf.epw, 5, f"  {i}. {item}")
    pdf.ln(1)


def note(pdf: PDF, text: str) -> None:
    pdf.set_fill_color(255, 248, 230)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(0, 0, 0)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(pdf.epw, 5, text, fill=True)
    pdf.ln(3)


def main() -> None:
    pdf = PDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(15, 61, 122)
    pdf.cell(0, 10, "Anchor Check Ins - Teacher Setup Guide", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(85, 85, 85)
    pdf.cell(
        0,
        6,
        "Summer VBS | portal account + mobile app | read-only class roster",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(4)

    pdf.set_fill_color(240, 246, 255)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(15, 61, 122)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(pdf.epw, 6, "Quick links", fill=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(30, 111, 217)
    for line in [
        "Staff portal: https://events.ipchouston.com",
        "iPhone/iPad (TestFlight): https://testflight.apple.com/join/btws7xe4",
        "Android: https://play.google.com/apps/internaltest/4701595538991636552",
        "Use the same email and password everywhere. Scoped to Summer VBS.",
    ]:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(pdf.epw, 5, line, fill=True)
    pdf.ln(3)

    note(
        pdf,
        "Do this first: Complete Part 1 (portal invite) before installing the app. "
        "Then use Part 2 (iPhone/iPad) OR Part 3 (Android) - not both.",
    )

    h2(pdf, "Part 1 - Redeem your portal invite (everyone)")
    body(
        pdf,
        "An invitation email has been sent to your church email address. "
        "Activate your account once before signing in on the website or in the app.",
    )
    numbered(
        pdf,
        [
            "Open the email: IPC Hebron VBS - You're invited to the VBS staff portal (check spam/junk).",
            "Tap Accept invitation. If the button fails, copy the full link into your browser.",
            "Create a password (at least 8 characters) and confirm it.",
            "Tap Activate account.",
            "Tap Go to sign in, or visit https://events.ipchouston.com.",
            "Sign in with your email and the password you just created.",
        ],
    )
    body(pdf, "Already activated? Skip to Part 2 or 3.")
    bullets(
        pdf,
        [
            "Link expired? Invites expire after 7 days. Ask your VBS coordinator to resend.",
            "Forgot password? Reset it at https://events.ipchouston.com",
        ],
    )

    pdf.add_page()
    h2(pdf, "Part 2 - iPhone / iPad (TestFlight)")
    note(pdf, "Use an iPhone or iPad. Android users: skip to Part 3.")
    h3(pdf, "Install (one time)")
    numbered(
        pdf,
        [
            "Install TestFlight from the App Store (free, by Apple).",
            "Open in Safari: https://testflight.apple.com/join/btws7xe4",
            "Tap Accept, then Install for Anchor Check Ins.",
            "Open the app from your home screen.",
        ],
    )
    h3(pdf, "Sign in and use the app")
    numbered(
        pdf,
        [
            "Sign in with the same email and password from Part 1.",
            "If asked, choose Summer VBS.",
            "My class = roster; Home = today's counts; News; More = profile/sign out.",
        ],
    )
    body(pdf, "Teachers cannot check students in, scan QR codes, or print badges.")
    bullets(
        pdf,
        [
            "Tap a student on My class for details (allergies, guardian contact).",
            "Multi-day VBS: use day chips at the top.",
            "Updates: TestFlight -> Anchor Check Ins -> Update.",
        ],
    )

    pdf.add_page()
    h2(pdf, "Part 3 - Android phone (Google Play internal test)")
    note(
        pdf,
        "Use an Android phone with the Gmail your admin added as a tester. iPhone/iPad: use Part 2.",
    )
    h3(pdf, "Install (one time)")
    numbered(
        pdf,
        [
            "Open in Chrome: https://play.google.com/apps/internaltest/4701595538991636552",
            "Sign in with your tester Gmail if prompted.",
            "Tap Become a tester, then Install.",
            "Open Anchor Check Ins from your app list.",
        ],
    )
    h3(pdf, "Sign in and use the app")
    numbered(
        pdf,
        [
            "Sign in with the same email and password from Part 1.",
            "If asked, choose Summer VBS.",
            "My class = roster; Home = today's counts; News; More = profile/sign out.",
        ],
    )
    body(pdf, "Teachers cannot check students in, scan QR codes, or print badges.")
    bullets(
        pdf,
        [
            "Tap a student on My class for details.",
            "Multi-day VBS: use day chips at the top.",
            "Not a tester? Ask coordinator to add your Gmail to the Play test list.",
            "Updates: Play Store -> Anchor Check Ins -> Update.",
        ],
    )

    h2(pdf, "Help")
    bullets(
        pdf,
        [
            "Wrong or empty class? Coordinator must assign you as class leader.",
            "Can't sign in? Complete Part 1 or reset password on the website.",
            "No program assigned? Contact your VBS coordinator.",
        ],
    )

    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(100, 100, 100)
    pdf.ln(4)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(
        pdf.epw,
        4,
        "Questions? Contact your VBS coordinator.\n"
        "Portal: https://events.ipchouston.com\n"
        "iOS: https://testflight.apple.com/join/btws7xe4\n"
        "Android: https://play.google.com/apps/internaltest/4701595538991636552",
    )

    pdf.output(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
