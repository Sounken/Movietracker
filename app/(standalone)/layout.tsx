import { getUserRatingScale } from "@/lib/rating-server";
import { RatingScaleProvider } from "@/lib/rating-scale";

export default async function StandaloneLayout({ children }: { children: React.ReactNode }) {
  const ratingScale = await getUserRatingScale();
  return <RatingScaleProvider scale={ratingScale}>{children}</RatingScaleProvider>;
}
