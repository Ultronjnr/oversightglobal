# Smooth Dashboard Carousel Update

## Goal
Make the dashboard carousel move as complete, self-contained pages and use the uploaded city image for the second page.

## Changes
- Convert the carousel to a sliding track so entire page layouts move together, without content from adjacent pages leaking or shifting.
- Keep each page at a stable responsive height and preserve its own background, text, cards, and buttons.
- Use the supplied city image as the second page background.
- Preserve live advertisement pages; each published, active, targeted advert remains its own full-background carousel page.
- Keep automatic six-second rotation, looping, arrows, pagination, and pause/resume behavior.
- Respect reduced-motion preferences and keep controls accessible.

## Verification
- Check desktop and mobile layouts for clipping, overflow, and readable controls.
- Confirm next/previous, pagination, looping, and automatic rotation.
- Confirm the second page uses the uploaded image and advert pages remain conditional.
- Check browser errors and ensure existing dashboard actions remain unchanged.

## Technical details
- Store the uploaded image through the project asset flow and import its URL.
- Render all carousel pages in one translated flex track with CSS transitions.
- Avoid additional data requests when slides change; reuse the existing dashboard and advert data.
