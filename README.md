# Shadow Crawl

Prototype d'action-RPG side-scroller en HTML5 / Canvas. Avance dans un donjon sombre, abats les monstres, change d'arme selon la situation.

## Jouer

Ouvre `index.html` dans un navigateur (mobile ou desktop). Aucune dépendance, aucun build.

### Contrôles

**Mobile**
- Joystick virtuel (bas gauche) — déplacer
- Bouton **ATK** (bas droite) — attaquer
- Bouton **arme** — changer d'arme (épée → arc → marteau)

**Desktop**
- `WASD` ou flèches — déplacer
- `Espace` — attaquer
- `Q` ou `Tab` — changer d'arme

## Armes

| Arme | Portée | Cadence | Dégâts | Knockback |
|------|--------|---------|--------|-----------|
| Épée ⚔ | Courte (70) | Rapide (0.32s) | 25 | Faible |
| Arc 🏹 | Longue (projectile) | Moyenne (0.55s) | 22 | Moyen |
| Marteau 🔨 | Moyenne (85, large arc) | Lent (0.95s) | 65 | Fort |

## Ennemis

- **Squelette** — basique, mêlée, 50 PV
- **Chauve-souris** — rapide et fragile, vol, 22 PV
- **Brute** — tank lent qui frappe fort, 140 PV

## Stack

- HTML5 Canvas
- JavaScript vanilla, un seul fichier
- CSS3 — UI dark, joystick + boutons mobile-first
