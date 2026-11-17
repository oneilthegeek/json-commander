# Writing Gold Cards and LLH Tags

The website creates the digital page. Programming the physical chip is a separate, manual step, because a web browser can't write NFC tags reliably on every phone (iPhones can't at all from a browser).

## What goes on the chip
Only one thing: the card's link, for example `https://loveliveshere.ng/c/Xy3…` (shown on **Admin → order → Gold Card**). All the content lives on the website, so you can edit, schedule, lock or switch off a card without touching the chip.

## Supplies
- NTAG213 / NTAG215 / NTAG216 stickers or cards (NTAG213 is enough for a link).
- A phone with NFC: most Android phones, or iPhone XR and newer.
- The free **NFC Tools** app (Android & iOS).

## Steps
1. In the admin, open the card. Check the content and **Preview** it in each time of day.
2. Switch **Status** to *Live* (and set a secret word or end date if the buyer asked).
3. In NFC Tools: **Write → Add a record → URL/URI**, paste the link, tap **Write**, and hold the card flat against the back of the phone until it confirms.
4. **Test:** lock the phone screen, wake it, tap the card. The page should open. Test once on an iPhone and once on an Android if you can.
5. Optional: NFC Tools → Other → **Lock tag**. This is permanent and stops anyone overwriting the card. Only do it after testing.
6. Print the **QR code** (Download QR on the same admin page) on the insert card, for phones that can't tap.
7. Click **“I've written and tested the tag”** so the order shows the card is ready.

## Troubleshooting
| Problem | Fix |
|---|---|
| Phone doesn't react | NFC is off (Android settings), or the case is too thick. Try the top of an iPhone or the middle of an Android. |
| “Almost ready” page | The card isn't set to Live yet. |
| Opens the wrong page | Rewrite the tag (it isn't locked yet), or for a locked LLH Tag just change its link in the admin. |
| Metal surfaces | NFC doesn't work through metal. Use on-metal tags if a sticker goes on a metal object. |

## Physical testing still required
Everything from creating the content to viewing it has been tested in automated browser tests, including access codes, expiry, QR codes and the mobile layout. Writing and tapping real NFC hardware **hasn't** been tested and needs a person with a phone and blank tags.
