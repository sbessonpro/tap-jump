# Shadow Crawl

Action-RPG side-scroller dark en HTML5 / Canvas. Avance dans le donjon, abats les monstres, ramasse les pièces, achète des armes, et survis aux boss tous les 500m.

## Jouer

Ouvre `index.html` dans un navigateur (mobile ou desktop). Aucune dépendance, aucun build.

### Contrôles

**Mobile**
- Joystick virtuel (bas gauche) — déplacer
- Bouton **ATK** — attaquer
- Bouton **arme** — changer d'arme (cycle parmi celles débloquées)
- Bouton **🏪 Boutique** — pause + acheter des bonus

**Desktop**
- `WASD` ou flèches — déplacer
- `Espace` — attaquer
- `Q` ou `Tab` — changer d'arme
- `B` — boutique

## Armes

Tu commences avec **Épée**, **Arc** et **Marteau**. Trois autres se débloquent en boutique.

| Arme | Type | Cadence | Dégâts | Particularité |
|------|------|---------|--------|---------------|
| ⚔ Épée | Mêlée courte | 0.32s | 25 | Polyvalente |
| 🏹 Arc | Distance | 0.55s | 22 | Projectile rapide |
| 🔨 Marteau | Mêlée large | 0.95s | 65 | Knockback massif, screen shake |
| 🗡 Dague | Mêlée courte | 0.18s | 14 | Très rapide, spam |
| 🔱 Lance | Mêlée longue | 0.42s | 38 | Portée 115, arc étroit |
| ✨ Épée mystique | Mêlée + onde | 0.45s | 30 | Lance une onde de slash projectile qui transperce |

Chaque arme peut être upgradée +60% dégâts en boutique (achat unique).

## Ennemis

| Mob | PV | Dégâts | Pièces | Particularité |
|-----|----|--------|--------|---------------|
| 💀 Squelette | 50 | 10 | 3-6 | Mêlée basique |
| 🦇 Chauve-souris | 22 | 6 | 1-3 | Vol, rapide, fragile |
| 👹 Brute | 140 | 22 | 10-18 | Tank, dégâts élevés |
| 👺 Gobelin | 35 | 8 | 4-8 | Lance des dagues à distance |
| 👻 Spectre | 45 | 14 | 6-12 | Vol, semi-transparent, **20% chance d'esquiver** |
| 🛡 Chevalier | 220 | 18 | 14-24 | **Armure : flèches font 50% de dégâts** |

Les pièces drop au sol, **bouncent**, et sont **magnétisées** vers le héros à courte distance.

## Boss (tous les 500m)

| Boss | PV | Particularité |
|------|----|---------------|
| 💀 La Liche (500m) | 600 | Lance des **éclairs sombres à tête chercheuse**, invoque des squelettes (phase 2) |
| ⚔ Le Champion d'Acier (1000m) | 1100 | **Charge dévastatrice** + **slam de marteau AOE** |
| 🐉 Le Dragon des Ombres (1500m) | 1800 | Vol, **souffle de feu en cône**, **plongée** sur le joueur |

Vaincre un boss → grosse récompense en pièces + **passage à l'étage suivant** (nouveaux ennemis dans le pool, scaling). Après le 3e boss, le cycle reprend avec +60% de PV.

## Étages (progression)

- **Étage 1** (0-500m) : Squelettes, chauves-souris, brutes
- **Étage 2** (500-1000m, après Liche) : + Gobelins
- **Étage 3** (1000-1500m, après Champion) : + Spectres, Chevaliers
- **Étage 4+** (après Dragon) : Tous les ennemis, boss en boucle avec scaling

## Boutique

| Item | Effet | Prix |
|------|-------|------|
| Potion mineure | +50 PV | 20 |
| Potion majeure | Soin total | 50 |
| Vitalité | +25 PV max | 80 |
| Force | +20% dégâts | 100 |
| Agilité | +15% vitesse | 60 |
| Dague | Débloque arme | 90 |
| Lance | Débloque arme | 130 |
| Épée mystique | Débloque arme | 220 |
| Épée affûtée | Épée +60% | 130 |
| Arc enchanté | Arc +60% | 130 |
| Marteau de guerre | Marteau +60% | 160 |

## Stack

- HTML5 Canvas
- JavaScript vanilla, un seul fichier
- CSS3 — UI dark, joystick + boutons mobile-first
