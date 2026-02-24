# Media Assets

Store curated visual assets here (or in another static host) and map them in `public/data/media-index.json`.

## Suggested structure

- `public/media/people/`
- `public/media/events/`
- `public/media/places/`
- `public/media/sources/`

## Example `media-index.json` row

```json
{
  "people": {
    "person-lady-hyegyong": {
      "src": "/media/people/lady-hyegyong-portrait.jpg",
      "alt": "Portrait of Lady Hyegyong",
      "caption": "Late Joseon court portrait (reference image)",
      "credit": "Collection / rights holder",
      "focalPoint": "50% 20%"
    }
  }
}
```
