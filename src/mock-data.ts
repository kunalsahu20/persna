import type { Character, Message } from './types'
import { parseMessageContent } from './lib/parse-message'
import { generateId } from './lib/uuid'

/* ─── Character Registry ─── */

export const OLIVIA: Character = {
  id: 'olivia',
  name: 'Olivia',
  avatar: '🖤',
  tagline: 'College student · Cafeteria',
  openingMessage: `*A group of girls approach me at my usual corner table in the cafeteria. Becky struts over laughing with her friends trailing behind.*

"Hey Olivia. You really are such a pig, you know that?"

*I immediately lower my eyes and try to slide my tray behind my bag, as if making the food disappear would make them leave faster.*

"Wow, you really have no shame trying to hide the food. Trust me, I wouldn't want anything on that tray. Knowing you took it, I wouldn't want to gain 100 lbs."

*The girls behind Becky laugh. One of them whispers something and they laugh harder.*

~Just leave. Please just leave. Don't look at them. Don't give them anything.~

*I say nothing. My fingers tighten around the edge of the tray until my knuckles go white. I keep my eyes fixed on the scratched surface of the table, jaw clenched, waiting. Hoping they will get bored. Hoping they will just leave me alone.*

*My hoodie is pulled up around my neck. My hair falls forward like a curtain. I'm trying to disappear into myself.*`,
}

export const CAMILLE: Character = {
  id: 'camille',
  name: 'Camille',
  avatar: '🔥',
  tagline: "Your father's ex · Beach house",
  openingMessage: `*You come downstairs and stop just short of the living room. Inside, Camille is curled up on the couch between her two longtime friends — Roxanne, stretched out with loose ease, and Simone, composed with her legs crossed. Jessa, the neighbor, perches on the armrest. None of them have noticed you.*

*They're arguing about sleeping arrangements — two bedrooms, one pull-out sofa, five people. Someone has to share, and Roxanne has just asked the obvious question: with who?*

"Funny how Camille went quiet the second he came up." *Roxanne leans forward, eyebrow raised.* "Suspiciously funny."

"I didn't go quiet. There's nothing to— it's not—"

"Then why is your face red?"

*Simone uncrosses her legs.* "Drop it. She clearly doesn't want to say."

*But the teasing has momentum now, and Camille folds, her voice dropping low.*

"A few days ago I accidentally walked in on him. I left right away, I swear. But... he's huge. Okay? I have not been normal about it since."

*Jessa makes a sound like a kettle boiling. Roxanne raises her glass in respect. Simone closes her eyes like she's praying for patience.*

"Carrying that alone for days. That's not a secret, that's a community resource."

*Roxanne's eyes drift past Camille's shoulder — and stop. Her grin dies mid-spread.*

"Camille. Don't turn around."

*Camille turns around.*

*All four women freeze. You're standing in the doorway, close enough that there's no telling how much you caught. For one long second, nobody breathes.*

*Then they do the most unnatural thing possible: they act like nothing happened.*

"Oh! Hey!" *Jessa nearly falls off the armrest.* "We were just— sleeping arrangements! Very boring, you didn't miss anything."

"Nothing. At all." *Simone's expression is perfectly neutral. Too perfectly.*

*Roxanne takes a long, careful sip of wine. Camille just stares at her glass, face burning, refusing to look up.*

*The silence sits there, thick and obvious, while four women try to read your face, each of them silently calculating how much you caught, and hoping to God it was nothing.*

~Nobody is going to forget it. Not for the next two weeks.~`,
}

export const DAPHNE: Character = {
  id: 'daphne',
  name: 'Daphne',
  avatar: '🌊',
  tagline: "Bride's aunt · Beachfront villa",
  openingMessage: `*The bathroom door opens and she walks out in nothing but a towel. Steam follows her out. One hand is pressing the towel against her chest. The other is pushing wet hair off her face. Water is still running down her neck, her shoulders, her bare legs. She takes two steps toward the bed.*

*Then she sees you.*

"Oh my God. What the fuck?!"

*She goes dead still. Her grip on the towel tightens hard — it barely covers anything. Her eyes go from your face to the bed, where her dress is laid out next to a pair of black lace underwear she clearly wasn't expecting anyone to see. Her whole body goes tense.*

"Don't you fucking move. You were in here the whole time I was in the shower?"

~The way he's looking at me. Don't look at me like that. I'm basically naked.~

*Her voice drops low. She's furious — but she's also very aware that she's dripping wet in a towel and he is right there.*

"I don't care how you got a key. I don't care whose mistake it was. You have ten seconds to get out of this room before I start screaming, and trust me — the whole resort will hear it."`,
}

export const RIPLEY: Character = {
  id: 'ripley',
  name: 'Ripley',
  avatar: '🖤',
  tagline: 'Roommate · Caught you',
  openingMessage: `*Ripley doesn't say anything when you step into the hallway.*

*She just holds up a pair of black lace panties between two fingers.*

*Hers.*

*Her green eyes stay locked on you.*

"Want to explain why I found these buried in your laundry?"

*Then she turns them slightly.*

*The stain is impossible to miss.*

*Her expression changes.*

"Wait."

*She looks at the panties.*

*Then at you.*

"You fucking didn't."

*A beat.*

"Tell me you did not jerk off on my panties."`,
}

/* ─── Registry ─── */

/** All available characters. Add new characters here. */
export const CHARACTER_REGISTRY: Character[] = [OLIVIA, CAMILLE, DAPHNE, RIPLEY]

/** Find a character by ID, fallback to first */
export function getCharacter(id: string): Character {
  return CHARACTER_REGISTRY.find((c) => c.id === id) ?? CHARACTER_REGISTRY[0]
}

/* ─── Helper: create opening message for any character ─── */

export function createOpeningMessage(character: Character): Message {
  const raw = character.openingMessage ?? `*${character.name} is here.*`
  return {
    id: generateId(),
    role: 'character',
    timestamp: Date.now(),
    rawContent: raw,
    segments: parseMessageContent(raw),
  }
}

/* ─── Backwards compatibility ─── */
export const SAM = OLIVIA
export const DEFAULT_OPENING_RAW = OLIVIA.openingMessage!
export const DEFAULT_OPENING_MESSAGE: Message = {
  id: 'default-opening-message',
  role: 'character',
  timestamp: Date.now(),
  rawContent: DEFAULT_OPENING_RAW,
  segments: parseMessageContent(DEFAULT_OPENING_RAW),
}
export function createDefaultMessage(): Message {
  return createOpeningMessage(OLIVIA)
}
