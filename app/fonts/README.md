# Polices auto-hébergées

| Fichier | Police | Origine |
|---|---|---|
| `blauer-nue-regular.woff2` | Blauer Nue Regular | Webhance Studio (Alwin Johnson), converti depuis l'OTF fourni |
| `cooper-black.woff2` | Cooper Black **Lining** | dérivé de `COOPBL.TTF` — voir ci-dessous |

Les deux fichiers déclarent `fsType: 8` (*Editable embedding*), le niveau le plus
permissif de la spécification OpenType : l'intégration et la modification sont
autorisées par le fichier lui-même.

## Cooper Black : chiffres réalignés

Cooper Black, dessinée en 1922, porte des **chiffres elzéviriens** — ils montent
et descendent comme des minuscules au lieu d'être alignés sur la capitale.
Mesuré sur l'original, en millièmes de cadratin :

| | bas | haut | | | bas | haut |
|---|---|---|---|---|---|---|
| 0 | −13 | 563 | | 5 | −104 | 553 |
| 1 | −14 | 560 | | 6 | −13 | 635 |
| 2 | −46 | 560 | | 7 | −126 | 580 |
| 3 | −101 | 560 | | 8 | −13 | 619 |
| 4 | −92 | 597 | | 9 | −125 | 560 |

Dans « 1685 », le 6 monte à 635 et le 8 à 619 quand le 1 plafonne à 560 et que le
5 descend à −104 : le 1 et le 5 paraissent tomber plus bas. Charmant sur un
titre, illisible sur une colonne de statistiques.

Impossible à corriger en CSS : `font-variant-numeric: lining-nums` suppose une
fonctionnalité OpenType `lnum`, or **la table de fonctionnalités de Cooper Black
est vide**. La police ne contient pas non plus de jeu de chiffres alternatif — ses
11 glyphes non mappés sont des composants d'accents.

Les dix chiffres ont donc été **redessinés par transformation des contours** :
chacun est mis à l'échelle verticalement pour aller de la ligne de base (0) à
648, la hauteur du « 6 », le plus haut des chiffres déjà posés sur la ligne.

```
zero  ×1.124   five  ×0.987
one   ×1.130   six   ×1.000
two   ×1.070   seven ×0.918
three ×0.981   eight ×1.026
four  ×0.941   nine  ×0.946
```

Deux points de méthode :

- **Échelle verticale seule, pas uniforme.** Une mise à l'échelle uniforme
  préserverait les proportions de chaque chiffre, mais changerait leur largeur :
  à l'essai, les chiffres ressortaient rapetissés et espacés. En n'agissant que
  sur la hauteur, les largeurs dessinées et le crénage sont conservés, et la
  déformation reste comprise entre −8% et +13%.
- **L'avance reste à 600** (1229 unités sur 2048). Cooper Black est tabulaire par
  construction, ce qui fait que les colonnes de chiffres s'alignent : cette
  propriété est préservée.

Le nom complet de la police porte le suffixe « Lining » pour ne pas confondre le
fichier dérivé avec l'original.

### Refaire la manipulation

Si le fichier source est un jour remplacé, la transformation se rejoue avec
`fonttools` :

```python
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen

DIGITS = ["zero","one","two","three","four","five","six","seven","eight","nine"]
f = TTFont("COOPBL.TTF")
glyf, gs, hmtx = f["glyf"], f.getGlyphSet(), f["hmtx"]

bp = BoundsPen(gs); gs["six"].draw(bp)
target = bp.bounds[3] - bp.bounds[1]          # hauteur du « 6 »

for name in DIGITS:
    g = glyf[name]
    bp = BoundsPen(gs); gs[name].draw(bp)
    _, ymin, _, ymax = bp.bounds
    scale = target / (ymax - ymin)
    advance = hmtx[name][0]
    g.coordinates = [(x, round((y - ymin) * scale)) for x, y in g.coordinates]
    g.recalcBounds(glyf)
    hmtx[name] = (advance, g.xMin)            # avance inchangée

f.flavor = "woff2"
f.save("cooper-black.woff2")
```

## Licence

Cooper Black est distribuée par Monotype ; `COOPBL.TTF` est la digitalisation
livrée avec Windows et Office, et ses métadonnées ne portent ni fabricant ni URL
de licence. L'autorisation d'intégration inscrite dans le fichier n'équivaut pas
à une licence webfont : pour lever tout doute, une licence webfont Cooper Black
chez Monotype remplacerait ce fichier sans rien changer au code.
