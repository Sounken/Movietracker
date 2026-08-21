/**
 * `template.tsx` — contrairement à `layout.tsx`, ce composant est remonté à
 * chaque navigation. C'est exactement ce qu'il faut pour rejouer l'animation
 * d'entrée quand on clique sur un onglet de la barre latérale : sans lui, le
 * contenu était remplacé d'un coup, sans transition.
 *
 * L'animation elle-même vit dans `globals.css` (.pageEnter), pour rester
 * cohérente avec le reste du site.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="pageEnter">{children}</div>;
}
