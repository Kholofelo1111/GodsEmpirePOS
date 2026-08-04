# God's Empire POS – Receipt PDF Fix

I need you to FIX my receipt PDF generation.

Current problem:
- The on-screen receipt (React component in src/app/pos/page.tsx) is PERFECT.
- The "Print / Save PDF" button must generate THAT EXACT RECEIPT.
- Instead it currently downloads JSON or placeholder data.

Requirements:
1. Use the existing receipt UI as the single source of truth.
2. Do NOT build another receipt layout.
3. Generate a PDF that is visually identical to the receipt shown after checkout.
4. Keep Barcode and QR code.
5. Preserve logo, totals, payment breakdown, outstanding balance, footer, spacing and fonts.
6. Remove any placeholder receipt API.
7. Do not return JSON.
8. Do not create duplicate receipt templates.
9. Fix the implementation properly.

Project stack:
- Next.js 16
- React
- Capacitor
- jsPDF
- Drizzle ORM
- PostgreSQL

Please return:
- Every modified file.
- Full code.
- Explain why the old implementation failed.
