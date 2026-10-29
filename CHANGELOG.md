# Changelog

All notable changes to this module are documented here. Release notes are taken from the section
matching each release tag.

## [Unreleased]

### Added
- **Companions & Familiars** (species races) and **Companion Features** (classes and abilities)
  compendiums, in a "PF1 Companions" compendium folder.
- **Companion Grant** section on a feature's Advanced tab: what the feature grants and its
  effective-level formula.
- Choosing a companion on a granting feature, from a picker (search by name, filter by type and
  folder, hide unavailable actors) or by dropping an actor. Choosing links
  the companion's token, matches the master's disposition, and (for a GM) copies the master's
  ownership.
- **Companions** list on a master's Features tab, and a "Companion of" line on a companion's
  Summary tab.
- `@master`, `@companion.level`, and `@companions.<kind>.level` formula data. Companions update when
  their master changes.
- **Animal Companion** class and its features (Link, Share Spells, Natural Armor Bonus, Str/Dex
  Bonus, Bonus Tricks, Evasion, Devotion, Multiattack, Improved Evasion) in Companion Features.
- Choosing a companion adds its companion class (default or the grant's own), offering to remove
  racial Hit Dice and other companion classes. The class's level follows the master's effective
  level, with average hit points.
- **Companion Features** section on the Features tab, shown only on actors that have one.
- **Familiar** class and features: Hit Dice equal to the master's level; half the master's hit
  points, the master's base attack bonus, and the better of its own or the master's saves and skill
  ranks; Intelligence and natural armor by level; Improved Evasion, Share Spells, Empathic Link,
  Deliver Touch Spells, Speak with Master, Speak with Animals of Its Kind, Spell Resistance, Scry on
  Familiar.
- **Magical Beast** feature: familiars (and bonded mounts from 11th level) count as magical beasts.
- **Familiar Bonus** and **Alertness (Familiar)** on the master while a familiar is linked; mark the
  familiar away or present from Familiar Bonus or the Companions list.
- **Companions & Familiars** filled: 187 animal companion and 99 familiar species, each a race with its
  size, speeds, ability scores, natural armor, senses, and natural attacks; animal companions advance at
  their listed level, and familiars carry the bonus their master gains.
- Species attacks are astora-mod's natural attacks. A species whose attack deals more or less damage than
  standard, or has more or fewer of it, carries one of astora-mod's natural attack modifiers (Strong Attack,
  Weak Attack, Extra Attack, and the like).
- **Bonded Mount** class for a paladin's mount: the animal companion progression plus Intelligence
  of at least 6, the celestial template at 11th level, and spell resistance (paladin level + 11) at
  15th.

- **Command Companion** on the master, one per feature granting an animal companion: opens astora-mod's
  Handle Animal dialog with that companion, with Link's free action to handle, move action to push, and +4. A
  linked animal companion shows astora-mod's Tricks section and its bonus trick allowance.

### Fixed
- A companion class added to an actor by hand now counts as its companion class: no warning when choosing it,
  and no second class added on linking.

### Changed
- The **Companion Grant** section is hidden on features that don't grant a companion. A **Show N more sections** line at the foot of the Advanced tab reveals it (shared sheet kit 1.7.0).
