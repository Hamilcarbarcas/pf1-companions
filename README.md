# PF1 Companions

Familiars and animal companions for Pathfinder 1e, linked to their master and advanced from the master's level.

**Manifest URL:** `https://github.com/Hamilcarbarcas/pf1-companions/releases/latest/download/module.json`

## Requirements
- Foundry VTT v13
- PF1e system v11.10
- astora-mod, PF1 Enhanced Links

## Contents

- [Granting a companion](#granting-a-companion)
- [Choosing the companion](#choosing-the-companion)
- [Companion classes](#companion-classes)
- [Familiars](#familiars)
- [The Companions list](#the-companions-list)
- [Formulas](#formulas)
- [Compendiums](#compendiums)

## Granting a companion

Any feature can grant a companion. Open the feature, go to its **Advanced** tab, and fill in the
**Companion Grant** section:

- **Grants**: Animal Companion or Familiar.
- **Effective Level**: a formula in the master's roll data, such as `@classes.druid.level` or
  `@classes.ranger.level - 3`. When several features grant the same companion, their levels add up.

## Choosing the companion

Once the feature is on a character, the section shows a **Companion** row. Click **Choose** and
pick an actor you own, or drag an actor from the sidebar onto the row. **Clear** releases it.

The picker searches by name and filters by actor type and folder. **Hide unavailable** hides actors
that already belong to another master.

Choosing links the actor's token, matches the master's disposition, and, when a GM chooses, gives
the master's players the same ownership of the companion.

A companion can't have companions of its own, and an actor can only be one master's companion.

## Companion classes

Choosing a companion also gives it the grant's **companion class**, if it doesn't have one: the
**Animal Companion** class from the Companion Features compendium, unless you drop a different
class onto the grant's **Companion Class** row. If the actor has racial Hit Dice or another
companion class, you're asked whether to remove them, since the companion class provides its Hit
Dice.

The class's level always equals the master's effective level. Hit Dice, base attack bonus, saves,
skill ranks, and feats follow the animal companion table, and its hit points are set to the
average for its Hit Dice. Its features (Link, Share Spells, Evasion, and so on) are added and
removed as the level changes. They appear in their own **Companion Features** section of the
Features tab, which only shows on actors that have one.

A paladin's mount uses the **Bonded Mount** class instead: the same progression, plus an
Intelligence of at least 6, the celestial template at 11th level, and spell resistance equal to the
paladin's level + 11 at 15th.

## Familiars

A familiar gets the **Familiar** class, whose level is the master's level. The familiar counts as
having that many Hit Dice, and takes from its master:

- half the master's maximum hit points;
- the master's base attack bonus, with Strength or Dexterity (whichever is higher) for natural
  attacks;
- for each save, the better of its own base save (Fortitude +2, Reflex +2, Will +0) or the master's;
- for each skill, the better of its own ranks or the master's.

Its Intelligence, natural armor, and abilities follow the familiar table, and it counts as a magical
beast. A paladin's bonded mount becomes a magical beast at 11th level the same way.

The master gets two features while the familiar is linked:

- **Familiar Bonus**, the bonus the familiar's species grants (such as +3 Stealth for a cat). Use it
  to mark the familiar **away** (more than a mile off), which switches the bonus off; use it again to
  bring it back. The eye button in the Companions list does the same.
- **Alertness (Familiar)**, on while the familiar's token is next to the master's.

Both are managed for you: they can't be deleted while the familiar is linked.

## The Companions list

Characters with a granting feature get a **Companions** list at the top of their **Features** tab:
the companion, the feature that grants it, its effective level, and its hit points. Click the
companion to open its sheet, the crosshairs to find its token, the eye to mark a familiar away or
present, or the broken link to release it.

A companion's **Summary** tab names its master.

## Formulas

| Formula | On | Value |
| --- | --- | --- |
| `@master.<path>` | a companion | anything from the master's roll data, e.g. `@master.attributes.hp.max` |
| `@companion.level` | a companion | its effective level |
| `@companions.animalCompanion.level` | a master | effective level of its animal companion grants |
| `@companions.familiar.level` | a master | effective level of its familiar grants |

A companion's values update whenever its master changes.

## Compendiums

- **Companions & Familiars**: species races for animal companions and familiars, with their attacks
  and advancement. To make a companion, create an NPC, drop a companion class and a species race on
  it, then choose it on the master's feature. The attacks are astora-mod's natural attacks; a species
  whose attack hits harder or softer, or comes in a different number, also gets astora-mod's matching
  modifier (Strong Attack (Bite), Extra Attack (Slam), and so on).
- **Companion Features**: the companion classes and their abilities.
