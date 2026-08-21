import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { fetchCompanyDetail, fetchCompanyFilms, type CompanySort } from "@/lib/tmdb";
import ActorTopbar from "../../actor/[id]/ActorTopbar";
import CompanyFilters from "./CompanyFilters";
import CompanyFilmsGrid from "./CompanyFilmsGrid";
import styles from "../../actor/[id]/actor.module.css";
import companyStyles from "./company.module.css";

const COUNTRY_NAMES: Record<string, string> = {
  US: "États-Unis", FR: "France", GB: "Royaume-Uni", JP: "Japon", DE: "Allemagne",
  IT: "Italie", ES: "Espagne", CA: "Canada", KR: "Corée du Sud", CN: "Chine",
  IN: "Inde", AU: "Australie", SE: "Suède", DK: "Danemark", NZ: "Nouvelle-Zélande",
};

const SORTS = new Set<CompanySort>(["recent", "oldest", "popular", "rating"]);

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sort?: string;
    genre?: string;
    minYear?: string;
    maxYear?: string;
    minRating?: string;
  }>;
}) {
  const [{ id: idStr }, sp] = await Promise.all([params, searchParams]);
  const id = parseInt(idStr);
  if (isNaN(id)) notFound();

  // Défaut : chronologique décroissant — les sorties récentes du studio d'abord.
  const sort: CompanySort = SORTS.has(sp.sort as CompanySort)
    ? (sp.sort as CompanySort)
    : "recent";
  const genre = sp.genre ?? "";
  const minYear = sp.minYear ?? "";
  const maxYear = sp.maxYear ?? "";
  const minRating = sp.minRating ?? "";

  const [company, films] = await Promise.all([
    fetchCompanyDetail(id),
    fetchCompanyFilms(id, {
      sort,
      genreId: genre ? parseInt(genre) : null,
      minYear,
      maxYear,
      minRating: minRating ? Number(minRating) : undefined,
    }),
  ]);

  if (!company) notFound();

  // Répété tel quel sur les pages suivantes du scroll infini. Une chaîne
  // plutôt qu'un objet : sa référence reste stable côté client.
  const q = new URLSearchParams();
  if (sort !== "recent") q.set("sort", sort);
  if (genre) q.set("genre", genre);
  if (minYear) q.set("minYear", minYear);
  if (maxYear) q.set("maxYear", maxYear);
  if (minRating) q.set("minRating", minRating);
  const query = q.toString();

  const country = COUNTRY_NAMES[company.originCountry] ?? company.originCountry;

  return (
    <>
      {/* Le fond reprend l'affiche du premier film de la liste courante */}
      {films[0]?.posterUrl && (
        <div className={styles.backdrop}>
          <Image
            src={films[0].posterUrl}
            alt=""
            fill
            sizes="100vw"
            style={{ objectFit: "cover", objectPosition: "center 20%" }}
          />
        </div>
      )}
      <div className={styles.backdropOverlay} />

      <ActorTopbar />

      <div className={companyStyles.page}>
        <header className={companyStyles.head}>
          {company.logoUrl ? (
            <div className={companyStyles.logoWrap}>
              <Image
                src={company.logoUrl}
                alt={company.name}
                width={154}
                height={80}
                className={companyStyles.logo}
              />
            </div>
          ) : (
            <div className={companyStyles.logoFallback}>{company.name[0]}</div>
          )}

          <div>
            <div className={styles.deptBadge}>Société de production</div>
            <h1 className={companyStyles.name}>{company.name}</h1>
            <div className={companyStyles.meta}>
              {country && <span>{country}</span>}
              {company.headquarters && <span>{company.headquarters}</span>}
              {company.homepage && (
                <a
                  href={company.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={companyStyles.link}
                >
                  Site officiel
                </a>
              )}
            </div>
          </div>
        </header>

        {company.description && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>À propos</div>
            <p className={styles.bio}>{company.description}</p>
          </div>
        )}

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Filmographie</div>

          <Suspense fallback={null}>
            <CompanyFilters
              sort={sort}
              genre={genre}
              minYear={minYear}
              maxYear={maxYear}
              minRating={minRating}
            />
          </Suspense>

          <CompanyFilmsGrid
            key={`${sort}-${genre}-${minYear}-${maxYear}-${minRating}`}
            companyId={id}
            initialFilms={films}
            query={query}
          />
        </div>
      </div>
    </>
  );
}
