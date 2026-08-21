import Image from "next/image";
import { notFound } from "next/navigation";
import { fetchCompanyDetail, fetchCompanyFilms } from "@/lib/tmdb";
import ActorTopbar from "../../actor/[id]/ActorTopbar";
import CompanyFilmsGrid from "./CompanyFilmsGrid";
import styles from "../../actor/[id]/actor.module.css";
import companyStyles from "./company.module.css";

const COUNTRY_NAMES: Record<string, string> = {
  US: "États-Unis", FR: "France", GB: "Royaume-Uni", JP: "Japon", DE: "Allemagne",
  IT: "Italie", ES: "Espagne", CA: "Canada", KR: "Corée du Sud", CN: "Chine",
  IN: "Inde", AU: "Australie", SE: "Suède", DK: "Danemark", NZ: "Nouvelle-Zélande",
};

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) notFound();

  const [company, films] = await Promise.all([
    fetchCompanyDetail(id),
    fetchCompanyFilms(id, 1),
  ]);

  if (!company) notFound();

  const country = COUNTRY_NAMES[company.originCountry] ?? company.originCountry;

  return (
    <>
      {/* Le fond reprend l'affiche du film le plus populaire de la société */}
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
          <CompanyFilmsGrid companyId={id} initialFilms={films} />
        </div>
      </div>
    </>
  );
}
