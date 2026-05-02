# Shadow Crawl

Prototype d'action-RPG side-scroller en HTML5 / Canvas. Avance dans un donjon sombre, abats les monstres, ramasse leurs pièces, achète des bonus.

## Jouer

Ouvre `index.html` dans un navigateur (mobile ou desktop). Aucune dépendance, aucun build.

### Contrôles

**Mobile**
- Joystick virtuel (bas gauche) — déplacer
- Bouton **ATK** (bas droite) — attaquer
- Bouton **arme** — changer d'arme (épée → arc → marteau)
- Bouton **🏪 Boutique** (haut droite) — mettre en pause et acheter des bonus

**Desktop**
- `WASD` ou flèches — déplacer
- `Espace` — attaquer
- `Q` ou `Tab` — changer d'arme
- `B` — ouvrir/fermer la boutique

## Armes

| Arme | Portée | Cadence | Dégâts | Knockback |
|------|--------|---------|--------|-----------|
| Épée ⚔ | Courte (75) | Rapide (0.32s) | 25 | Faible |
| Arc 🏹 | Longue (projectile) | Moyenne (0.55s) | 22 | Moyen |
| Marteau 🔨 | Moyenne (95, large arc) | Lent (0.95s) | 65 | Fort |

Chaque arme peut être upgradée dans la boutique (+60% dégâts, achat unique).

## Ennemis

| Mob | PV | Dégâts | Pièces |
|-----|----|--------|--------|
| 💀 Squelette | 50 | 10 | 3-6 |
| 🦇 Chauve-souris | 22 | 6 | 1-3 |
| 👹 Brute | 140 | 22 | 10-18 |

Les pièces drop au sol et sont **magnétisées** vers le héros à courte distance.

## Boutique

| Item | Effet | Prix |
|------|-------|------|
| Potion mineure | +50 PV | 20 |
| Potion majeure | Soin total | 50 |
| Vitalité | +25 PV max | 80 |
| Force | +20% dégâts | 100 |
| Agilité | +15% vitesse | 60 |
| Épée affûtée | Épée +60% dégâts | 130 |
| Arc enchanté | Arc +60% dégâts | 130 |
| Marteau de guerre | Marteau +60% dégâts | 160 |

## Stack

- HTML5 Canvas
- JavaScript vanilla, un seul fichier
- CSS3 — UI dark, joystick + boutons mobile-first
