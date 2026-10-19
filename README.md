# skill-toggles

Un panneau **Skills** à côté du chat de Claude Code : un bouton par skill pour l'activer ou le désactiver à tout moment.

- Les skills sont rangés par plugin (`mattpocock-skills`, `anthropic-skills`…) ; clique sur un groupe pour le déplier.
- ● = actif, ○ = désactivé, plus « Tout activer » / « Tout désactiver » par groupe.
- Un skill désactivé est retiré de la liste envoyée à Claude (moins de tokens par message) et bloqué s'il est lancé quand même.
- Les choix sont gardés d'une session à l'autre. `/skills-panel` rouvre le panneau.

La liste apparaît après le premier message d'une nouvelle session.

## Installation

À l'invite d'une session Claude Code dans le terminal :

```
/plugin install skill-toggles --marketplace halinmiika/skill-toggles
```

Réponds `y` pour ajouter le marketplace, puis choisis la portée (user par défaut, avec Entrée).

Depuis un shell :

```
claude plugin install skill-toggles --marketplace halinmiika/skill-toggles
```

Dans l'app desktop, où `/plugin` ne marche pas : clique sur + à côté de la zone de saisie, puis Plugins, Add marketplace avec `halinmiika/skill-toggles`, puis Add plugin.
