#!/usr/bin/env bash
#
# Remplit le vivier du Moviedle en appelant la route protégée, page par page.
#
# Le découpage n'est pas cosmétique : le remplissage complet représente environ
# 4 000 appels TMDB, bien au-delà de ce qu'une seule requête HTTP peut porter.
# La route traite une tranche et renvoie la page suivante ; ce script se
# contente d'enchaîner jusqu'à ce qu'elle réponde `null`.
#
# Usage :
#   ./scripts/fill-puzzle-pool.sh <jeton> [url]
#
# Le jeton est la valeur de PUZZLE_BUILD_TOKEN configurée côté serveur.
# Rejouable sans risque : chaque titre est mis à jour, jamais dupliqué
# (contrainte d'unicité sur media + tmdbId).

set -euo pipefail

TOKEN="${1:-}"
BASE="${2:-https://movietracker.fr}"

if [ -z "$TOKEN" ]; then
  echo "Usage : $0 <jeton> [url]" >&2
  exit 1
fi

for media in movie tv; do
  echo "=== $media ==="
  page=1
  while [ -n "$page" ]; do
    reponse=$(curl -s -X POST -H "x-puzzle-token: $TOKEN" \
      "$BASE/api/puzzle/build?media=$media&from=$page&pages=10")

    # Une réponse non-JSON signifie une erreur côté serveur : on s'arrête
    # plutôt que de boucler dans le vide.
    if ! echo "$reponse" | python3 -c "import sys, json; json.load(sys.stdin)" 2>/dev/null; then
      echo "  réponse inattendue : $reponse" >&2
      exit 1
    fi

    lu=$(echo "$reponse" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"pages {d['from']}-{d['to']} sur {d['totalPages']} · {d['written']} écrits, {d['skipped']} ignorés\")")
    echo "  $lu"

    page=$(echo "$reponse" | python3 -c "import sys,json; print(json.load(sys.stdin).get('nextPage') or '')")
  done
  echo "  terminé."
done
